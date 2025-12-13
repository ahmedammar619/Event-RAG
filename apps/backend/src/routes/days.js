import { success, notFound, validationError, conflict } from '../utils/responses.js';

export default async function daysRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/days
  fastify.get('/', async (request, reply) => {
    const result = await db.query(`
      SELECT
        ed.*,
        (SELECT COUNT(*) FROM sessions WHERE event_day_id = ed.id) as session_count
      FROM event_days ed
      ORDER BY ed.date ASC
    `);

    return success(result.rows);
  });

  // GET /api/days/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'SELECT * FROM event_days WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Event day');
    }

    return success(result.rows[0]);
  });

  // POST /api/days
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { date, start_time, end_time } = request.body;

    if (!date || !start_time || !end_time) {
      throw validationError('Date, start_time, and end_time are required');
    }

    if (start_time >= end_time) {
      throw validationError('Start time must be before end time');
    }

    // Check for duplicate date
    const existing = await db.query(
      'SELECT id FROM event_days WHERE date = $1',
      [date]
    );

    if (existing.rows.length > 0) {
      throw conflict('An event day with this date already exists');
    }

    const result = await db.query(
      `INSERT INTO event_days (date, start_time, end_time)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [date, start_time, end_time]
    );

    reply.status(201);
    return success(result.rows[0]);
  });

  // PUT /api/days/:id
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { date, start_time, end_time } = request.body;

    if (start_time && end_time && start_time >= end_time) {
      throw validationError('Start time must be before end time');
    }

    // Check for duplicate date (excluding current record)
    if (date) {
      const existing = await db.query(
        'SELECT id FROM event_days WHERE date = $1 AND id != $2',
        [date, id]
      );

      if (existing.rows.length > 0) {
        throw conflict('An event day with this date already exists');
      }
    }

    const result = await db.query(
      `UPDATE event_days
       SET date = COALESCE($1, date),
           start_time = COALESCE($2, start_time),
           end_time = COALESCE($3, end_time)
       WHERE id = $4
       RETURNING *`,
      [date, start_time, end_time, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Event day');
    }

    return success(result.rows[0]);
  });

  // DELETE /api/days/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM event_days WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Event day');
    }

    return success({ deleted: true, id: parseInt(id) });
  });
}
