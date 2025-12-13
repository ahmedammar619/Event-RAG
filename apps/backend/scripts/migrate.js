import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  // 001: Create admins table
  `CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 002: Create event_days table
  `CREATE TABLE IF NOT EXISTS event_days (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 003: Create rooms table
  `CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 004: Create sessions table
  `CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    event_day_id INTEGER NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    headcount INTEGER DEFAULT 0,
    moderators_needed INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 005: Create moderators table
  `CREATE TABLE IF NOT EXISTS moderators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 006: Create availability table
  `CREATE TABLE IF NOT EXISTS availability (
    id SERIAL PRIMARY KEY,
    moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
    event_day_id INTEGER NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  // 007: Create assignments table
  `CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(50) DEFAULT 'manual',
    UNIQUE(session_id, moderator_id)
  )`,

  // 008: Create indexes
  `CREATE INDEX IF NOT EXISTS idx_availability_moderator ON availability(moderator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_availability_day ON availability(event_day_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(event_day_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assignments_session ON assignments(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_assignments_moderator ON assignments(moderator_id)`
];

async function migrate() {
  console.log('Starting database migration...');
  console.log('Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));

  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await pool.query(migrations[i]);
    }

    console.log('All migrations completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
