import fastifyPlugin from 'fastify-plugin';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(pool, logger) {
  const migrationsDir = path.join(__dirname, '../../migrations');

  // Create migrations tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Get list of applied migrations
  const { rows: appliedMigrations } = await pool.query(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  const appliedSet = new Set(appliedMigrations.map(m => m.filename));

  // Get all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Apply pending migrations
  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info(`Migration already applied: ${file}`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    logger.info(`Applying migration: ${file}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      logger.info(`Migration applied successfully: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${file}`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  logger.info('All migrations completed');
}

async function databasePlugin(fastify, options) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Test connection
  try {
    const client = await pool.connect();
    fastify.log.info('Connected to PostgreSQL');
    client.release();
  } catch (err) {
    fastify.log.error('Failed to connect to PostgreSQL:', err.message);
    throw err;
  }

  // Run migrations on startup
  if (process.env.RUN_MIGRATIONS !== 'false') {
    await runMigrations(pool, fastify.log);
  }

  // Decorate fastify with db
  fastify.decorate('db', {
    query: (text, params) => pool.query(text, params),
    pool,
  });

  // Cleanup on close
  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}

export default fastifyPlugin(databasePlugin);
