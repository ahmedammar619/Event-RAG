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

const migrations = [
  // 001: Enable pgvector extension
  `CREATE EXTENSION IF NOT EXISTS vector`,

  // 002: Create visitors table (event attendees)
  `CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 003: Create sessions table (imported from CSV)
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    time_start TIME NOT NULL,
    time_end TIME NOT NULL,
    track VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    room VARCHAR(255),
    description_original TEXT,
    description_english TEXT,
    speakers TEXT,
    session_type VARCHAR(50),
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 004: Create session_embeddings table (vector search)
  `CREATE TABLE IF NOT EXISTS session_embeddings (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    embedding vector(768),
    searchable_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 005: Create query_logs table (for analytics/improvement)
  `CREATE TABLE IF NOT EXISTS query_logs (
    id SERIAL PRIMARY KEY,
    visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,
    query_original TEXT,
    query_english TEXT,
    detected_language VARCHAR(10),
    results_count INTEGER,
    search_mode VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 006: Create ai_settings table (admin toggles)
  `CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 007: Create indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_track ON sessions(track)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_speakers ON sessions(speakers)`,
  `CREATE INDEX IF NOT EXISTS idx_query_logs_visitor ON query_logs(visitor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_query_logs_created ON query_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_session_embeddings_session ON session_embeddings(session_id)`,

  // 008: Create IVFFlat index for vector similarity search
  // Note: This index improves performance but requires data to be present first
  // Run this after importing sessions: CREATE INDEX ON session_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

  // 009: Insert default AI settings
  `INSERT INTO ai_settings (key, value) VALUES
    ('search_mode', 'direct'),
    ('default_result_count', '5')
   ON CONFLICT (key) DO NOTHING`
];

async function migrate() {
  console.log('Starting RAG database migration...');
  console.log('RAG Database URL:', process.env.RAG_DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await pool.query(migrations[i]);
    }

    console.log('All RAG migrations completed successfully!');
    console.log('\nNote: After importing sessions, run this to create the vector index:');
    console.log('CREATE INDEX ON session_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
