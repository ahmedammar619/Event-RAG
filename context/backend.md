# Backend Architecture

## Overview

The backend is a Fastify REST API that handles all business logic, database operations, and serves the API endpoints for the frontend.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js 18+ | Runtime |
| Fastify | Web framework |
| @fastify/postgres | PostgreSQL plugin |
| @fastify/cors | CORS handling |
| @fastify/jwt | JWT authentication |
| bcrypt | Password hashing |
| pg | PostgreSQL driver |

## Project Structure

```
apps/backend/
├── src/
│   ├── routes/               # API route handlers
│   │   ├── index.js          # Route registration
│   │   ├── admin.js          # Admin auth routes
│   │   ├── days.js           # Event days CRUD
│   │   ├── rooms.js          # Rooms CRUD
│   │   ├── sessions.js       # Sessions CRUD
│   │   ├── moderators.js     # Moderators CRUD
│   │   ├── availability.js   # Availability management
│   │   └── assignments.js    # Assignment operations
│   │
│   ├── services/             # Business logic
│   │   ├── assignmentService.js    # Auto-assignment algorithm
│   │   ├── validationService.js    # Input validation
│   │   └── notificationService.js  # (Future) Email notifications
│   │
│   ├── plugins/              # Fastify plugins
│   │   ├── db.js             # PostgreSQL connection
│   │   ├── cors.js           # CORS configuration
│   │   ├── jwt.js            # JWT setup
│   │   └── errorHandler.js   # Global error handling
│   │
│   ├── middleware/           # Route middleware
│   │   ├── auth.js           # Admin authentication
│   │   └── moderatorAuth.js  # Moderator token validation
│   │
│   ├── utils/                # Utility functions
│   │   ├── responses.js      # Response helpers
│   │   ├── errors.js         # Custom error classes
│   │   └── timeUtils.js      # Time manipulation
│   │
│   └── app.js                # Fastify app setup & entry point
│
├── migrations/               # Database migrations
│   ├── 001_create_admins.sql
│   ├── 002_create_event_days.sql
│   ├── 003_create_rooms.sql
│   ├── 004_create_sessions.sql
│   ├── 005_create_moderators.sql
│   ├── 006_create_availability.sql
│   └── 007_create_assignments.sql
│
├── scripts/
│   ├── migrate.js            # Run migrations
│   └── seed.js               # Seed initial data
│
├── package.json
├── Dockerfile
└── .env.example
```

## App Setup

