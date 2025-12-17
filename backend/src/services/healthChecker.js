import logger from './logger.js';
import appEvents from './event-emitter.js';

const BASE_DOMAIN = process.env.BASE_DOMAIN || '192.168.1.124.nip.io';
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 60000; // 1 minute default
const HEALTH_CHECK_TIMEOUT = parseInt(process.env.HEALTH_CHECK_TIMEOUT, 10) || 5000; // 5 second timeout

/**
 * Compute the subdomain for a service
 */
function computeSubdomain(userHash, serviceName) {
  return `${userHash}-${serviceName}`;
}

/**
 * Perform an active health check against a service's health endpoint
 * @param {string} subdomain - The service subdomain
 * @param {string} healthPath - The health check path (e.g., "/health")
 * @param {number} port - The service port (used for internal routing context)
 * @returns {Promise<object>} Health check result
 */
export async function performHealthCheck(subdomain, healthPath, port) {
  const url = `http://${subdomain}.${BASE_DOMAIN}${healthPath}`;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DangusCloud-HealthCheck/1.0'
      }
    });

    clearTimeout(timeout);

    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      responseTimeMs: Date.now() - start,
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.name === 'AbortError' ? 'Timeout' : error.message,
      responseTimeMs: Date.now() - start,
      lastCheck: new Date().toISOString()
    };
  }
}

/**
 * Get health check history for a service
 * @param {object} db - Database connection
 * @param {string} serviceId - Service UUID
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Health check history
 */
export async function getHealthHistory(db, serviceId, limit = 20) {
  const result = await db.query(
    `SELECT status, status_code, response_time_ms, error, checked_at
     FROM health_checks
     WHERE service_id = $1
     ORDER BY checked_at DESC
     LIMIT $2`,
    [serviceId, limit]
  );

  return result.rows.map(row => ({
    status: row.status,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    error: row.error,
    timestamp: row.checked_at
  }));
}

/**
 * Store a health check result
 * @param {object} db - Database connection
 * @param {string} serviceId - Service UUID
 * @param {object} result - Health check result
 */
async function storeHealthCheck(db, serviceId, result) {
  await db.query(
    `INSERT INTO health_checks (service_id, status, status_code, response_time_ms, error)
     VALUES ($1, $2, $3, $4, $5)`,
    [serviceId, result.status, result.statusCode || null, result.responseTimeMs, result.error || null]
  );
}

/**
 * Clean up old health check records
 * @param {object} db - Database connection
 */
async function cleanupOldRecords(db) {
  try {
    const result = await db.query(
      `DELETE FROM health_checks WHERE checked_at < NOW() - INTERVAL '7 days'`
    );
    if (result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} old health check records`);
    }
  } catch (err) {
    logger.error(`Failed to cleanup old health checks: ${err.message}`);
  }
}

/**
 * Run health checks for all services with health check paths configured
 * @param {object} db - Database connection
 */
async function runHealthChecks(db) {
  try {
    // Get all services with health checks configured that have been deployed
    const result = await db.query(
      `SELECT s.id, s.name, s.port, s.health_check_path, u.hash as user_hash
       FROM services s
       JOIN projects p ON s.project_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE s.health_check_path IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM deployments d
         WHERE d.service_id = s.id
         AND d.status = 'live'
       )`
    );

    const services = result.rows;

    if (services.length === 0) {
      return;
    }

    logger.debug(`Running health checks for ${services.length} services`);

    for (const service of services) {
      try {
        const subdomain = computeSubdomain(service.user_hash, service.name);
        const healthResult = await performHealthCheck(
          subdomain,
          service.health_check_path,
          service.port
        );

        await storeHealthCheck(db, service.id, healthResult);

        // Emit WebSocket event for real-time health updates
        appEvents.emitServiceHealth(service.id, {
          status: healthResult.status,
          statusCode: healthResult.statusCode,
          responseTimeMs: healthResult.responseTimeMs,
          error: healthResult.error,
          lastCheck: healthResult.lastCheck
        });

        if (healthResult.status === 'unhealthy') {
          logger.warn(`Health check failed for ${service.name}: ${healthResult.error || `Status ${healthResult.statusCode}`}`);
        }
      } catch (err) {
        logger.error(`Error checking health for service ${service.name}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error(`Failed to run health checks: ${err.message}`);
  }
}

/**
 * Start the background health checker
 * @param {object} db - Database connection
 * @returns {object} Control object with stop method
 */
export function startHealthChecker(db) {
  logger.info(`Starting health checker with ${HEALTH_CHECK_INTERVAL}ms interval`);

  // Run initial health checks after a short delay
  const initialTimeout = setTimeout(() => runHealthChecks(db), 5000);

  // Set up periodic health checks
  const checkInterval = setInterval(() => runHealthChecks(db), HEALTH_CHECK_INTERVAL);

  // Clean up old records once per hour
  const cleanupInterval = setInterval(() => cleanupOldRecords(db), 3600000);

  return {
    stop() {
      clearTimeout(initialTimeout);
      clearInterval(checkInterval);
      clearInterval(cleanupInterval);
      logger.info('Health checker stopped');
    }
  };
}
