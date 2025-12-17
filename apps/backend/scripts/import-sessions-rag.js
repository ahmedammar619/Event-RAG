import fs from 'fs';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
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

const EMBEDDING_URL = process.env.EMBEDDING_URL || 'https://nomic-embed-text-production.up.railway.app';

async function generateEmbedding(text) {
  const response = await fetch(`${EMBEDDING_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding;
}

function parseTime(timeStr) {
  if (!timeStr) return null;

  // Handle formats like "10:00 AM", "2:00 PM"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3];

  if (period) {
    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

function parseDate(dateStr) {
  if (!dateStr) return null;

  // Handle formats like "12/24/2025"
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return null;

  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = match[3];

  return `${year}-${month}-${day}`;
}

async function main() {
  // Try translated CSV first, fall back to cleaned CSV
  let inputPath = join(__dirname, '../../../agenda_translated.csv');
  if (!fs.existsSync(inputPath)) {
    inputPath = join(__dirname, '../../../agenda_cleaned.csv');
    console.log('Using cleaned CSV (no translations)');
  } else {
    console.log('Using translated CSV');
  }

  console.log('Reading CSV...');
  const csvContent = fs.readFileSync(inputPath, 'utf-8');

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`Found ${records.length} sessions`);
  console.log(`Embedding URL: ${EMBEDDING_URL}`);

  // Clear existing data
  console.log('\nClearing existing session data...');
  await pool.query('DELETE FROM session_embeddings');
  await pool.query('DELETE FROM sessions');

  let importedCount = 0;
  let embeddedCount = 0;
  let errors = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    const title = record['*Session Title'] || record['Session Title'] || '';
    const date = parseDate(record['*Date'] || record['Date']);
    const timeStart = parseTime(record['*Time Start'] || record['Time Start']);
    const timeEnd = parseTime(record['*Time End'] || record['Time End']);
    const track = record['Tracks'] || '';
    const room = record['Room/Location'] || '';
    const speakers = record['Speakers'] || '';
    const sessionType = record['Session or Sub-session(Sub)'] || 'Session';
    const tags = record['Tags'] || '';

    // Use translated description if available, otherwise use original
    const descriptionOriginal = record['Description_Original'] || record['Description'] || '';
    const descriptionEnglish = record['Description_English'] || record['Description'] || '';

    if (!title || !date || !timeStart || !timeEnd) {
      console.log(`Skipping row ${i + 1}: Missing required fields`);
      continue;
    }

    console.log(`\nImporting ${i + 1}/${records.length}: ${title.substring(0, 50)}...`);

    try {
      // Insert session
      const insertResult = await pool.query(`
        INSERT INTO sessions (date, time_start, time_end, track, title, room, description_original, description_english, speakers, session_type, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [date, timeStart, timeEnd, track, title, room, descriptionOriginal, descriptionEnglish, speakers, sessionType, tags]);

      const sessionId = insertResult.rows[0].id;
      importedCount++;

      // Generate searchable text for embedding
      const searchableText = `
Title: ${title}
Track: ${track}
Speakers: ${speakers}
Description: ${descriptionEnglish}
      `.trim();

      // Generate embedding
      console.log('  Generating embedding...');
      try {
        const embedding = await generateEmbedding(searchableText);

        if (embedding && Array.isArray(embedding)) {
          // Insert embedding
          await pool.query(`
            INSERT INTO session_embeddings (session_id, embedding, searchable_text)
            VALUES ($1, $2::vector, $3)
          `, [sessionId, `[${embedding.join(',')}]`, searchableText]);

          embeddedCount++;
          console.log('  Embedding saved');
        } else {
          console.log('  Warning: Invalid embedding response');
        }
      } catch (embErr) {
        console.log(`  Embedding failed: ${embErr.message}`);
        errors.push({ session: title, error: embErr.message });
      }

      // Rate limiting - wait 300ms between embedding requests
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.log(`  Import failed: ${err.message}`);
      errors.push({ session: title, error: err.message });
    }
  }

  // Create vector index after importing data
  console.log('\nCreating vector similarity index...');
  try {
    await pool.query(`
      DROP INDEX IF EXISTS session_embeddings_embedding_idx;
      CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    `);
    console.log('Vector index created');
  } catch (err) {
    console.log(`Warning: Could not create vector index: ${err.message}`);
    console.log('This is normal if you have fewer than 100 rows. Index will be created later.');
  }

  console.log(`\n\n========== Import Complete ==========`);
  console.log(`Sessions imported: ${importedCount}`);
  console.log(`Embeddings generated: ${embeddedCount}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e.session}: ${e.error}`));
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
