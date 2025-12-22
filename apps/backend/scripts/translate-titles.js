/**
 * Translate Session Titles
 * Translates Arabic titles to English and updates the sessions table
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.RAG_DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const OLLAMA_URL = process.env.OLLAMA_URL || 'https://ollama-production-2290.up.railway.app';
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL;

// Check if text contains Arabic characters
function containsArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// Translate using LibreTranslate (preferred)
async function translateWithLibre(text) {
  if (!LIBRETRANSLATE_URL) return null;

  try {
    const response = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'ar',
        target: 'en'
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.translatedText;
  } catch (err) {
    return null;
  }
}

// Translate using Ollama (fallback)
async function translateWithOllama(text) {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemma3:270m',
        prompt: `Translate this Arabic text to English. Only respond with the translation, nothing else:\n\n${text}`,
        stream: false
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.response?.trim();
  } catch (err) {
    return null;
  }
}

// Main translation function
async function translateToEnglish(text) {
  // Try LibreTranslate first
  let translation = await translateWithLibre(text);
  if (translation) return translation;

  // Fallback to Ollama
  translation = await translateWithOllama(text);
  return translation;
}

async function main() {
  console.log('Translating session titles...\n');
  console.log(`LibreTranslate: ${LIBRETRANSLATE_URL || 'Not configured'}`);
  console.log(`Ollama: ${OLLAMA_URL}\n`);

  // Get all sessions
  const result = await pool.query('SELECT id, title, title_english FROM sessions ORDER BY id');
  const sessions = result.rows;

  console.log(`Found ${sessions.length} sessions\n`);

  let translated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const title = session.title;

    // Skip if already has English title
    if (session.title_english) {
      skipped++;
      continue;
    }

    // Check if title contains Arabic
    if (!containsArabic(title)) {
      // Title is already English, copy it to title_english
      await pool.query(
        'UPDATE sessions SET title_english = $1 WHERE id = $2',
        [title, session.id]
      );
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${sessions.length}] Translating: "${title.substring(0, 50)}..."`);

    try {
      const englishTitle = await translateToEnglish(title);

      if (englishTitle) {
        await pool.query(
          'UPDATE sessions SET title_english = $1 WHERE id = $2',
          [englishTitle, session.id]
        );
        console.log(`  → "${englishTitle.substring(0, 50)}..."\n`);
        translated++;
      } else {
        // Keep original if translation fails
        await pool.query(
          'UPDATE sessions SET title_english = $1 WHERE id = $2',
          [title, session.id]
        );
        console.log(`  → Translation failed, keeping original\n`);
        errors++;
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.log(`  → Error: ${err.message}\n`);
      errors++;
    }
  }

  console.log('\n========== Translation Complete ==========');
  console.log(`Translated: ${translated}`);
  console.log(`Skipped (already done or English): ${skipped}`);
  console.log(`Errors: ${errors}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
