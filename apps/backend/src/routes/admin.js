import bcrypt from 'bcrypt';
import { success, notFound, validationError, unauthorized } from '../utils/responses.js';

export default async function adminRoutes(fastify, options) {
  const { db } = fastify;

  // POST /api/admin/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      throw validationError('Username and password are required');
    }

    const result = await db.query(
      'SELECT * FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw unauthorized('Invalid username or password');
    }

    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.password_hash);

    if (!validPassword) {
      throw unauthorized('Invalid username or password');
    }

    const token = fastify.jwt.sign({
      id: admin.id,
      username: admin.username,
      role: 'admin'
    }, { expiresIn: '365d' });

    return success({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name
      }
    });
  });

  // GET /api/admin/dashboard
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const [moderators, sessions, assignments, days] = await Promise.all([
      db.query('SELECT COUNT(*) FROM moderators'),
      db.query('SELECT COUNT(*) FROM sessions'),
      db.query(`
        SELECT
          COUNT(DISTINCT session_id) as assigned_sessions,
          COUNT(*) as total_assignments
        FROM assignments
      `),
      db.query('SELECT COUNT(*) FROM event_days')
    ]);

    const totalSessions = parseInt(sessions.rows[0].count);
    const assignedSessions = parseInt(assignments.rows[0].assigned_sessions);

    return success({
      totalModerators: parseInt(moderators.rows[0].count),
      totalSessions,
      assignedSessions,
      unassignedSessions: totalSessions - assignedSessions,
      totalAssignments: parseInt(assignments.rows[0].total_assignments),
      eventDays: parseInt(days.rows[0].count)
    });
  });

  // GET /api/admin/me
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const result = await db.query(
      'SELECT id, username, name FROM admins WHERE id = $1',
      [request.user.id]
    );

    if (result.rows.length === 0) {
      throw notFound('Admin');
    }

    return success(result.rows[0]);
  });
}
