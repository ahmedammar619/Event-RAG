import { success, notFound, validationError } from '../utils/responses.js';

export default async function availabilityRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/availability/moderator/:id
  fastify.get('/moderator/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(`
      SELECT
        a.*,
        ed.date,
        ed.start_time as day_start,
        ed.end_time as day_end
      FROM availability a
      JOIN event_days ed ON a.event_day_id = ed.id
      WHERE a.moderator_id = $1
      ORDER BY ed.date, a.start_time
    `, [id]);

    return success(result.rows);
  });

  // POST /api/availability
  fastify.post('/', async (request, reply) => {
    const { moderator_id, event_day_id, start_time, end_time } = request.body;

    if (!moderator_id || !event_day_id || !start_time || !end_time) {
      throw validationError('moderator_id, event_day_id, start_time, and end_time are required');
    }

    // Helper to normalize time to HH:MM format for comparison
    const normalizeTime = (time) => time ? time.slice(0, 5) : '';

    const slotStart = normalizeTime(start_time);
    const slotEnd = normalizeTime(end_time);

    if (slotStart >= slotEnd) {
      throw validationError('Start time must be before end time');
    }

    // Validate moderator exists
    const moderator = await db.query('SELECT id FROM moderators WHERE id = $1', [moderator_id]);
    if (moderator.rows.length === 0) {
      throw notFound('Moderator');
    }

    // Validate event day exists and time is within bounds
    const day = await db.query('SELECT * FROM event_days WHERE id = $1', [event_day_id]);
    if (day.rows.length === 0) {
      throw notFound('Event day');
    }

    const eventDay = day.rows[0];
    const dayStart = normalizeTime(eventDay.start_time);
    const dayEnd = normalizeTime(eventDay.end_time);

    if (slotStart < dayStart || slotEnd > dayEnd) {
      throw validationError(`Availability must be within event day hours (${dayStart} - ${dayEnd})`);
    }

    const result = await db.query(
      `INSERT INTO availability (moderator_id, event_day_id, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [moderator_id, event_day_id, start_time, end_time]
    );

    reply.status(201);
    return success(result.rows[0]);
  });

  // POST /api/availability/bulk
  fastify.post('/bulk', async (request, reply) => {
    const { moderator_id, slots } = request.body;

    if (!moderator_id || !slots || !Array.isArray(slots)) {
      throw validationError('moderator_id and slots array are required');
    }

    // Validate moderator exists
    const moderator = await db.query('SELECT id FROM moderators WHERE id = $1', [moderator_id]);
    if (moderator.rows.length === 0) {
      throw notFound('Moderator');
    }

    // Helper to normalize time to HH:MM format for comparison
    const normalizeTime = (time) => {
      if (!time) return '';
      return time.slice(0, 5); // Get just HH:MM
    };

    // Delete existing availability for this moderator
    await db.query('DELETE FROM availability WHERE moderator_id = $1', [moderator_id]);

    const created = [];
    const errors = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      try {
        // Validate event day
        const day = await db.query('SELECT * FROM event_days WHERE id = $1', [slot.event_day_id]);
        if (day.rows.length === 0) {
          throw new Error('Event day not found');
        }

        const eventDay = day.rows[0];
        const slotStart = normalizeTime(slot.start_time);
        const slotEnd = normalizeTime(slot.end_time);
        const dayStart = normalizeTime(eventDay.start_time);
        const dayEnd = normalizeTime(eventDay.end_time);

        if (slotStart < dayStart || slotEnd > dayEnd) {
          throw new Error(`Time must be within ${dayStart} - ${dayEnd}`);
        }

        const result = await db.query(
          `INSERT INTO availability (moderator_id, event_day_id, start_time, end_time)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [moderator_id, slot.event_day_id, slot.start_time, slot.end_time]
        );
        created.push(result.rows[0]);
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    reply.status(201);
    return success({ created, errors, total: created.length });
  });

  // PUT /api/availability/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { start_time, end_time } = request.body;

    if (start_time && end_time && start_time >= end_time) {
      throw validationError('Start time must be before end time');
    }

    const result = await db.query(
      `UPDATE availability
       SET start_time = COALESCE($1, start_time),
           end_time = COALESCE($2, end_time)
       WHERE id = $3
       RETURNING *`,
      [start_time, end_time, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Availability slot');
    }

    return success(result.rows[0]);
  });

  // DELETE /api/availability/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM availability WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Availability slot');
    }

    return success({ deleted: true, id: parseInt(id) });
  });
}
