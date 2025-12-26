import { success, notFound, validationError, conflict } from '../utils/responses.js';
import { autoAssign } from '../services/assignmentService.js';

export default async function assignmentsRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/assignments
  fastify.get('/', async (request, reply) => {
    const { session_id, moderator_id, day_id } = request.query;

    let query = `
      SELECT
        a.*,
        s.name as session_name,
        s.start_time as session_start,
        s.end_time as session_end,
        ed.date,
        r.name as room_name,
        m.name as moderator_name,
        m.email as moderator_email
      FROM assignments a
      JOIN sessions s ON a.session_id = s.id
      JOIN event_days ed ON s.event_day_id = ed.id
      LEFT JOIN rooms r ON s.room_id = r.id
      JOIN moderators m ON a.moderator_id = m.id
    `;

    const conditions = [];
    const params = [];

    if (session_id) {
      params.push(session_id);
      conditions.push(`a.session_id = $${params.length}`);
    }

    if (moderator_id) {
      params.push(moderator_id);
      conditions.push(`a.moderator_id = $${params.length}`);
    }

    if (day_id) {
      params.push(day_id);
      conditions.push(`s.event_day_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY ed.date, s.start_time, m.name`;

    const result = await db.query(query, params);

    return success(result.rows);
  });

  // GET /api/assignments/session/:id
  fastify.get('/session/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(`
      SELECT
        a.*,
        m.name as moderator_name,
        m.email as moderator_email,
        m.phone as moderator_phone
      FROM assignments a
      JOIN moderators m ON a.moderator_id = m.id
      WHERE a.session_id = $1
    `, [id]);

    return success(result.rows);
  });

  // GET /api/assignments/moderator/:id
  fastify.get('/moderator/:id', async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(`
      SELECT
        a.*,
        s.name as session_name,
        s.start_time,
        s.end_time,
        s.headcount,
        s.headcount_percentage,
        s.speaker as session_speakers,
        ed.date,
        r.name as room_name,
        r.capacity as room_capacity
      FROM assignments a
      JOIN sessions s ON a.session_id = s.id
      JOIN event_days ed ON s.event_day_id = ed.id
      LEFT JOIN rooms r ON s.room_id = r.id
      WHERE a.moderator_id = $1
      ORDER BY ed.date, s.start_time
    `, [id]);

    // For each assignment, fetch speaker details with PDF links
    const assignments = await Promise.all(result.rows.map(async (row) => {
      if (row.session_speakers) {
        const speakerNames = row.session_speakers.split(';').map(s => s.trim());
        const speakersResult = await db.query(
          `SELECT name, file_url FROM speakers WHERE name = ANY($1)`,
          [speakerNames]
        );
        row.speakers = speakersResult.rows;
      } else {
        row.speakers = [];
      }
      return row;
    }));

    return success(assignments);
  });

  // POST /api/assignments/auto
  fastify.post('/auto', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { clear_existing = false, day_id = null } = request.body || {};

    const results = await autoAssign(db, {
      clearExisting: clear_existing,
      dayId: day_id
    });

    return success(results);
  });

  // POST /api/assignments/manual
  fastify.post('/manual', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { session_id, moderator_id } = request.body;

    if (!session_id || !moderator_id) {
      throw validationError('session_id and moderator_id are required');
    }

    // Check if already assigned
    const existing = await db.query(
      'SELECT id FROM assignments WHERE session_id = $1 AND moderator_id = $2',
      [session_id, moderator_id]
    );

    if (existing.rows.length > 0) {
      throw conflict('Moderator is already assigned to this session');
    }

    // Get session details
    const session = await db.query(
      'SELECT * FROM sessions WHERE id = $1',
      [session_id]
    );

    if (session.rows.length === 0) {
      throw notFound('Session');
    }

    // Get moderator details
    const moderator = await db.query(
      'SELECT * FROM moderators WHERE id = $1',
      [moderator_id]
    );

    if (moderator.rows.length === 0) {
      throw notFound('Moderator');
    }

    // Check for overlapping assignments
    const sessionData = session.rows[0];
    const overlapping = await db.query(`
      SELECT s.name
      FROM assignments a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.moderator_id = $1
        AND s.event_day_id = $2
        AND s.start_time < $3
        AND s.end_time > $4
    `, [moderator_id, sessionData.event_day_id, sessionData.end_time, sessionData.start_time]);

    let warning = null;
    if (overlapping.rows.length > 0) {
      warning = `Moderator has overlapping assignment: ${overlapping.rows[0].name}`;
    }

    // Create assignment
    const result = await db.query(
      `INSERT INTO assignments (session_id, moderator_id, assigned_by)
       VALUES ($1, $2, 'manual')
       RETURNING *`,
      [session_id, moderator_id]
    );

    reply.status(201);
    return success({
      assignment: result.rows[0],
      warning
    });
  });

  // DELETE /api/assignments/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM assignments WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Assignment');
    }

    return success({ deleted: true, id: parseInt(id) });
  });

  // DELETE /api/assignments/reset
  fastify.delete('/reset', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { day_id } = request.body || {};

    let result;
    if (day_id) {
      result = await db.query(`
        DELETE FROM assignments
        WHERE session_id IN (SELECT id FROM sessions WHERE event_day_id = $1)
        RETURNING id
      `, [day_id]);
    } else {
      result = await db.query('DELETE FROM assignments RETURNING id');
    }

    return success({
      deleted: true,
      count: result.rows.length
    });
  });
}
