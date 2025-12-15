#!/usr/bin/env node
/**
 * Standalone migration runner script
 * Usage: node src/migrate.js
 *
 * Set DATABASE_URL environment variable before running.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err?.message || ''),
};

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const migrationsDir = path.join(__dirname, '../migrations');

  try {
    // Test connection
    const client = await pool.connect();
    logger.info('Connected to PostgreSQL');
    client.release();

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

    if (files.length === 0) {
      logger.info('No migration files found');
      return;
    }

    // Apply pending migrations
    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.info(`Already applied: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      logger.info(`Applying migration: ${file}`);

      const migrationClient = await pool.connect();
      try {
        await migrationClient.query('BEGIN');
        await migrationClient.query(sql);
        await migrationClient.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await migrationClient.query('COMMIT');
        logger.info(`Applied successfully: ${file}`);
        appliedCount++;
      } catch (err) {
        await migrationClient.query('ROLLBACK');
        logger.error(`Migration failed: ${file}`, err);
        throw err;
      } finally {
        migrationClient.release();
      }
    }

    if (appliedCount === 0) {
      logger.info('All migrations already applied');
    } else {
      logger.info(`Applied ${appliedCount} migration(s)`);
    }
  } catch (err) {
    logger.error('Migration error', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
