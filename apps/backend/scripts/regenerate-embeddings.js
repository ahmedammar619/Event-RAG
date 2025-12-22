/**
 * Regenerate Embeddings
 * Uses title_english in searchable text for better embedding quality
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

const EMBEDDING_URL = process.env.EMBEDDING_URL || 'https://nomic-embed-text-production.up.railway.app';
const BATCH_SIZE = 20;

// Batch embedding generation
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
  return data.embeddings;
}

async function main() {
  console.log('Regenerating embeddings with translated titles...\n');
  console.log(`Embedding URL: ${EMBEDDING_URL}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  // Get all sessions with their English titles
  const result = await pool.query(`
    SELECT id, title, title_english, track, speakers, description_english, description_original
    FROM sessions
    ORDER BY id
  `);

  const sessions = result.rows;
  console.log(`Found ${sessions.length} sessions\n`);

  // Clear existing embeddings
  console.log('Clearing existing embeddings...');
  await pool.query('DELETE FROM session_embeddings');
  console.log('Done\n');

  // Prepare sessions with searchable text
  const sessionsToEmbed = sessions.map(session => {
    // Use English title if available, otherwise original
    const title = session.title_english || session.title;
    const description = session.description_english || session.description_original || '';

    const searchableText = `Title: ${title}
Track: ${session.track || ''}
Speakers: ${session.speakers || ''}
Description: ${description}`.trim();

    return {
      id: session.id,
      title: session.title,
      searchableText
    };
  });

  // Generate embeddings in batches
  console.log('--- Generating embeddings in batches ---\n');
  let embeddedCount = 0;
  let errorCount = 0;
  const totalBatches = Math.ceil(sessionsToEmbed.length / BATCH_SIZE);

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, sessionsToEmbed.length);
    const batch = sessionsToEmbed.slice(start, end);

    console.log(`Batch ${batchIndex + 1}/${totalBatches} (sessions ${start + 1}-${end})`);

    try {
      const texts = batch.map(s => s.searchableText);
      const embeddings = await generateEmbeddingsBatch(texts);

      // Insert embeddings
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

      console.log(`  ✓ Embedded ${batch.length} sessions\n`);

      // Rate limit between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (err) {
      console.log(`  ✗ Batch failed: ${err.message}\n`);
      errorCount += batch.length;
    }
  }

  // Recreate vector index
  console.log('--- Creating vector index ---\n');
  try {
    await pool.query('DROP INDEX IF EXISTS session_embeddings_embedding_idx');

    if (embeddedCount >= 100) {
      await pool.query(`
        CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
      `);
      console.log('IVFFlat index created\n');
    } else {
      await pool.query(`
        CREATE INDEX session_embeddings_embedding_idx ON session_embeddings
        USING hnsw (embedding vector_cosine_ops)
      `);
      console.log('HNSW index created\n');
    }
  } catch (err) {
    console.log(`Warning: Could not create index: ${err.message}\n`);
  }

  console.log('========== Regeneration Complete ==========');
  console.log(`Embeddings created: ${embeddedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`API calls: ${totalBatches}`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
