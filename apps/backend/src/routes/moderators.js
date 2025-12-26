import { success, notFound, validationError, conflict } from '../utils/responses.js';

export default async function moderatorsRoutes(fastify, options) {
  const { db } = fastify;

  // GET /api/moderators
  fastify.get('/', async (request, reply) => {
    const result = await db.query(`
      SELECT
        m.*,
        COALESCE(
          (SELECT SUM(EXTRACT(EPOCH FROM (a.end_time - a.start_time)) / 3600)
           FROM availability a WHERE a.moderator_id = m.id), 0
        ) as total_availability_hours,
        (SELECT COUNT(*) FROM assignments WHERE moderator_id = m.id) as assignment_count
      FROM moderators m
      ORDER BY m.created_at DESC
    `);

    return success(result.rows);
  });

  // GET /api/moderators/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;

    const moderatorResult = await db.query(
      'SELECT * FROM moderators WHERE id = $1',
      [id]
    );

    if (moderatorResult.rows.length === 0) {
      throw notFound('Moderator');
    }

    const [availabilityResult, assignmentsResult] = await Promise.all([
      db.query(`
        SELECT a.*, ed.date
        FROM availability a
        JOIN event_days ed ON a.event_day_id = ed.id
        WHERE a.moderator_id = $1
        ORDER BY ed.date, a.start_time
      `, [id]),
      db.query(`
        SELECT
          a.id as assignment_id,
          s.id as session_id,
          s.name as session_name,
          s.start_time,
          s.end_time,
          ed.date,
          r.name as room_name
        FROM assignments a
        JOIN sessions s ON a.session_id = s.id
        JOIN event_days ed ON s.event_day_id = ed.id
        LEFT JOIN rooms r ON s.room_id = r.id
        WHERE a.moderator_id = $1
        ORDER BY ed.date, s.start_time
      `, [id])
    ]);

    return success({
      ...moderatorResult.rows[0],
      availability: availabilityResult.rows,
      assignments: assignmentsResult.rows
    });
  });

  // POST /api/moderators/register
  fastify.post('/register', async (request, reply) => {
    const { name, email, phone, schedule_preference } = request.body;

    if (!name || !email) {
      throw validationError('Name and email are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw validationError('Invalid email format');
    }

    // Validate schedule_preference if provided
    const validPreferences = ['consecutive', 'spread_out', 'no_preference'];
    const preference = schedule_preference && validPreferences.includes(schedule_preference)
      ? schedule_preference
      : 'no_preference';

    // Check for duplicate email
    const existing = await db.query(
      'SELECT id FROM moderators WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      throw conflict('A moderator with this email already exists');
    }

    const result = await db.query(
      `INSERT INTO moderators (name, email, phone, schedule_preference)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email.toLowerCase(), phone || null, preference]
    );

    const moderator = result.rows[0];

    // Generate a simple token for the moderator
    const token = fastify.jwt.sign({
      id: moderator.id,
      email: moderator.email,
      role: 'moderator'
    });

    reply.status(201);
    return success({
      ...moderator,
      token
    });
  });

  // GET /api/moderators/by-email/:email
  fastify.get('/by-email/:email', async (request, reply) => {
    const { email } = request.params;

    const result = await db.query(
      'SELECT * FROM moderators WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw notFound('Moderator');
    }

    const moderator = result.rows[0];

    // Generate token for returning moderator
    const token = fastify.jwt.sign({
      id: moderator.id,
      email: moderator.email,
      role: 'moderator'
    });

    return success({
      ...moderator,
      token
    });
  });

  // GET /api/moderators/by-phone/:phone
  fastify.get('/by-phone/:phone', async (request, reply) => {
    const { phone } = request.params;

    // Normalize phone number - extract just digits for comparison
    const phoneDigits = phone.replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      throw validationError('Invalid phone number format');
    }

    // Search by phone, comparing normalized digits
    const result = await db.query(
      `SELECT * FROM moderators WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') = $1`,
      [phoneDigits]
    );

    if (result.rows.length === 0) {
      throw notFound('Moderator');
    }

    const moderator = result.rows[0];

    // Generate token for returning moderator
    const token = fastify.jwt.sign({
      id: moderator.id,
      email: moderator.email,
      role: 'moderator'
    });

    return success({
      ...moderator,
      token
    });
  });

  // PUT /api/moderators/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const { name, email, phone, schedule_preference } = request.body;

    // Validate schedule_preference if provided
    const validPreferences = ['consecutive', 'spread_out', 'no_preference'];
    const preference = schedule_preference && validPreferences.includes(schedule_preference)
      ? schedule_preference
      : null;

    const result = await db.query(
      `UPDATE moderators
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           schedule_preference = COALESCE($4, schedule_preference)
       WHERE id = $5
       RETURNING *`,
      [name, email?.toLowerCase(), phone, preference, id]
    );

    if (result.rows.length === 0) {
      throw notFound('Moderator');
    }

    return success(result.rows[0]);
  });

  // DELETE /api/moderators/:id
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.query(
      'DELETE FROM moderators WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw notFound('Moderator');
    }

    return success({ deleted: true, id: parseInt(id) });
  });
}
