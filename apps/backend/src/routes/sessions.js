import { success, notFound, validationError } from '../utils/responses.js';

export default async function sessionsRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/sessions
  fastify.get('/', async (request, reply) => {
    const { day_id, room_id, assigned } = request.query;

    let query = `
      SELECT
        s.*,
        r.name as room_name,
        r.capacity as room_capacity,
        ed.date,
        COALESCE(
          json_agg(
            json_build_object('id', m.id, 'name', m.name, 'assignment_id', a.id)
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

    query += ` GROUP BY s.id, r.name, r.capacity, ed.date ORDER BY ed.date, s.start_time`;

    const result = await db.query(query, params);

    let data = result.rows;

    // Filter by assignment status if requested
    if (assigned === 'true') {
      data = data.filter(s => s.assigned_moderators.length > 0);
    } else if (assigned === 'false') {
      data = data.filter(s => s.assigned_moderators.length === 0);
    }

    return success(data);
  });

  // GET /api/sessions/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(`
      SELECT
        s.*,
        r.name as room_name,
        ed.date,
        COALESCE(
          json_agg(
            json_build_object('id', m.id, 'name', m.name, 'email', m.email, 'assignment_id', a.id)
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as assigned_moderators
      FROM sessions s
      LEFT JOIN rooms r ON s.room_id = r.id
      LEFT JOIN event_days ed ON s.event_day_id = ed.id
      LEFT JOIN assignments a ON s.id = a.session_id
      LEFT JOIN moderators m ON a.moderator_id = m.id
      WHERE s.id = $1
      GROUP BY s.id, r.name, ed.date
    `, [id]);

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success(result.rows[0]);
  });

  // POST /api/sessions
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { name, event_day_id, room_id, start_time, end_time, moderators_needed } = request.body;

    if (!name || !event_day_id || !start_time || !end_time) {
      throw validationError('Name, event_day_id, start_time, and end_time are required');
    }

    if (start_time >= end_time) {
      throw validationError('Start time must be before end time');
    }

    // Validate time is within event day hours
    const dayResult = await db.query(
      'SELECT * FROM event_days WHERE id = $1',
      [event_day_id]
    );

    if (dayResult.rows.length === 0) {
      throw notFound('Event day');
    }

    const day = dayResult.rows[0];
    if (start_time < day.start_time || end_time > day.end_time) {
      throw validationError(`Session time must be within event day hours (${day.start_time} - ${day.end_time})`);
    }

    const result = await db.query(
      `INSERT INTO sessions (name, event_day_id, room_id, start_time, end_time, moderators_needed)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, event_day_id, room_id || null, start_time, end_time, moderators_needed || 1]
    );

    reply.status(201);
    return success(result.rows[0]);
  });

  // PUT /api/sessions/:id
  fastify.put('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, event_day_id, room_id, start_time, end_time, moderators_needed } = request.body;

    const result = await db.query(
      `UPDATE sessions
       SET name = COALESCE($1, name),
           event_day_id = COALESCE($2, event_day_id),
           room_id = COALESCE($3, room_id),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           moderators_needed = COALESCE($6, moderators_needed)
       WHERE id = $7
       RETURNING *`,
      [name, event_day_id, room_id, start_time, end_time, moderators_needed, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success(result.rows[0]);
  });

  // PATCH /api/sessions/:id/headcount
  fastify.patch('/:id/headcount', async (request, reply) => {
    const { id } = request.params;
    const { headcount, headcount_percentage } = request.body;

    // Either headcount or headcount_percentage must be provided
    if (headcount === undefined && headcount_percentage === undefined) {
      throw validationError('Either headcount or headcount_percentage is required');
    }

    // If percentage is provided, clear headcount and set percentage
    // If headcount is provided, clear percentage and set headcount
    let result;
    if (headcount_percentage !== undefined) {
      if (headcount_percentage < 0 || headcount_percentage > 100) {
        throw validationError('Percentage must be between 0 and 100');
      }
      result = await db.query(
        'UPDATE sessions SET headcount = NULL, headcount_percentage = $1 WHERE id = $2 RETURNING *',
        [headcount_percentage, id]
      );
    } else {
      if (headcount < 0) {
        throw validationError('Headcount must be 0 or greater');
      }
      result = await db.query(
        'UPDATE sessions SET headcount = $1, headcount_percentage = NULL WHERE id = $2 RETURNING *',
        [headcount, id]
      );
    }

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success(result.rows[0]);
  });

  // DELETE /api/sessions/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM sessions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Session');
    }

    return success({ deleted: true, id: parseInt(id) });
  });

  // POST /api/sessions/bulk
  fastify.post('/bulk', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { sessions } = request.body;

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      throw validationError('Sessions array is required');
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      try {
        const result = await db.query(
          `INSERT INTO sessions (name, event_day_id, room_id, start_time, end_time, moderators_needed)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            session.name,
            session.event_day_id,
            session.room_id || null,
            session.start_time,
            session.end_time,
            session.moderators_needed || 1
          ]
        );
        created.push(result.rows[0]);
      } catch (err) {
        errors.push({ index: i, session: session.name, error: err.message });
      }
    }

    reply.status(201);
    return success({ created, errors, total: created.length });
  });
}
