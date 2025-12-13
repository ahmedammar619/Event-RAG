import fp from 'fastify-plugin';

async function authPlugin(fastify, options) {
  // Decorator to verify JWT token
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
  });

  // Decorator to optionally verify JWT (doesn't fail if no token)
  fastify.decorate('optionalAuth', async function(request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      // Token is optional, continue without user
      request.user = null;
    }
  });
}

export { authPlugin };
export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/jwt']
});
