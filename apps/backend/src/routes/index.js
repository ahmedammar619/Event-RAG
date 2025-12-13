import adminRoutes from './admin.js';
import daysRoutes from './days.js';
import roomsRoutes from './rooms.js';
import sessionsRoutes from './sessions.js';
import moderatorsRoutes from './moderators.js';
import availabilityRoutes from './availability.js';
import assignmentsRoutes from './assignments.js';

export default async function routes(fastify, options) {
  fastify.register(adminRoutes, { prefix: '/admin' });
  fastify.register(daysRoutes, { prefix: '/days' });
  fastify.register(roomsRoutes, { prefix: '/rooms' });
  fastify.register(sessionsRoutes, { prefix: '/sessions' });
  fastify.register(moderatorsRoutes, { prefix: '/moderators' });
  fastify.register(availabilityRoutes, { prefix: '/availability' });
  fastify.register(assignmentsRoutes, { prefix: '/assignments' });
}
