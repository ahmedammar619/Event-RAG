import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import pg from 'pg';
import { dbPlugin } from './plugins/db.js';
import { ragDbPlugin } from './plugins/ragDb.js';
import { authPlugin } from './plugins/auth.js';
import routes from './routes/index.js';

// Load .env file (try multiple paths for different environments)
dotenv.config();
dotenv.config({ path: '.env' });
dotenv.config({ path: '../../.env' });

// Run migrations on startup
const runMigrations = async () => {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const migrations = [
    `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS event_days (
      id SERIAL PRIMARY KEY,
      date DATE UNIQUE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      capacity INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
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
    `CREATE TABLE IF NOT EXISTS moderators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      schedule_preference VARCHAR(20) DEFAULT 'no_preference',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
      event_day_id INTEGER NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      moderator_id INTEGER NOT NULL REFERENCES moderators(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_by VARCHAR(50) DEFAULT 'manual',
      UNIQUE(session_id, moderator_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_availability_moderator ON availability(moderator_id)`,
    `CREATE INDEX IF NOT EXISTS idx_availability_day ON availability(event_day_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(event_day_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignments_session ON assignments(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignments_moderator ON assignments(moderator_id)`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'moderators' AND column_name = 'schedule_preference') THEN ALTER TABLE moderators ADD COLUMN schedule_preference VARCHAR(20) DEFAULT 'no_preference'; END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'username') THEN ALTER TABLE admins ADD COLUMN username VARCHAR(100) UNIQUE; END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'headcount_percentage') THEN ALTER TABLE sessions ADD COLUMN headcount_percentage INTEGER; END IF; END $$`
  ];

  console.log('Running database migrations...');
  for (const migration of migrations) {
    try {
      await pool.query(migration);
    } catch (err) {
      console.error('Migration error:', err.message);
    }
  }
  console.log('Migrations complete');
  await pool.end();
};

await runMigrations();

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true
});

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
});

await fastify.register(dbPlugin);
await fastify.register(ragDbPlugin);
await fastify.register(authPlugin);

// Register routes
await fastify.register(routes, { prefix: '/api' });

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);

  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred'
    }
  };

  reply.status(statusCode).send(response);
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port: parseInt(port), host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
