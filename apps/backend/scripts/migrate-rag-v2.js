/**
 * RAG Database Migration v2
 * - Adds title_english column to sessions
 * - Adds new AI settings (llm_model, reasoning_mode)
 * - Creates improved analytics table
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

async function migrate() {
  console.log('Starting RAG Database Migration v2...\n');

  const migrations = [
    // 1. Add title_english column to sessions
    {
      name: 'Add title_english column',
      sql: `
        ALTER TABLE sessions
        ADD COLUMN IF NOT EXISTS title_english VARCHAR(500);
      `
    },

    // 2. Add new AI settings
    {
      name: 'Add llm_model setting',
      sql: `
        INSERT INTO ai_settings (key, value)
        VALUES ('llm_model', 'gemma3:270m')
        ON CONFLICT (key) DO NOTHING;
      `
    },
    {
      name: 'Add reasoning_mode setting',
      sql: `
        INSERT INTO ai_settings (key, value)
        VALUES ('reasoning_mode', 'full')
        ON CONFLICT (key) DO NOTHING;
      `
    },

    // 3. Create improved analytics table
    {
      name: 'Create search_analytics table',
      sql: `
        CREATE TABLE IF NOT EXISTS search_analytics (
          id SERIAL PRIMARY KEY,
          visitor_id INTEGER REFERENCES visitors(id) ON DELETE SET NULL,

          -- Query info
          query_original TEXT NOT NULL,
          query_english TEXT,
          language_detected VARCHAR(20),

          -- Search config
          search_mode VARCHAR(20),
          reasoning_mode VARCHAR(20),
          llm_model VARCHAR(100),

          -- Results
          results_count INTEGER,
          results_returned INTEGER,
          top_session_ids INTEGER[],

          -- Performance
          search_duration_ms INTEGER,
          reasoning_duration_ms INTEGER,
          embedding_duration_ms INTEGER,

          -- User interaction
          selected_count INTEGER,
          reasoning_requested BOOLEAN DEFAULT false,

          -- Timestamps
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    },

    // 4. Create indexes for analytics
    {
      name: 'Create analytics indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_search_analytics_visitor ON search_analytics(visitor_id);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);
        CREATE INDEX IF NOT EXISTS idx_search_analytics_mode ON search_analytics(search_mode);
      `
    },

    // 5. Create daily stats view
    {
      name: 'Create daily stats view',
      sql: `
        CREATE OR REPLACE VIEW search_stats_daily AS
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_searches,
          COUNT(DISTINCT visitor_id) as unique_visitors,
          AVG(results_count) as avg_results,
          AVG(search_duration_ms) as avg_search_ms,
          AVG(reasoning_duration_ms) FILTER (WHERE reasoning_requested) as avg_reasoning_ms,
          COUNT(*) FILTER (WHERE reasoning_requested) as reasoning_requests,
          COUNT(*) FILTER (WHERE language_detected = 'arabic') as arabic_queries,
          COUNT(*) FILTER (WHERE search_mode = 'smart') as smart_searches,
          COUNT(*) FILTER (WHERE search_mode = 'direct') as direct_searches
        FROM search_analytics
        GROUP BY DATE(created_at)
        ORDER BY date DESC;
      `
    },

    // 6. Create model usage stats view
    {
      name: 'Create model usage view',
      sql: `
        CREATE OR REPLACE VIEW model_usage_stats AS
        SELECT
          llm_model,
          COUNT(*) as usage_count,
          AVG(reasoning_duration_ms) as avg_duration_ms,
          MIN(created_at) as first_used,
          MAX(created_at) as last_used
        FROM search_analytics
        WHERE reasoning_requested = true AND llm_model IS NOT NULL
        GROUP BY llm_model
        ORDER BY usage_count DESC;
      `
    }
  ];

  for (const migration of migrations) {
    try {
      console.log(`Running: ${migration.name}...`);
      await pool.query(migration.sql);
      console.log(`  ✓ Success\n`);
    } catch (err) {
      if (err.code === '42701') { // Column already exists
        console.log(`  ⊘ Already exists, skipping\n`);
      } else if (err.code === '42P07') { // Table already exists
        console.log(`  ⊘ Already exists, skipping\n`);
      } else {
        console.error(`  ✗ Error: ${err.message}\n`);
      }
    }
  }

  // Verify settings
  console.log('Current AI Settings:');
  const settings = await pool.query('SELECT * FROM ai_settings ORDER BY key');
  settings.rows.forEach(row => {
    console.log(`  ${row.key}: ${row.value}`);
  });

  console.log('\n========== Migration v2 Complete ==========');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
