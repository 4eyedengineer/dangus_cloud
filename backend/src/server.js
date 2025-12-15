import Fastify from 'fastify';
import databasePlugin from './plugins/database.js';

const fastify = Fastify({
  logger: true,
});

// Environment variable validation
const requiredEnvVars = [
  'DATABASE_URL',
];

const optionalEnvVars = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL',
  'ENCRYPTION_KEY',
  'SESSION_SECRET',
  'HARBOR_URL',
  'HARBOR_PROJECT',
  'BASE_DOMAIN',
  'WEBHOOK_BASE_URL',
];

function validateEnv() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    fastify.log.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const configured = optionalEnvVars.filter(v => process.env[v]);
  const unconfigured = optionalEnvVars.filter(v => !process.env[v]);

  fastify.log.info(`Environment configured: ${requiredEnvVars.length} required, ${configured.length}/${optionalEnvVars.length} optional`);
  if (unconfigured.length > 0) {
    fastify.log.warn(`Optional env vars not set: ${unconfigured.join(', ')}`);
  }
}

// Register database plugin (includes migration runner)
fastify.register(databasePlugin);

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    validateEnv();
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
