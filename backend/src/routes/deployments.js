import { getPodsByLabel, streamPodLogs } from '../services/kubernetes.js';

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

  /**
   * WebSocket endpoint for real-time build log streaming
   * GET /deployments/:id/logs (WebSocket upgrade)
   */
  fastify.get('/deployments/:id/logs', { websocket: true }, async (connection, request) => {
    const deploymentId = request.params.id;
    const userId = request.user?.id;

    // Verify authentication
    if (!userId) {
      connection.socket.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
      connection.socket.close(4001, 'Unauthorized');
      return;
    }

    // Verify deployment ownership
    const ownershipCheck = await verifyDeploymentOwnership(deploymentId, userId);
    if (ownershipCheck.error) {
      connection.socket.send(JSON.stringify({ type: 'error', message: ownershipCheck.error }));
      connection.socket.close(ownershipCheck.status === 404 ? 4004 : 4003, ownershipCheck.error);
      return;
    }

    const { deployment } = ownershipCheck;

    // If deployment is complete, send stored logs and close
    if (['live', 'failed'].includes(deployment.status)) {
      connection.socket.send(JSON.stringify({
        type: 'logs',
        data: deployment.build_logs || ''
      }));
      connection.socket.send(JSON.stringify({
        type: 'complete',
        status: deployment.status
      }));
      connection.socket.close(1000, 'Deployment complete');
      return;
    }

    // Get the service to find namespace info
    const serviceResult = await fastify.db.query(
      `SELECT s.*, p.name as project_name
       FROM services s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1`,
      [deployment.service_id]
    );

    if (serviceResult.rows.length === 0) {
      connection.socket.send(JSON.stringify({ type: 'error', message: 'Service not found' }));
      connection.socket.close(4004, 'Service not found');
      return;
    }

    const service = serviceResult.rows[0];
    const namespace = `dangus-${service.project_name}-${service.name}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    // Function to attempt streaming logs from the build pod
    const attemptLogStream = async () => {
      try {
        // Find the Kaniko build pod
        const jobName = `build-${deployment.id.substring(0, 8)}`;
        const pods = await getPodsByLabel(namespace, `job-name=${jobName}`);

        if (!pods.items || pods.items.length === 0) {
          // Pod not yet created, inform client and wait
          connection.socket.send(JSON.stringify({
            type: 'status',
            message: 'Waiting for build pod to start...'
          }));
          return false;
        }

        const pod = pods.items[0];
        const podPhase = pod.status?.phase;

        if (podPhase === 'Pending') {
          connection.socket.send(JSON.stringify({
            type: 'status',
            message: 'Build pod is starting...'
          }));
          return false;
        }

        // Start streaming logs
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Streaming build logs...'
        }));

        const logStream = streamPodLogs(namespace, pod.metadata.name);

        logStream.on('data', (chunk) => {
          if (connection.socket.readyState === 1) { // OPEN
            connection.socket.send(JSON.stringify({ type: 'log', data: chunk }));
          }
        });

        logStream.on('end', async () => {
          // Check final deployment status
          const finalResult = await fastify.db.query(
            'SELECT status FROM deployments WHERE id = $1',
            [deploymentId]
          );
          const finalStatus = finalResult.rows[0]?.status || 'unknown';

          if (connection.socket.readyState === 1) {
            connection.socket.send(JSON.stringify({ type: 'complete', status: finalStatus }));
            connection.socket.close(1000, 'Stream complete');
          }
        });

        logStream.on('error', (err) => {
          fastify.log.error(`Log stream error: ${err.message}`);
          if (connection.socket.readyState === 1) {
            connection.socket.send(JSON.stringify({ type: 'error', message: err.message }));
          }
        });

        // Store the stream reference for cleanup
        connection.socket.logStream = logStream;
        return true;
      } catch (err) {
        fastify.log.error(`Error setting up log stream: ${err.message}`);
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: `Failed to stream logs: ${err.message}`
        }));
        return false;
      }
    };

    // Try to start streaming, with retries for pending pod
    let streaming = await attemptLogStream();
    let retryCount = 0;
    const maxRetries = 30; // 30 retries * 2 seconds = 60 seconds max wait

    const retryInterval = setInterval(async () => {
      if (streaming || retryCount >= maxRetries) {
        clearInterval(retryInterval);
        if (!streaming && retryCount >= maxRetries) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'Timed out waiting for build pod'
          }));
          connection.socket.close(4008, 'Timeout');
        }
        return;
      }

      retryCount++;

      // Check if deployment status has changed
      const statusCheck = await fastify.db.query(
        'SELECT status, build_logs FROM deployments WHERE id = $1',
        [deploymentId]
      );
      const currentStatus = statusCheck.rows[0]?.status;

      if (['live', 'failed'].includes(currentStatus)) {
        clearInterval(retryInterval);
        connection.socket.send(JSON.stringify({
          type: 'logs',
          data: statusCheck.rows[0]?.build_logs || ''
        }));
        connection.socket.send(JSON.stringify({
          type: 'complete',
          status: currentStatus
        }));
        connection.socket.close(1000, 'Deployment complete');
        return;
      }

      streaming = await attemptLogStream();
    }, 2000);

    // Clean up on close
    connection.socket.on('close', () => {
      clearInterval(retryInterval);
      if (connection.socket.logStream) {
        connection.socket.logStream.destroy();
      }
    });
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