```javascript
// src/app.js
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import postgres from '@fastify/postgres';

const fastify = Fastify({
  logger: true
});

// Register plugins
fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET
});

fastify.register(postgres, {
  connectionString: process.env.DATABASE_URL
});

// Register routes
fastify.register(import('./routes/index.js'), { prefix: '/api' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred'
    }
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 3001,
      host: process.env.HOST || '0.0.0.0'
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

## Route Structure

```javascript
// src/routes/index.js
export default async function routes(fastify) {
  fastify.register(import('./admin.js'), { prefix: '/admin' });
  fastify.register(import('./days.js'), { prefix: '/days' });
  fastify.register(import('./rooms.js'), { prefix: '/rooms' });
  fastify.register(import('./sessions.js'), { prefix: '/sessions' });
  fastify.register(import('./moderators.js'), { prefix: '/moderators' });
  fastify.register(import('./availability.js'), { prefix: '/availability' });
  fastify.register(import('./assignments.js'), { prefix: '/assignments' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));
}
```

## Route Example

```javascript
// src/routes/sessions.js
export default async function sessionRoutes(fastify) {
  const { pg } = fastify;

  // Get all sessions
  fastify.get('/', async (request, reply) => {
    const { day_id, room_id, assigned } = request.query;

    let query = `
      SELECT
        s.*,
        r.name as room_name,
        ed.date,
        COALESCE(
          json_agg(
            json_build_object('id', m.id, 'name', m.name)
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as assigned_moderators
      FROM sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN event_days ed ON s.event_day_id = ed.id
      LEFT JOIN assignments a ON s.id = a.session_id
      LEFT JOIN moderators m ON a.moderator_id = m.id
    `;

    const conditions = [];
    const params = [];

    if (day_id) {
      params.push(day_id);
      conditions.push(`s.event_day_id = $${params.length}`);
    }

    if (room_id) {
      params.push(room_id);
      conditions.push(`s.room_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY s.id, r.name, ed.date ORDER BY ed.date, s.start_time`;

    const result = await pg.query(query, params);

    let data = result.rows;

    // Filter by assignment status if requested
    if (assigned === 'true') {
      data = data.filter(s => s.assigned_moderators.length > 0);
    } else if (assigned === 'false') {
      data = data.filter(s => s.assigned_moderators.length === 0);
    }

    return { success: true, data };
  });

  // Create session
  fastify.post('/', {
    preHandler: [fastify.authenticate]  // Requires admin auth
  }, async (request, reply) => {
    const { name, event_day_id, room_id, start_time, end_time, moderators_needed } = request.body;

    // Validate time is within event day hours
    const dayResult = await pg.query(
      'SELECT * FROM event_days WHERE id = $1',
      [event_day_id]
    );

    if (dayResult.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event day not found' }
      });
    }

    const day = dayResult.rows[0];
    if (start_time < day.start_time || end_time > day.end_time) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Session time must be within event day hours'
        }
      });
    }

    const result = await pg.query(
      `INSERT INTO sessions (name, event_day_id, room_id, start_time, end_time, moderators_needed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, event_day_id, room_id, start_time, end_time, moderators_needed || 1]
    );

    return reply.status(201).send({ success: true, data: result.rows[0] });
  });

  // Update headcount
  fastify.patch('/:id/headcount', async (request, reply) => {
    const { id } = request.params;
    const { headcount } = request.body;

    const result = await pg.query(
      'UPDATE sessions SET headcount = $1 WHERE id = $2 RETURNING *',
      [headcount, id]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Session not found' }
      });
    }

    return { success: true, data: result.rows[0] };
  });
}
```

## Authentication Middleware

```javascript
// src/middleware/auth.js
export default async function authPlugin(fastify) {
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }
  });
}
```

## Database Plugin

```javascript
// src/plugins/db.js
import fastifyPlugin from 'fastify-plugin';
import postgres from '@fastify/postgres';

async function dbPlugin(fastify, options) {
  fastify.register(postgres, {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Run migrations on startup (optional)
  fastify.addHook('onReady', async () => {
    // Migration logic here
  });
}

export default fastifyPlugin(dbPlugin);
```

## Response Helpers

```javascript
// src/utils/responses.js
export const success = (data) => ({
  success: true,
  data
});

export const error = (code, message, statusCode = 400) => {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

export const notFound = (resource) =>
  error('NOT_FOUND', `${resource} not found`, 404);

export const validationError = (message) =>
  error('VALIDATION_ERROR', message, 400);
```

## Database Migrations

```javascript
// scripts/migrate.js
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function migrate() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  // Create migrations table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get executed migrations
  const executed = await pool.query('SELECT name FROM migrations');
  const executedNames = executed.rows.map(r => r.name);

  for (const file of files) {
    if (!executedNames.includes(file)) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    }
  }

  console.log('Migrations complete');
  await pool.end();
}

migrate().catch(console.error);
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/moderation

# Server
PORT=3001
HOST=0.0.0.0

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=your-secret-key-here

# Admin Setup (used for initial seeding)
ADMIN_EMAIL=admin@mascon.org
ADMIN_PASSWORD=initial-password
```

## Docker Setup

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Expose port
EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "node scripts/migrate.js && node src/app.js"]
```

## Testing

```javascript
// Example test with @fastify/testing
import { test } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import sessionRoutes from '../src/routes/sessions.js';

test('GET /sessions returns empty array initially', async () => {
  const fastify = Fastify();
  // Mock database
  fastify.decorate('pg', {
    query: async () => ({ rows: [] })
  });
  fastify.register(sessionRoutes);

  const response = await fastify.inject({
    method: 'GET',
    url: '/'
  });

  assert.strictEqual(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.success, true);
  assert.deepStrictEqual(body.data, []);
});
```

## Performance Considerations

1. **Connection Pooling**: @fastify/postgres handles connection pooling automatically
2. **Indexes**: Added on frequently queried columns (see database.md)
3. **Pagination**: Large lists should support pagination (limit/offset)
4. **Caching**: Consider adding Redis for frequently accessed data
5. **Rate Limiting**: Use @fastify/rate-limit for public endpoints
