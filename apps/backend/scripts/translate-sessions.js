import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL;
const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ollama-production-2290.up.railway.app';

// Regex to detect Arabic text
const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function containsArabic(text) {
  return arabicRegex.test(text);
}

async function translateWithLibreTranslate(text) {
  if (!LIBRETRANSLATE_URL) {
    throw new Error('LibreTranslate URL not configured');
  }

  const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'ar',
      target: 'en',
      format: 'text'
    })
  });

  if (!response.ok) {
    throw new Error(`LibreTranslate error: ${response.status}`);
  }

  const data = await response.json();
  return data.translatedText;
}

async function translateWithOllama(text) {
  const prompt = `Translate the following Arabic text to English. Only provide the translation, nothing else:

${text}`;

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3:270m',
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return data.response?.trim() || text;
}

async function translateText(text) {
  // Try LibreTranslate first, fall back to Ollama
  if (LIBRETRANSLATE_URL) {
    try {
      return await translateWithLibreTranslate(text);
    } catch (err) {
      console.log('  LibreTranslate failed, trying Ollama...');
    }
  }

  return await translateWithOllama(text);
}

async function translateDescription(description) {
  if (!description || !containsArabic(description)) {
    return description;
  }

  // Split into paragraphs/sections
  const sections = description.split(/\n+/);
  const translatedSections = [];

  for (const section of sections) {
    if (containsArabic(section)) {
      // Extract Arabic portions and translate them
      const translated = await translateText(section);
      translatedSections.push(translated);
    } else {
      translatedSections.push(section);
    }
  }

  return translatedSections.join('\n\n');
}

async function main() {
  const inputPath = join(__dirname, '../../../agenda_cleaned.csv');
  const outputPath = join(__dirname, '../../../agenda_translated.csv');

  console.log('Reading cleaned CSV...');
  const csvContent = fs.readFileSync(inputPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`Found ${records.length} sessions`);
  console.log(`Translation service: ${LIBRETRANSLATE_URL ? 'LibreTranslate' : 'Ollama'}`);

  const translatedRecords = [];
  let translatedCount = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const description = record['Description'] || '';

    console.log(`\nProcessing ${i + 1}/${records.length}: ${record['*Session Title']?.substring(0, 50)}...`);

    if (containsArabic(description)) {
      console.log('  Contains Arabic text, translating...');
      try {
        const translatedDesc = await translateDescription(description);
        record['Description_English'] = translatedDesc;
        record['Description_Original'] = description;
        translatedCount++;
        console.log('  Translation complete');
      } catch (err) {
        console.log(`  Translation failed: ${err.message}`);
        record['Description_English'] = description;
        record['Description_Original'] = description;
      }
    } else {
      record['Description_English'] = description;
      record['Description_Original'] = description;
    }

    translatedRecords.push(record);

    // Rate limiting - wait 500ms between requests to not overwhelm the API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Get all column names including new ones
  const columns = Object.keys(translatedRecords[0]);

  const output = stringify(translatedRecords, {
    header: true,
    columns
  });

  fs.writeFileSync(outputPath, output);

  console.log(`\n\nTranslation complete!`);
  console.log(`Sessions translated: ${translatedCount}`);
  console.log(`Output saved to: ${outputPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
