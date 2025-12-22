import { success, notFound, validationError, conflict } from '../utils/responses.js';

export default async function visitorsRoutes(fastify, options) {
  const { ragDb } = fastify;

  // Check if RAG database is available
  if (!ragDb) {
    fastify.log.warn('RAG database not available, visitor routes disabled');
    return;
  }

  // POST /api/visitors/register
  fastify.post('/register', async (request, reply) => {
    const { name, email } = request.body;

    if (!name || !email) {
      throw validationError('Name and email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw validationError('Invalid email format');
    }

    // Check for duplicate email
    const existing = await ragDb.query(
      'SELECT id FROM visitors WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      throw conflict('A visitor with this email already exists. Please use login instead.');
    }

    const result = await ragDb.query(
      `INSERT INTO visitors (name, email)
       VALUES ($1, $2)
       RETURNING *`,
      [name, email.toLowerCase()]
    );

    const visitor = result.rows[0];

    // Generate JWT token
    const token = fastify.jwt.sign({
      id: visitor.id,
      email: visitor.email,
      role: 'visitor'
    });

    reply.status(201);
    return success({
      ...visitor,
      token
    });
  });

  // POST /api/visitors/login
  fastify.post('/login', async (request, reply) => {
    const { email } = request.body;

    if (!email) {
      throw validationError('Email is required');
    }

    const result = await ragDb.query(
      'SELECT * FROM visitors WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw notFound('Visitor');
    }

    const visitor = result.rows[0];

    // Generate JWT token
    const token = fastify.jwt.sign({
      id: visitor.id,
      email: visitor.email,
      role: 'visitor'
    });

    return success({
      ...visitor,
      token
    });
  });

  // GET /api/visitors/me - Get current visitor info
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id, role } = request.user;

    if (role !== 'visitor') {
      throw validationError('Invalid token type');
    }

    const result = await ragDb.query(
      'SELECT * FROM visitors WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Visitor');
    }

    return success(result.rows[0]);
  });

  // GET /api/visitors/:id - Get visitor by ID (admin only)
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    // Only allow admins to view other visitors
    if (request.user.role !== 'admin' && request.user.id !== parseInt(id)) {
      throw validationError('Not authorized');
    }

    const result = await ragDb.query(
      'SELECT * FROM visitors WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Visitor');
    }

    return success(result.rows[0]);
  });

  // GET /api/visitors - List all visitors (admin only)
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    if (request.user.role !== 'admin') {
      throw validationError('Admin access required');
    }

    const result = await ragDb.query(
      'SELECT * FROM visitors ORDER BY created_at DESC'
    );

    return success(result.rows);
  });
}
