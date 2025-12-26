import adminRoutes from './admin.js';
import daysRoutes from './days.js';
import roomsRoutes from './rooms.js';
import sessionsRoutes from './sessions.js';
import moderatorsRoutes from './moderators.js';
import availabilityRoutes from './availability.js';
import assignmentsRoutes from './assignments.js';
import analyticsRoutes from './analytics.js';
import visitorsRoutes from './visitors.js';
import aiRoutes from './ai.js';
import speakersRoutes from './speakers.js';
import headcountRoutes from './headcount.js';
import exportRoutes from './export.js';

export default async function routes(fastify, options) {
  fastify.register(adminRoutes, { prefix: '/admin' });
  fastify.register(daysRoutes, { prefix: '/days' });
  fastify.register(roomsRoutes, { prefix: '/rooms' });
  fastify.register(sessionsRoutes, { prefix: '/sessions' });
  fastify.register(moderatorsRoutes, { prefix: '/moderators' });
  fastify.register(availabilityRoutes, { prefix: '/availability' });
  fastify.register(assignmentsRoutes, { prefix: '/assignments' });
  fastify.register(analyticsRoutes, { prefix: '/analytics' });
  fastify.register(visitorsRoutes, { prefix: '/visitors' });
  fastify.register(aiRoutes, { prefix: '/ai' });
  fastify.register(speakersRoutes, { prefix: '/speakers' });
  fastify.register(headcountRoutes, { prefix: '/headcount' });
  fastify.register(exportRoutes, { prefix: '/export' });
}
