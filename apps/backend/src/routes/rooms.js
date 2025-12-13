import { success, notFound, validationError } from '../utils/responses.js';

export default async function roomsRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/rooms
  fastify.get('/', async (request, reply) => {
    const result = await db.query(`
      SELECT
        r.*,
        (SELECT COUNT(*) FROM sessions WHERE room_id = r.id) as session_count
      FROM rooms r
      ORDER BY r.name ASC
    `);

    return success(result.rows);
  });

  // GET /api/rooms/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'SELECT * FROM rooms WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Room');
    }

    return success(result.rows[0]);
  });

  // POST /api/rooms
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { name, capacity } = request.body;

    if (!name) {
      throw validationError('Room name is required');
    }

    const result = await db.query(
      `INSERT INTO rooms (name, capacity)
       VALUES ($1, $2)
       RETURNING *`,
      [name, capacity || null]
    );

    reply.status(201);
    return success(result.rows[0]);
  });

  // PUT /api/rooms/:id
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, capacity } = request.body;

    const result = await db.query(
      `UPDATE rooms
       SET name = COALESCE($1, name),
           capacity = COALESCE($2, capacity)
       WHERE id = $3
       RETURNING *`,
      [name, capacity, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Room');
    }

    return success(result.rows[0]);
  });

  // DELETE /api/rooms/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM rooms WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Room');
    }

    return success({ deleted: true, id: parseInt(id) });
  });
}
