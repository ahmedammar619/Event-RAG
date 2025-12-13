import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { dbPlugin } from './plugins/db.js';
import { authPlugin } from './plugins/auth.js';
import routes from './routes/index.js';

// Load .env file (try multiple paths for different environments)
dotenv.config();
dotenv.config({ path: '.env' });
dotenv.config({ path: '../../.env' });

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
