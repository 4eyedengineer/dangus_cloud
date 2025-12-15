const DEPLOYMENT_STATUSES = ['pending', 'building', 'deploying', 'live', 'failed'];
const DEFAULT_PAGE_LIMIT = 20;

export default async function deploymentRoutes(fastify, options) {
  const deploymentParamsSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  };

  const serviceDeploymentsParamsSchema = {
    params: {
      type: 'object',
      required: ['serviceId'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
      },
    },
  };

  const paginationQuerySchema = {
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100, default: DEFAULT_PAGE_LIMIT },
        offset: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  };

  /**
   * Helper function to verify service ownership through project
   */
  async function verifyServiceOwnership(serviceId, userId) {
    const result = await fastify.db.query(
      `SELECT s.*, p.user_id, p.name as project_name
       FROM services s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1`,
      [serviceId]
    );

    if (result.rows.length === 0) {
      return { error: 'Service not found', status: 404 };
    }

    const service = result.rows[0];
    if (service.user_id !== userId) {
      return { error: 'Access denied', status: 403 };
    }

    return { service };
  }

  /**
   * Helper function to verify deployment ownership through service -> project
   */
  async function verifyDeploymentOwnership(deploymentId, userId) {
    const result = await fastify.db.query(
      `SELECT d.*, s.name as service_name, p.user_id
       FROM deployments d
       JOIN services s ON d.service_id = s.id
       JOIN projects p ON s.project_id = p.id
       WHERE d.id = $1`,
      [deploymentId]
    );

    if (result.rows.length === 0) {
      return { error: 'Deployment not found', status: 404 };
    }

    const deployment = result.rows[0];
    if (deployment.user_id !== userId) {
      return { error: 'Access denied', status: 403 };
    }

    return { deployment };
  }

  /**
   * GET /services/:serviceId/deployments
   * List deployment history for a service
   */
  fastify.get('/services/:serviceId/deployments', {
    schema: { ...serviceDeploymentsParamsSchema, ...paginationQuerySchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;
    const { limit = DEFAULT_PAGE_LIMIT, offset = 0 } = request.query;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      // Get deployments with pagination
      const result = await fastify.db.query(
        `SELECT id, commit_sha, status, image_tag, created_at
         FROM deployments
         WHERE service_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [serviceId, limit, offset]
      );

      // Get total count for pagination
      const countResult = await fastify.db.query(
        'SELECT COUNT(*) as total FROM deployments WHERE service_id = $1',
        [serviceId]
      );

      const total = parseInt(countResult.rows[0].total, 10);

      return {
        deployments: result.rows,
        pagination: {
          total,
          limit,
          offset,
          has_more: offset + result.rows.length < total,
        },
      };
    } catch (err) {
      fastify.log.error(`Failed to list deployments: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list deployments',
      });
    }
  });

  /**
   * GET /deployments/:id
   * Get deployment details including full build logs
   */
  fastify.get('/deployments/:id', { schema: deploymentParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const deploymentId = request.params.id;

    // Verify ownership through service -> project
    const ownershipCheck = await verifyDeploymentOwnership(deploymentId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { deployment } = ownershipCheck;

    return {
      id: deployment.id,
      service_id: deployment.service_id,
      service_name: deployment.service_name,
      commit_sha: deployment.commit_sha,
      status: deployment.status,
      image_tag: deployment.image_tag,
      build_logs: deployment.build_logs,
      created_at: deployment.created_at,
    };
  });
}

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
