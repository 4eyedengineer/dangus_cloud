import fastifyPlugin from 'fastify-plugin';

/**
 * Authentication middleware plugin for Fastify
 *
 * Provides:
 * - fastify.authenticate - preHandler hook to validate session and attach user to request
 *
 * @typedef {Object} User
 * @property {number} id - User ID
 * @property {string} github_username - GitHub username
 * @property {string} hash - User hash
 * @property {Date} created_at - Account creation timestamp
 */

async function authPlugin(fastify, options) {
  /**
   * Authenticate preHandler hook
   * Validates session cookie and attaches user to request
   * Returns 401 if not authenticated
   *
   * @param {import('fastify').FastifyRequest} request
   * @param {import('fastify').FastifyReply} reply
   */
  async function authenticate(request, reply) {
    const sessionCookie = request.cookies.session;

    if (!sessionCookie) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No session found',
      });
    }

    // Verify signed cookie
    const unsignedCookie = request.unsignCookie(sessionCookie);
    if (!unsignedCookie.valid || !unsignedCookie.value) {
      reply.clearCookie('session', { path: '/' });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid session',
      });
    }

    const userId = unsignedCookie.value;

    try {
      const result = await fastify.db.query(
        'SELECT id, github_username, hash, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        reply.clearCookie('session', { path: '/' });
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      // Attach user to request
      request.user = result.rows[0];
    } catch (err) {
      fastify.log.error(`Authentication error: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    }
  }

  // Decorate fastify with authenticate hook
  fastify.decorate('authenticate', authenticate);
}

export default fastifyPlugin(authPlugin, {
  name: 'auth',
  dependencies: ['@fastify/cookie', 'database'],
});
