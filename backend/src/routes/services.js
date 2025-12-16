import { generateWebhookSecret } from '../services/encryption.js';
import { deleteDeployment, deleteService, deleteIngress, deletePVC } from '../services/kubernetes.js';
import { getLatestCommit } from '../services/github.js';
import { decrypt, encrypt } from '../services/encryption.js';

const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 63;

function validateServiceName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters` };
  }

  if (!NAME_REGEX.test(trimmedName)) {
    return { valid: false, error: 'Name must be lowercase, start with a letter, and contain only alphanumeric characters and hyphens' };
  }

  if (trimmedName.includes('--')) {
    return { valid: false, error: 'Name cannot contain consecutive hyphens' };
  }

  return { valid: true, name: trimmedName };
}

const ENV_VAR_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

function validateEnvVarKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'Key is required' };
  }

  const trimmedKey = key.trim();

  if (trimmedKey.length === 0 || trimmedKey.length > 255) {
    return { valid: false, error: 'Key must be between 1 and 255 characters' };
  }

  if (!ENV_VAR_KEY_REGEX.test(trimmedKey)) {
    return { valid: false, error: 'Key must be uppercase, start with a letter, and contain only alphanumeric characters and underscores' };
  }

  return { valid: true, key: trimmedKey };
}

const MASKED_VALUE = '••••••••';

function computeSubdomain(userHash, serviceName) {
  return `${userHash}-${serviceName}`;
}

function computeWebhookUrl(serviceId) {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001/webhooks/github';
  return `${baseUrl}/${serviceId}`;
}

function computeNamespace(userHash, projectName) {
  return `${userHash}-${projectName}`;
}

export default async function serviceRoutes(fastify, options) {
  const createServiceSchema = {
    body: {
      type: 'object',
      required: ['name', 'repo_url', 'port'],
      properties: {
        name: { type: 'string' },
        repo_url: { type: 'string' },
        branch: { type: 'string', default: 'main' },
        dockerfile_path: { type: 'string', default: 'Dockerfile' },
        port: { type: 'integer', minimum: 1, maximum: 65535 },
        replicas: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
        storage_gb: { type: 'integer', minimum: 1, maximum: 10 },
        health_check_path: { type: 'string' },
      },
    },
  };

  const serviceParamsSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  };

  const projectParamsSchema = {
    params: {
      type: 'object',
      required: ['projectId'],
      properties: {
        projectId: { type: 'string', format: 'uuid' },
      },
    },
  };

  const updateServiceSchema = {
    body: {
      type: 'object',
      properties: {
        branch: { type: 'string' },
        dockerfile_path: { type: 'string' },
        port: { type: 'integer', minimum: 1, maximum: 65535 },
        replicas: { type: 'integer', minimum: 1, maximum: 3 },
        storage_gb: { type: 'integer', minimum: 1, maximum: 10 },
        health_check_path: { type: 'string' },
      },
      additionalProperties: false,
    },
  };

  /**
   * Helper function to verify project ownership
   */
  async function verifyProjectOwnership(projectId, userId) {
    const result = await fastify.db.query(
      'SELECT id, user_id, name FROM projects WHERE id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      return { error: 'Project not found', status: 404 };
    }

    const project = result.rows[0];
    if (project.user_id !== userId) {
      return { error: 'Access denied', status: 403 };
    }

    return { project };
  }

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
   * POST /projects/:projectId/services
   * Create a new service
   */
  fastify.post('/projects/:projectId/services', {
    schema: { ...projectParamsSchema, ...createServiceSchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const projectId = request.params.projectId;

    // Verify project ownership
    const ownershipCheck = await verifyProjectOwnership(projectId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { project } = ownershipCheck;

    // Validate service name
    const validation = validateServiceName(request.body.name);
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: validation.error,
      });
    }

    const serviceName = validation.name;
    const {
      repo_url,
      branch = 'main',
      dockerfile_path = 'Dockerfile',
      port,
      replicas = 1,
      storage_gb,
      health_check_path,
    } = request.body;

    try {
      // Check if service name already exists for this project
      const existing = await fastify.db.query(
        'SELECT id FROM services WHERE project_id = $1 AND name = $2',
        [projectId, serviceName]
      );

      if (existing.rows.length > 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'A service with this name already exists in this project',
        });
      }

      // Generate webhook secret
      const webhookSecret = generateWebhookSecret();

      // Insert into database
      const result = await fastify.db.query(
        `INSERT INTO services (project_id, name, repo_url, branch, dockerfile_path, port, replicas, storage_gb, health_check_path, webhook_secret)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, name, repo_url, branch, dockerfile_path, port, replicas, storage_gb, health_check_path, created_at`,
        [projectId, serviceName, repo_url, branch, dockerfile_path, port, replicas, storage_gb || null, health_check_path || null, webhookSecret]
      );

      const service = result.rows[0];
      const subdomain = computeSubdomain(userHash, serviceName);
      const webhookUrl = computeWebhookUrl(service.id);

      fastify.log.info(`Created service: ${serviceName} (${service.id}) in project ${projectId}`);

      return reply.code(201).send({
        ...service,
        subdomain,
        webhook_url: webhookUrl,
      });
    } catch (err) {
      fastify.log.error(`Failed to create service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create service',
      });
    }
  });

  /**
   * GET /services/:id
   * Get service details
   */
  fastify.get('/services/:id', { schema: serviceParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;

    try {
      // Get latest deployment status
      const deploymentResult = await fastify.db.query(
        `SELECT id, status, commit_sha, created_at
         FROM deployments
         WHERE service_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [serviceId]
      );

      const latestDeployment = deploymentResult.rows[0] || null;
      const subdomain = computeSubdomain(userHash, service.name);
      const webhookUrl = computeWebhookUrl(serviceId);

      return {
        id: service.id,
        project_id: service.project_id,
        name: service.name,
        repo_url: service.repo_url,
        branch: service.branch,
        dockerfile_path: service.dockerfile_path,
        port: service.port,
        replicas: service.replicas,
        storage_gb: service.storage_gb,
        health_check_path: service.health_check_path,
        created_at: service.created_at,
        subdomain,
        webhook_url: webhookUrl,
        latest_deployment: latestDeployment,
      };
    } catch (err) {
      fastify.log.error(`Failed to get service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get service',
      });
    }
  });

  /**
   * PATCH /services/:id
   * Update service configuration
   */
  fastify.patch('/services/:id', {
    schema: { ...serviceParamsSchema, ...updateServiceSchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.id;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const allowedFields = ['branch', 'dockerfile_path', 'port', 'replicas', 'storage_gb', 'health_check_path'];
    const updates = {};

    for (const field of allowedFields) {
      if (request.body[field] !== undefined) {
        updates[field] = request.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No valid fields to update',
      });
    }

    try {
      // Build dynamic update query
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [field, value] of Object.entries(updates)) {
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      values.push(serviceId);

      const result = await fastify.db.query(
        `UPDATE services
         SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, repo_url, branch, dockerfile_path, port, replicas, storage_gb, health_check_path, created_at`,
        values
      );

      const service = result.rows[0];

      fastify.log.info(`Updated service: ${service.name} (${serviceId})`);

      return service;
    } catch (err) {
      fastify.log.error(`Failed to update service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update service',
      });
    }
  });

  /**
   * DELETE /services/:id
   * Delete a service and its K8s resources
   */
  fastify.delete('/services/:id', { schema: serviceParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;
    const namespace = computeNamespace(userHash, service.project_name);

    try {
      // Delete K8s resources (ignore 404 errors)
      const k8sDeletes = [
        { name: 'deployment', fn: () => deleteDeployment(namespace, service.name) },
        { name: 'service', fn: () => deleteService(namespace, service.name) },
        { name: 'ingress', fn: () => deleteIngress(namespace, service.name) },
      ];

      // Only delete PVC if storage was configured
      if (service.storage_gb) {
        k8sDeletes.push({ name: 'pvc', fn: () => deletePVC(namespace, `${service.name}-pvc`) });
      }

      for (const resource of k8sDeletes) {
        try {
          await resource.fn();
          fastify.log.info(`Deleted K8s ${resource.name}: ${service.name} in ${namespace}`);
        } catch (k8sErr) {
          if (k8sErr.status !== 404) {
            fastify.log.warn(`Failed to delete K8s ${resource.name}: ${k8sErr.message}`);
          }
        }
      }

      // Delete from database (cascades env_vars, deployments)
      await fastify.db.query('DELETE FROM services WHERE id = $1', [serviceId]);

      fastify.log.info(`Deleted service: ${service.name} (${serviceId})`);

      return { success: true, message: 'Service deleted successfully' };
    } catch (err) {
      fastify.log.error(`Failed to delete service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete service',
      });
    }
  });

  /**
   * POST /services/:id/deploy
   * Trigger a manual deployment
   */
  fastify.post('/services/:id/deploy', { schema: serviceParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.id;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;

    try {
      // Get the user's GitHub token
      const userResult = await fastify.db.query(
        'SELECT github_access_token FROM users WHERE id = $1',
        [userId]
      );

      if (!userResult.rows[0]?.github_access_token) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'GitHub token not configured',
        });
      }

      const githubToken = decrypt(userResult.rows[0].github_access_token);

      // Get latest commit from the branch
      const commit = await getLatestCommit(githubToken, service.repo_url, service.branch);

      // Create deployment record
      const result = await fastify.db.query(
        `INSERT INTO deployments (service_id, commit_sha, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, service_id, commit_sha, status, created_at`,
        [serviceId, commit.sha]
      );

      const deployment = result.rows[0];

      fastify.log.info(`Created deployment ${deployment.id} for service ${serviceId} at commit ${commit.sha}`);

      return reply.code(201).send({
        ...deployment,
        commit_message: commit.message,
        commit_author: commit.author,
      });
    } catch (err) {
      fastify.log.error(`Failed to trigger deployment: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to trigger deployment',
      });
    }
  });

  /**
   * GET /services/:id/webhook-secret
   * Reveal the webhook secret for a service
   */
  fastify.get('/services/:id/webhook-secret', { schema: serviceParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.id;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      const result = await fastify.db.query(
        'SELECT webhook_secret FROM services WHERE id = $1',
        [serviceId]
      );

      const webhookUrl = computeWebhookUrl(serviceId);

      return {
        webhook_secret: result.rows[0].webhook_secret,
        webhook_url: webhookUrl,
      };
    } catch (err) {
      fastify.log.error(`Failed to get webhook secret: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get webhook secret',
      });
    }
  });

  // Environment Variables CRUD

  const envVarParamsSchema = {
    params: {
      type: 'object',
      required: ['serviceId'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
      },
    },
  };

  const envVarIdParamsSchema = {
    params: {
      type: 'object',
      required: ['serviceId', 'id'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
        id: { type: 'string', format: 'uuid' },
      },
    },
  };

  const createEnvVarSchema = {
    body: {
      type: 'object',
      required: ['key', 'value'],
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
    },
  };

  const updateEnvVarSchema = {
    body: {
      type: 'object',
      required: ['value'],
      properties: {
        value: { type: 'string' },
      },
    },
  };

  /**
   * GET /services/:serviceId/env
   * List all environment variables for a service (masked values)
   */
  fastify.get('/services/:serviceId/env', { schema: envVarParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      const result = await fastify.db.query(
        'SELECT id, key, created_at FROM env_vars WHERE service_id = $1 ORDER BY key ASC',
        [serviceId]
      );

      const envVars = result.rows.map(row => ({
        id: row.id,
        key: row.key,
        value: MASKED_VALUE,
        created_at: row.created_at,
      }));

      return { env_vars: envVars };
    } catch (err) {
      fastify.log.error(`Failed to list env vars: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list environment variables',
      });
    }
  });

  /**
   * POST /services/:serviceId/env
   * Add a new environment variable
   */
  fastify.post('/services/:serviceId/env', {
    schema: { ...envVarParamsSchema, ...createEnvVarSchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    // Validate key
    const validation = validateEnvVarKey(request.body.key);
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: validation.error,
      });
    }

    const key = validation.key;
    const { value } = request.body;

    try {
      // Check if key already exists for this service
      const existing = await fastify.db.query(
        'SELECT id FROM env_vars WHERE service_id = $1 AND key = $2',
        [serviceId, key]
      );

      if (existing.rows.length > 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'An environment variable with this key already exists for this service',
        });
      }

      // Encrypt value before storage
      const encryptedValue = encrypt(value);

      const result = await fastify.db.query(
        `INSERT INTO env_vars (service_id, key, value)
         VALUES ($1, $2, $3)
         RETURNING id, key, created_at`,
        [serviceId, key, encryptedValue]
      );

      const envVar = result.rows[0];

      fastify.log.info(`Created env var: ${key} for service ${serviceId}`);

      return reply.code(201).send({
        id: envVar.id,
        key: envVar.key,
        value: MASKED_VALUE,
        created_at: envVar.created_at,
      });
    } catch (err) {
      fastify.log.error(`Failed to create env var: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create environment variable',
      });
    }
  });

  /**
   * PATCH /services/:serviceId/env/:id
   * Update an environment variable value (not key)
   */
  fastify.patch('/services/:serviceId/env/:id', {
    schema: { ...envVarIdParamsSchema, ...updateEnvVarSchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;
    const envVarId = request.params.id;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      // Verify env var exists and belongs to this service
      const existing = await fastify.db.query(
        'SELECT id, key FROM env_vars WHERE id = $1 AND service_id = $2',
        [envVarId, serviceId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Environment variable not found',
        });
      }

      // Encrypt new value
      const encryptedValue = encrypt(request.body.value);

      const result = await fastify.db.query(
        `UPDATE env_vars SET value = $1 WHERE id = $2
         RETURNING id, key, created_at`,
        [encryptedValue, envVarId]
      );

      const envVar = result.rows[0];

      fastify.log.info(`Updated env var: ${envVar.key} for service ${serviceId}`);

      return {
        id: envVar.id,
        key: envVar.key,
        value: MASKED_VALUE,
        created_at: envVar.created_at,
      };
    } catch (err) {
      fastify.log.error(`Failed to update env var: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update environment variable',
      });
    }
  });

  /**
   * DELETE /services/:serviceId/env/:id
   * Delete an environment variable
   */
  fastify.delete('/services/:serviceId/env/:id', { schema: envVarIdParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;
    const envVarId = request.params.id;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      // Verify env var exists and belongs to this service
      const existing = await fastify.db.query(
        'SELECT id, key FROM env_vars WHERE id = $1 AND service_id = $2',
        [envVarId, serviceId]
      );

      if (existing.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Environment variable not found',
        });
      }

      await fastify.db.query('DELETE FROM env_vars WHERE id = $1', [envVarId]);

      fastify.log.info(`Deleted env var: ${existing.rows[0].key} from service ${serviceId}`);

      return { success: true, message: 'Environment variable deleted successfully' };
    } catch (err) {
      fastify.log.error(`Failed to delete env var: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete environment variable',
      });
    }
  });

  /**
   * GET /services/:serviceId/env/:id/value
   * Reveal the decrypted value of a single environment variable
   */
  fastify.get('/services/:serviceId/env/:id/value', { schema: envVarIdParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;
    const envVarId = request.params.id;

    // Verify service ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      const result = await fastify.db.query(
        'SELECT id, key, value, created_at FROM env_vars WHERE id = $1 AND service_id = $2',
        [envVarId, serviceId]
      );

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Environment variable not found',
        });
      }

      const envVar = result.rows[0];
      const decryptedValue = decrypt(envVar.value);

      return {
        id: envVar.id,
        key: envVar.key,
        value: decryptedValue,
        created_at: envVar.created_at,
      };
    } catch (err) {
      fastify.log.error(`Failed to reveal env var value: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to reveal environment variable value',
      });
    }
  });
}
