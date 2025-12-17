/**
 * RAG Database Migration v3
 * - Adds visitor analytics columns to query_logs
 * - IP address, user agent, device info, location
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
  console.log('Starting RAG Database Migration v3...\n');

  const migrations = [
    // 1. Add IP address column
    {
      name: 'Add ip_address column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
      `
    },

    // 2. Add user agent column
    {
      name: 'Add user_agent column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS user_agent TEXT;
      `
    },

    // 3. Add device type column
    {
      name: 'Add device_type column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS device_type VARCHAR(50);
      `
    },

    // 4. Add browser column
    {
      name: 'Add browser column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS browser VARCHAR(100);
      `
    },

    // 5. Add OS column
    {
      name: 'Add os column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS os VARCHAR(100);
      `
    },

    // 6. Add country/location columns
    {
      name: 'Add location columns to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS country VARCHAR(100),
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS region VARCHAR(100);
      `
    },

    // 7. Add referer column
    {
      name: 'Add referer column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS referer TEXT;
      `
    },

    // 8. Add session_id for tracking user sessions
    {
      name: 'Add session_id column to query_logs',
      sql: `
        ALTER TABLE query_logs
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
      `
    },

    // 9. Create indexes for analytics queries
    {
      name: 'Create analytics indexes',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_query_logs_ip ON query_logs(ip_address);
        CREATE INDEX IF NOT EXISTS idx_query_logs_country ON query_logs(country);
        CREATE INDEX IF NOT EXISTS idx_query_logs_device ON query_logs(device_type);
        CREATE INDEX IF NOT EXISTS idx_query_logs_created ON query_logs(created_at);
      `
    },

    // 10. Create visitor analytics view
    {
      name: 'Create visitor analytics view',
      sql: `
        CREATE OR REPLACE VIEW visitor_analytics AS
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total_queries,
          COUNT(DISTINCT visitor_id) as logged_in_users,
          COUNT(DISTINCT ip_address) as unique_ips,
          COUNT(DISTINCT session_id) as unique_sessions,

          -- Device breakdown
          COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_queries,
          COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_queries,
          COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_queries,

          -- Language breakdown
          COUNT(*) FILTER (WHERE detected_language = 'arabic') as arabic_queries,
          COUNT(*) FILTER (WHERE detected_language = 'english') as english_queries,

          -- Top countries (as JSON array)
          jsonb_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL) as countries

        FROM query_logs
        GROUP BY DATE(created_at)
        ORDER BY date DESC;
      `
    },

    // 11. Create geographic stats view
    {
      name: 'Create geographic stats view',
      sql: `
        CREATE OR REPLACE VIEW geographic_stats AS
        SELECT
          country,
          COUNT(*) as query_count,
          COUNT(DISTINCT ip_address) as unique_visitors,
          COUNT(DISTINCT visitor_id) as registered_users,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen
        FROM query_logs
        WHERE country IS NOT NULL
        GROUP BY country
        ORDER BY query_count DESC;
      `
    },

    // 12. Create device stats view
    {
      name: 'Create device stats view',
      sql: `
        CREATE OR REPLACE VIEW device_stats AS
        SELECT
          device_type,
          browser,
          os,
          COUNT(*) as query_count,
          COUNT(DISTINCT ip_address) as unique_visitors
        FROM query_logs
        WHERE device_type IS NOT NULL
        GROUP BY device_type, browser, os
        ORDER BY query_count DESC;
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

  // Show current table structure
  console.log('Current query_logs columns:');
  const columns = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'query_logs'
    ORDER BY ordinal_position
  `);
  columns.rows.forEach(col => {
    console.log(`  ${col.column_name}: ${col.data_type}`);
  });

  console.log('\n========== Migration v3 Complete ==========');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
