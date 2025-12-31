/**
 * Deployment service - shared deployment operations used by routes and services
 */

const DEPLOYMENT_STATUSES = ['pending', 'building', 'deploying', 'live', 'failed'];

/**
 * Helper to get the latest deployment for a service
 * @param {object} db - Database connection
 * @param {string} serviceId - Service UUID
 * @returns {object|null} Latest deployment or null
 */
export async function getLatestDeployment(db, serviceId) {
  const result = await db.query(
    `SELECT id, commit_sha, status, image_tag, build_logs, created_at
     FROM deployments
     WHERE service_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [serviceId]
  );

  return result.rows[0] || null;
}

/**
 * Helper to update deployment status (used by build pipeline)
 * @param {object} db - Database connection
 * @param {string} deploymentId - Deployment UUID
 * @param {string} status - New status (pending, building, deploying, live, failed)
 * @param {object} extras - Optional additional fields to update
 * @param {string} extras.build_logs - Build logs to append/set
 * @param {string} extras.image_tag - Docker image tag
 * @returns {object} Updated deployment
 */
export async function updateDeploymentStatus(db, deploymentId, status, extras = {}) {
  if (!DEPLOYMENT_STATUSES.includes(status)) {
    throw new Error(`Invalid deployment status: ${status}. Must be one of: ${DEPLOYMENT_STATUSES.join(', ')}`);
  }

  const { build_logs, image_tag } = extras;

  const setClauses = ['status = $1'];
  const values = [status];
  let paramIndex = 2;

  if (build_logs !== undefined) {
    setClauses.push(`build_logs = $${paramIndex}`);
    values.push(build_logs);
    paramIndex++;
  }

  if (image_tag !== undefined) {
    setClauses.push(`image_tag = $${paramIndex}`);
    values.push(image_tag);
    paramIndex++;
  }

  values.push(deploymentId);

  const result = await db.query(
    `UPDATE deployments
     SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING id, service_id, commit_sha, status, image_tag, build_logs, created_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new Error(`Deployment not found: ${deploymentId}`);
  }

  return result.rows[0];
}
