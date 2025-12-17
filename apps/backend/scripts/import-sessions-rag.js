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
const BATCH_SIZE = 20; // Process 20 sessions at a time for efficiency

// Batch embedding generation - sends multiple texts in one API call
async function generateEmbeddingsBatch(texts) {
  const response = await fetch(`${EMBEDDING_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text-v2-moe',
      input: texts
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.embeddings; // Returns array of embeddings
}

function parseTime(timeStr) {
  if (!timeStr) return null;

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
  console.log(`Batch size: ${BATCH_SIZE}`);

  // Clear existing data
  console.log('\nClearing existing session data...');
  await pool.query('DELETE FROM session_embeddings');
  await pool.query('DELETE FROM sessions');

  // First pass: Insert all sessions and prepare searchable texts
  console.log('\n--- Phase 1: Importing sessions ---');
  const sessionsToEmbed = [];

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

    const descriptionOriginal = record['Description_Original'] || record['Description'] || '';
    const descriptionEnglish = record['Description_English'] || record['Description'] || '';

    if (!title || !date || !timeStart || !timeEnd) {
      continue;
    }

    try {
      const insertResult = await pool.query(`
        INSERT INTO sessions (date, time_start, time_end, track, title, room, description_original, description_english, speakers, session_type, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [date, timeStart, timeEnd, track, title, room, descriptionOriginal, descriptionEnglish, speakers, sessionType, tags]);

      const sessionId = insertResult.rows[0].id;

      const searchableText = `Title: ${title}\nTrack: ${track}\nSpeakers: ${speakers}\nDescription: ${descriptionEnglish}`.trim();

      sessionsToEmbed.push({
        id: sessionId,
        title,
        searchableText
      });

      if (sessionsToEmbed.length % 50 === 0) {
        console.log(`  Imported ${sessionsToEmbed.length} sessions...`);
      }
    } catch (err) {
      console.log(`  Failed to import "${title.substring(0, 40)}...": ${err.message}`);
    }
  }

  console.log(`\nTotal sessions imported: ${sessionsToEmbed.length}`);

  // Second pass: Generate embeddings in batches
  console.log('\n--- Phase 2: Generating embeddings in batches ---');
  let embeddedCount = 0;
  let errorCount = 0;
  const totalBatches = Math.ceil(sessionsToEmbed.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, sessionsToEmbed.length);
    const batch = sessionsToEmbed.slice(start, end);

    console.log(`\nBatch ${batchIndex + 1}/${totalBatches} (sessions ${start + 1}-${end})`);

    try {
      const texts = batch.map(s => s.searchableText);
      const embeddings = await generateEmbeddingsBatch(texts);

      // Insert all embeddings from this batch
      for (let i = 0; i < batch.length; i++) {
        const session = batch[i];
        const embedding = embeddings[i];

        if (embedding && Array.isArray(embedding)) {
          await pool.query(`
            INSERT INTO session_embeddings (session_id, embedding, searchable_text)
            VALUES ($1, $2::vector, $3)
          `, [session.id, `[${embedding.join(',')}]`, session.searchableText]);
          embeddedCount++;
        } else {
          console.log(`  Warning: No embedding for "${session.title.substring(0, 30)}..."`);
          errorCount++;
        }
      }

      console.log(`  ✓ Embedded ${batch.length} sessions`);

      // Small delay between batches to avoid overwhelming the API
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err) {
      console.log(`  ✗ Batch failed: ${err.message}`);
      errorCount += batch.length;
    }
  }

  // Create vector index
  console.log('\n--- Phase 3: Creating vector index ---');
  try {
    await pool.query('DROP INDEX IF EXISTS session_embeddings_embedding_idx');

    // Only create IVFFlat index if we have enough rows
    if (embeddedCount >= 100) {
      await pool.query(`
        CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `);
      console.log('IVFFlat vector index created');
    } else {
      // Use simpler HNSW index for smaller datasets
      await pool.query(`
        CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
        USING hnsw (embedding vector_cosine_ops)
      `);
      console.log('HNSW vector index created (suitable for smaller datasets)');
    }
  } catch (err) {
    console.log(`Warning: Could not create vector index: ${err.message}`);
  }

  console.log(`\n========== Import Complete ==========`);
  console.log(`Sessions imported: ${sessionsToEmbed.length}`);
  console.log(`Embeddings generated: ${embeddedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`API calls made: ${totalBatches} (batched)`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
