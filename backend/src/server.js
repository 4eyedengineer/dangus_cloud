import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import databasePlugin from './plugins/database.js';
import authPlugin from './plugins/auth.js';
import websocketHubPlugin from './plugins/websocket-hub.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import serviceRoutes from './routes/services.js';
import deploymentRoutes from './routes/deployments.js';
import webhookRoutes from './routes/webhooks.js';
import githubRoutes from './routes/github.js';
import domainRoutes from './routes/domains.js';
import notificationRoutes from './routes/notifications.js';

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
  'HARBOR_URL',
  'HARBOR_PROJECT',
  'BASE_DOMAIN',
  'WEBHOOK_BASE_URL',
];

const authEnvVars = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL',
  'ENCRYPTION_KEY',
  'SESSION_SECRET',
];

function validateEnv() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    fastify.log.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const configured = optionalEnvVars.filter(v => process.env[v]);
  const unconfigured = optionalEnvVars.filter(v => !process.env[v]);

  // Check if auth is partially configured
  const authConfigured = authEnvVars.filter(v => process.env[v]);
  const authMissing = authEnvVars.filter(v => !process.env[v]);
  if (authConfigured.length > 0 && authMissing.length > 0) {
    fastify.log.warn(`Auth partially configured. Missing: ${authMissing.join(', ')}`);
  }

  fastify.log.info(`Environment configured: ${requiredEnvVars.length} required, ${configured.length}/${optionalEnvVars.length} optional`);
  if (unconfigured.length > 0) {
    fastify.log.warn(`Optional env vars not set: ${unconfigured.join(', ')}`);
  }
}

// Register CORS for cross-origin requests (needed for local dev)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
fastify.register(cors, {
  origin: FRONTEND_URL,
  credentials: true,
});

// Register WebSocket plugin for real-time log streaming
fastify.register(websocket);

// Register database plugin (includes migration runner)
fastify.register(databasePlugin);

// Register cookie plugin for session management
fastify.register(cookie, {
  secret: process.env.SESSION_SECRET,
  parseOptions: {},
});

// Register auth plugin (provides fastify.authenticate)
fastify.register(authPlugin);

// Register WebSocket hub plugin for real-time updates
fastify.register(websocketHubPlugin);

// Register auth routes
fastify.register(authRoutes);

// Register project routes
fastify.register(projectRoutes);

// Register service routes
fastify.register(serviceRoutes);

// Register deployment routes
fastify.register(deploymentRoutes);

// Register webhook routes (no auth required)
fastify.register(webhookRoutes);

// Register GitHub routes
fastify.register(githubRoutes);

// Register domain routes
fastify.register(domainRoutes);

// Register notification routes
fastify.register(notificationRoutes);

// Routes that do not require authentication
const publicRoutes = [
  { method: 'GET', url: '/health' },
  { method: 'GET', url: '/auth/github' },
  { method: 'GET', url: '/auth/github/callback' },
  { method: 'GET', url: '/ws' },
  { method: 'GET', url: '/ws/stats' },
];

// Apply authentication to all routes except public ones and webhooks
fastify.addHook('onRequest', async (request, reply) => {
  // Skip auth for public routes
  const isPublicRoute = publicRoutes.some(
    (route) => route.method === request.method && request.url.startsWith(route.url.split('?')[0])
  );

  if (isPublicRoute) {
    return;
  }

  // Skip auth for webhook routes
  if (request.method === 'POST' && request.url.startsWith('/webhooks/')) {
    return;
  }

  // Apply authentication
  await fastify.authenticate(request, reply);
});

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
