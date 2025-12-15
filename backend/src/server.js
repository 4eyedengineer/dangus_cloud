import Fastify from 'fastify';
import databasePlugin from './plugins/database.js';

const fastify = Fastify({
  logger: true,
});

// Register database plugin (includes migration runner)
fastify.register(databasePlugin);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
