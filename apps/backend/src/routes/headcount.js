import { success, notFound, validationError } from '../utils/responses.js';

export default async function headcountRoutes(fastify, options) {
  const { ragDb } = fastify;

  // GET /api/headcount/sessions - Get all sessions for headcount tracking
  fastify.get('/sessions', async (request, reply) => {
    const { date, room, search, period } = request.query;

    let query = `
      SELECT
        id, date, time_start, time_end, title, room, speakers,
        headcount, headcount_percentage, room_capacity,
        session_type, track
      FROM sessions
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (room) {
      query += ` AND room ILIKE $${paramIndex}`;
      params.push(`%${room}%`);
      paramIndex++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR speakers ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY date, time_start, room`;

    const result = await ragDb.query(query, params);
    return success(result.rows);
  });

  // GET /api/headcount/rooms - Get unique room names
  fastify.get('/rooms', async (request, reply) => {
    const result = await ragDb.query(`
      SELECT DISTINCT room
      FROM sessions
      WHERE room IS NOT NULL AND room != ''
      ORDER BY room
    `);
    return success(result.rows.map(r => r.room));
  });

  // GET /api/headcount/dates - Get unique dates
  fastify.get('/dates', async (request, reply) => {
    const result = await ragDb.query(`
      SELECT DISTINCT date
      FROM sessions
      ORDER BY date
    `);
    return success(result.rows.map(r => r.date));
  });

  // PATCH /api/headcount/sessions/:id - Update session headcount
  fastify.patch('/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    const { headcount, headcount_percentage } = request.body;

    if (headcount === undefined && headcount_percentage === undefined) {
      throw validationError('Either headcount or headcount_percentage is required');
    }

    let result;
    if (headcount_percentage !== undefined) {
      if (headcount_percentage < 0 || headcount_percentage > 100) {
        throw validationError('Percentage must be between 0 and 100');
      }
      result = await ragDb.query(
        'UPDATE sessions SET headcount = NULL, headcount_percentage = $1 WHERE id = $2 RETURNING *',
        [headcount_percentage, id]
      );
    } else {
      if (headcount < 0) {
        throw validationError('Headcount must be 0 or greater');
      }
      result = await ragDb.query(
        'UPDATE sessions SET headcount = $1, headcount_percentage = NULL WHERE id = $2 RETURNING *',
        [headcount, id]
      );
    }

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success(result.rows[0]);
  });

  // PATCH /api/headcount/sessions/:id/capacity - Update room capacity
  fastify.patch('/sessions/:id/capacity', async (request, reply) => {
    const { id } = request.params;
    const { room_capacity } = request.body;

    if (room_capacity === undefined || room_capacity < 0) {
      throw validationError('Valid room capacity is required');
    }

    const result = await ragDb.query(
      'UPDATE sessions SET room_capacity = $1 WHERE id = $2 RETURNING *',
      [room_capacity, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success(result.rows[0]);
  });
}
