import { generateWebhookSecret } from '../services/encryption.js';
import { deleteDeployment, deleteService, deleteIngress, deletePVC, rolloutRestart, deleteServicePods, getPodMetrics, getDeployment, getPodsByLabel, getPodLogs, streamPodLogs, getPodHealth, getPodEvents, patchService, patchDeployment, patchIngress } from '../services/kubernetes.js';
import { getLatestCommit, getFileContent, getDockerfileExposedPort } from '../services/github.js';
import { decrypt, encrypt } from '../services/encryption.js';
import { runBuildPipeline } from '../services/buildPipeline.js';
import { validateDockerfile } from '../services/dockerfileValidator.js';
import { performHealthCheck, getHealthHistory } from '../services/healthChecker.js';

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
const BASE_DOMAIN = process.env.BASE_DOMAIN || '192.168.1.124.nip.io';

function computeSubdomain(userHash, serviceName) {
  return `${userHash}-${serviceName}`;
}

function computeServiceUrl(subdomain) {
  return `http://${subdomain}.${BASE_DOMAIN}`;
}

function computeWebhookUrl(serviceId) {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3001/webhooks/github';
  return `${baseUrl}/${serviceId}`;
}

function computeNamespace(userHash, projectName) {
  return `${userHash}-${projectName}`;
}

function parseResourceQuantity(value) {
  if (!value || value === '0') return 0;

  // CPU: parse millicores (e.g., "45m", "100m", "1", "0.5")
  if (value.endsWith('m')) {
    return parseInt(value.slice(0, -1), 10);
  }
  // CPU without suffix means cores, convert to millicores
  if (/^[\d.]+$/.test(value)) {
    return Math.round(parseFloat(value) * 1000);
  }

  // Memory: parse bytes from various units
  if (value.endsWith('Ki')) {
    return parseInt(value.slice(0, -2), 10) * 1024;
  }
  if (value.endsWith('Mi')) {
    return parseInt(value.slice(0, -2), 10) * 1024 * 1024;
  }
  if (value.endsWith('Gi')) {
    return parseInt(value.slice(0, -2), 10) * 1024 * 1024 * 1024;
  }
  if (value.endsWith('K') || value.endsWith('k')) {
    return parseInt(value.slice(0, -1), 10) * 1000;
  }
  if (value.endsWith('M')) {
    return parseInt(value.slice(0, -1), 10) * 1000 * 1000;
  }
  if (value.endsWith('G')) {
    return parseInt(value.slice(0, -1), 10) * 1000 * 1000 * 1000;
  }

  // Plain number assumed to be bytes
  return parseInt(value, 10) || 0;
}

export default async function serviceRoutes(fastify, options) {
  const createServiceSchema = {
    body: {
      type: 'object',
      required: ['name', 'port'],
      properties: {
        name: { type: 'string' },
        repo_url: { type: 'string' },
        image: { type: 'string' },
        branch: { type: 'string', default: 'main' },
        dockerfile_path: { type: 'string', default: 'Dockerfile' },
        build_context: { type: 'string' },
        port: { type: 'integer', minimum: 1, maximum: 65535 },
        replicas: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
        storage_gb: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
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
        build_context: { type: 'string' },
        port: { type: 'integer', minimum: 1, maximum: 65535 },
        replicas: { type: 'integer', minimum: 1, maximum: 3 },
        storage_gb: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
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
      `SELECT s.*, s.detected_port, p.user_id, p.name as project_name
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
      image,
      branch = 'main',
      dockerfile_path = 'Dockerfile',
      build_context,
      port,
      replicas = 1,
      storage_gb,
      health_check_path,
    } = request.body;

    // Validate that either repo_url or image is provided
    if (!repo_url && !image) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Either repo_url or image must be provided',
      });
    }

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
        `INSERT INTO services (project_id, name, repo_url, image, branch, dockerfile_path, build_context, port, replicas, storage_gb, health_check_path, webhook_secret)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, name, repo_url, image, branch, dockerfile_path, build_context, port, replicas, storage_gb, health_check_path, created_at`,
        [projectId, serviceName, repo_url || null, image || null, branch, dockerfile_path, build_context || null, port, replicas, storage_gb || null, health_check_path || null, webhookSecret]
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
   * POST /projects/:projectId/services/batch
   * Create multiple services at once (for importing from docker-compose)
   */
  fastify.post('/projects/:projectId/services/batch', {
    schema: {
      params: projectParamsSchema.params,
      body: {
        type: 'object',
        required: ['services'],
        properties: {
          services: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              required: ['name', 'port'],
              properties: {
                name: { type: 'string' },
                repo_url: { type: 'string' },
                branch: { type: 'string', default: 'main' },
                dockerfile_path: { type: 'string', default: 'Dockerfile' },
                build_context: { type: 'string' },
                image: { type: 'string' },
                port: { type: 'integer', minimum: 1, maximum: 65535 },
                replicas: { type: 'integer', minimum: 1, maximum: 3, default: 1 },
                storage_gb: { type: ['integer', 'null'], minimum: 1, maximum: 10 },
                health_check_path: { type: 'string' },
                env_vars: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['key', 'value'],
                    properties: {
                      key: { type: 'string' },
                      value: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const projectId = request.params.projectId;
    const { services } = request.body;

    // Verify project ownership
    const ownershipCheck = await verifyProjectOwnership(projectId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    // Check for duplicate service names in the request (after normalization)
    const normalizedNames = services.map(svc => validateServiceName(svc.name).name);
    const seenNames = new Set();
    for (let i = 0; i < normalizedNames.length; i++) {
      const name = normalizedNames[i];
      if (seenNames.has(name)) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Duplicate service name "${name}" in request`
        });
      }
      seenNames.add(name);
    }

    // Validate all service names and env vars upfront
    for (const svc of services) {
      const validation = validateServiceName(svc.name);
      if (!validation.valid) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Invalid service name "${svc.name}": ${validation.error}`
        });
      }

      // Ensure either repo_url or image is provided
      if (!svc.repo_url && !svc.image) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: `Service "${svc.name}" must have either repo_url or image`
        });
      }

      // Validate environment variable keys if provided
      if (svc.env_vars && svc.env_vars.length > 0) {
        const seenKeys = new Set();
        for (const env of svc.env_vars) {
          const upperKey = env.key.toUpperCase();

          // Check for duplicate keys within this service
          if (seenKeys.has(upperKey)) {
            return reply.code(400).send({
              error: 'Bad Request',
              message: `Duplicate env var key "${env.key}" in service "${svc.name}"`
            });
          }
          seenKeys.add(upperKey);

          // Validate key format
          const keyValidation = validateEnvVarKey(upperKey);
          if (!keyValidation.valid) {
            return reply.code(400).send({
              error: 'Bad Request',
              message: `Invalid env var key "${env.key}" in service "${svc.name}": ${keyValidation.error}`
            });
          }
        }
      }
    }

    const createdServices = [];
    const errors = [];

    // Use transaction for atomic batch creation
    const client = await fastify.db.pool.connect();

    try {
      await client.query('BEGIN');

      for (const svc of services) {
        const serviceName = validateServiceName(svc.name).name;

        // Check for existing service
        const existing = await client.query(
          'SELECT id FROM services WHERE project_id = $1 AND name = $2',
          [projectId, serviceName]
        );

        if (existing.rows.length > 0) {
          errors.push({
            name: svc.name,
            error: 'Service already exists'
          });
          continue;
        }

        // Generate webhook secret
        const webhookSecret = generateWebhookSecret();

        // Apply defaults explicitly (Fastify schema defaults are for validation/docs only)
        const branch = svc.branch || 'main';
        const dockerfilePath = svc.dockerfile_path || 'Dockerfile';
        const replicas = svc.replicas ?? 1;

        const result = await client.query(
          `INSERT INTO services (
            project_id, name, repo_url, branch, dockerfile_path,
            build_context, image, port, replicas, storage_gb,
            health_check_path, webhook_secret
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, name, repo_url, branch, dockerfile_path, build_context, image, port, replicas, storage_gb, health_check_path, created_at`,
          [
            projectId,
            serviceName,
            svc.repo_url || null,
            branch,
            dockerfilePath,
            svc.build_context || null,
            svc.image || null,
            svc.port,
            replicas,
            svc.storage_gb || null,
            svc.health_check_path || null,
            webhookSecret
          ]
        );

        const service = result.rows[0];

        // Create environment variables if provided
        if (svc.env_vars && svc.env_vars.length > 0) {
          for (const env of svc.env_vars) {
            const encryptedValue = encrypt(env.value);
            await client.query(
              'INSERT INTO env_vars (service_id, key, value) VALUES ($1, $2, $3)',
              [service.id, env.key.toUpperCase(), encryptedValue]
            );
          }
        }

        createdServices.push({
          ...service,
          subdomain: computeSubdomain(userHash, serviceName),
          webhook_url: computeWebhookUrl(service.id)
        });
      }

      await client.query('COMMIT');

      fastify.log.info(`Batch created ${createdServices.length} services in project ${projectId}`);

      return reply.code(201).send({
        created: createdServices,
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          requested: services.length,
          created: createdServices.length,
          failed: errors.length
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error(`Batch create failed: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create services'
      });
    } finally {
      client.release();
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
      const serviceUrl = computeServiceUrl(subdomain);

      // Check for port mismatch
      const hasMismatch = service.detected_port !== null && service.detected_port !== service.port;

      return {
        id: service.id,
        project_id: service.project_id,
        name: service.name,
        repo_url: service.repo_url,
        image: service.image,
        branch: service.branch,
        dockerfile_path: service.dockerfile_path,
        build_context: service.build_context,
        port: service.port,
        detected_port: service.detected_port,
        port_mismatch: hasMismatch,
        replicas: service.replicas,
        storage_gb: service.storage_gb,
        health_check_path: service.health_check_path,
        created_at: service.created_at,
        subdomain,
        url: serviceUrl,
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
   * GET /services/:id/metrics
   * Get real-time CPU and memory metrics for a service
   */
  fastify.get('/services/:id/metrics', { schema: serviceParamsSchema }, async (request, reply) => {
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
      // Get pod metrics from metrics-server
      let podMetrics;
      try {
        podMetrics = await getPodMetrics(namespace, `app=${service.name}`);
      } catch (metricsErr) {
        // Metrics server unavailable or no metrics yet
        fastify.log.warn(`Metrics unavailable for ${service.name}: ${metricsErr.message}`);
        return {
          pods: [],
          aggregated: {
            totalCpuMillicores: 0,
            totalMemoryBytes: 0,
            podCount: 0
          },
          limits: null,
          available: false,
          message: 'Metrics not available. Service may not be running or metrics-server may be unavailable.'
        };
      }

      // Get resource limits from deployment
      let limits = null;
      try {
        const deployment = await getDeployment(namespace, service.name);
        const containerLimits = deployment.spec?.template?.spec?.containers?.[0]?.resources?.limits;
        if (containerLimits) {
          limits = {
            cpuMillicores: parseResourceQuantity(containerLimits.cpu),
            memoryBytes: parseResourceQuantity(containerLimits.memory)
          };
        }
      } catch (deployErr) {
        fastify.log.warn(`Could not get deployment limits for ${service.name}: ${deployErr.message}`);
      }

      // Parse and aggregate metrics
      const parsedPods = podMetrics.map(pod => {
        const container = pod.containers[0] || {};
        const cpuMillicores = parseResourceQuantity(container.cpu || '0');
        const memoryBytes = parseResourceQuantity(container.memory || '0');

        return {
          name: pod.name,
          cpu: {
            usage: container.cpu || '0',
            usageMillicores: cpuMillicores,
            limitMillicores: limits?.cpuMillicores || null,
            percentUsed: limits?.cpuMillicores ? Math.round((cpuMillicores / limits.cpuMillicores) * 100) : null
          },
          memory: {
            usage: container.memory || '0',
            usageBytes: memoryBytes,
            limitBytes: limits?.memoryBytes || null,
            percentUsed: limits?.memoryBytes ? Math.round((memoryBytes / limits.memoryBytes) * 100) : null
          }
        };
      });

      // Aggregate metrics across all pods
      const aggregated = {
        totalCpuMillicores: parsedPods.reduce((sum, pod) => sum + pod.cpu.usageMillicores, 0),
        totalMemoryBytes: parsedPods.reduce((sum, pod) => sum + pod.memory.usageBytes, 0),
        podCount: parsedPods.length
      };

      return {
        pods: parsedPods,
        aggregated,
        limits,
        available: true
      };
    } catch (err) {
      fastify.log.error(`Failed to get metrics: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get service metrics',
      });
    }
  });

  /**
   * GET /services/:id/health
   * Get health check status for a service
   */
  fastify.get('/services/:id/health', { schema: serviceParamsSchema }, async (request, reply) => {
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

    // Check if health check is configured
    if (!service.health_check_path) {
      return {
        configured: false,
        message: 'No health check path configured for this service'
      };
    }

    const namespace = computeNamespace(userHash, service.project_name);
    const subdomain = computeSubdomain(userHash, service.name);

    try {
      // Get pod health from Kubernetes
      let podHealth = [];
      let events = [];
      try {
        podHealth = await getPodHealth(namespace, `app=${service.name}`);
        events = await getPodEvents(namespace, `app=${service.name}`);
      } catch (k8sErr) {
        fastify.log.warn(`Could not get pod health for ${service.name}: ${k8sErr.message}`);
      }

      // Perform active health check
      let activeCheck = null;
      try {
        activeCheck = await performHealthCheck(subdomain, service.health_check_path, service.port);
      } catch (healthErr) {
        fastify.log.warn(`Active health check failed for ${service.name}: ${healthErr.message}`);
        activeCheck = {
          status: 'unhealthy',
          error: healthErr.message,
          lastCheck: new Date().toISOString()
        };
      }

      // Get health check history
      let history = [];
      try {
        history = await getHealthHistory(fastify.db, serviceId, 20);
      } catch (historyErr) {
        fastify.log.warn(`Could not get health history for ${service.name}: ${historyErr.message}`);
      }

      // Calculate overall health status
      const allPodsReady = podHealth.length > 0 && podHealth.every(p => p.ready);
      const activeHealthy = activeCheck?.status === 'healthy';
      const overallStatus = (allPodsReady && activeHealthy) ? 'healthy' : 'unhealthy';

      return {
        configured: true,
        path: service.health_check_path,
        status: overallStatus,
        pods: podHealth,
        activeCheck,
        history,
        events: events.slice(0, 10) // Last 10 relevant events
      };
    } catch (err) {
      fastify.log.error(`Failed to get health status: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get health status',
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

    const allowedFields = ['branch', 'dockerfile_path', 'build_context', 'port', 'replicas', 'storage_gb', 'health_check_path'];
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
         RETURNING id, name, repo_url, image, branch, dockerfile_path, build_context, port, replicas, storage_gb, health_check_path, created_at`,
        values
      );

      const service = result.rows[0];

      fastify.log.info(`Updated service: ${service.name} (${serviceId})`);

      // Return consistent format with GET endpoint (include computed fields)
      return {
        ...service,
        subdomain: computeSubdomain(userHash, service.name),
        webhook_url: computeWebhookUrl(serviceId),
      };
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
      let deployment;
      let commitSha = null;
      let githubToken = null;

      // For image-only services (no repo_url), we don't need GitHub token or commit info
      if (service.image && !service.repo_url) {
        // Create deployment record for image-only service
        const result = await fastify.db.query(
          `INSERT INTO deployments (service_id, commit_sha, status)
           VALUES ($1, $2, 'pending')
           RETURNING id, service_id, commit_sha, status, created_at`,
          [serviceId, 'image-deploy']
        );

        deployment = result.rows[0];
        fastify.log.info(`Created image deployment ${deployment.id} for service ${serviceId} using ${service.image}`);
      } else {
        // For repo-based services, get GitHub token and commit info
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

        githubToken = decrypt(userResult.rows[0].github_access_token);

        // Get latest commit from the branch
        const commit = await getLatestCommit(githubToken, service.repo_url, service.branch);
        commitSha = commit.sha;

        // Create deployment record
        const result = await fastify.db.query(
          `INSERT INTO deployments (service_id, commit_sha, status)
           VALUES ($1, $2, 'pending')
           RETURNING id, service_id, commit_sha, status, created_at`,
          [serviceId, commitSha]
        );

        deployment = result.rows[0];
        fastify.log.info(`Created deployment ${deployment.id} for service ${serviceId} at commit ${commitSha}`);
      }

      // Trigger build pipeline asynchronously (don't await - runs in background)
      runBuildPipeline(
        fastify.db,
        service,
        deployment,
        commitSha,
        githubToken,
        namespace,
        userHash
      ).catch(err => {
        fastify.log.error(`Build pipeline failed for deployment ${deployment.id}: ${err.message}`);
      });

      return reply.code(201).send({
        ...deployment,
        message: 'Deployment triggered',
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
   * POST /services/:id/restart
   * Restart a service without triggering a full rebuild
   */
  fastify.post('/services/:id/restart', {
    schema: {
      ...serviceParamsSchema,
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['rolling', 'hard'], default: 'rolling' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;
    const { type = 'rolling' } = request.body || {};

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
      if (type === 'rolling') {
        await rolloutRestart(namespace, service.name);
        fastify.log.info(`Rolling restart initiated for service ${service.name} in ${namespace}`);
      } else {
        await deleteServicePods(namespace, service.name);
        fastify.log.info(`Hard restart initiated for service ${service.name} in ${namespace}`);
      }

      return {
        success: true,
        message: 'Service restart initiated',
        type
      };
    } catch (err) {
      fastify.log.error(`Failed to restart service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to restart service',
      });
    }
  });

  /**
   * POST /services/:id/validate-dockerfile
   * Validate the Dockerfile for a service before building
   */
  fastify.post('/services/:id/validate-dockerfile', { schema: serviceParamsSchema }, async (request, reply) => {
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

    // Cannot validate if no repo_url (image-only services)
    if (!service.repo_url) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Cannot validate Dockerfile for image-only services',
      });
    }

    try {
      // Get user's GitHub token
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

      // Fetch Dockerfile content from GitHub
      const dockerfilePath = service.dockerfile_path || 'Dockerfile';
      const fileResult = await getFileContent(
        githubToken,
        service.repo_url,
        dockerfilePath,
        service.branch
      );

      if (!fileResult) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Dockerfile not found at ${dockerfilePath}`,
        });
      }

      // Validate the Dockerfile
      const validationResult = validateDockerfile(fileResult.content);

      fastify.log.info(`Validated Dockerfile for service ${serviceId}: ${validationResult.summary.errorCount} errors, ${validationResult.summary.warningCount} warnings`);

      return {
        ...validationResult,
        dockerfile_path: dockerfilePath,
      };
    } catch (err) {
      fastify.log.error(`Failed to validate Dockerfile: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate Dockerfile',
      });
    }
  });

  /**
   * GET /services/:id/suggested-port
   * Get the suggested port from Dockerfile EXPOSE directive
   */
  fastify.get('/services/:id/suggested-port', { schema: serviceParamsSchema }, async (request, reply) => {
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

    // Cannot get suggested port for image-only services
    if (!service.repo_url) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Cannot detect port for image-only services',
      });
    }

    try {
      // Get user's GitHub token
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

      // Build the full Dockerfile path considering build_context
      let dockerfilePath = service.dockerfile_path || 'Dockerfile';
      if (service.build_context) {
        const context = service.build_context.replace(/^\.\//, '').replace(/\/$/, '');
        dockerfilePath = `${context}/${dockerfilePath}`;
      }

      // Fetch and parse Dockerfile
      const { port: detectedPort } = await getDockerfileExposedPort(
        githubToken,
        service.repo_url,
        dockerfilePath,
        service.branch
      );

      // Update the detected_port in the database
      if (detectedPort !== null) {
        await fastify.db.query(
          'UPDATE services SET detected_port = $1 WHERE id = $2',
          [detectedPort, serviceId]
        );
      }

      const hasMismatch = detectedPort !== null && detectedPort !== service.port;

      return {
        detected_port: detectedPort,
        configured_port: service.port,
        has_mismatch: hasMismatch,
        dockerfile_path: dockerfilePath,
      };
    } catch (err) {
      fastify.log.error(`Failed to get suggested port: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to detect port from Dockerfile',
      });
    }
  });

  /**
   * POST /services/:id/fix-port
   * Update the service port to match the Dockerfile EXPOSE directive
   * Updates both the database and Kubernetes resources without rebuild
   */
  fastify.post('/services/:id/fix-port', {
    schema: {
      ...serviceParamsSchema,
      body: {
        type: 'object',
        properties: {
          port: { type: 'integer', minimum: 1, maximum: 65535 }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;
    const { port: newPort } = request.body || {};

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

    // Determine the target port - use provided port or detected_port
    let targetPort = newPort;
    if (!targetPort) {
      // Try to get detected port from database
      const detectedResult = await fastify.db.query(
        'SELECT detected_port FROM services WHERE id = $1',
        [serviceId]
      );
      targetPort = detectedResult.rows[0]?.detected_port;
    }

    if (!targetPort) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'No port specified and no detected port available. Run suggested-port first or specify a port.',
      });
    }

    if (targetPort === service.port) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Port is already set to the specified value',
      });
    }

    try {
      // Update database first
      await fastify.db.query(
        'UPDATE services SET port = $1 WHERE id = $2',
        [targetPort, serviceId]
      );

      // Update Kubernetes Service
      try {
        await patchService(namespace, service.name, {
          spec: {
            ports: [{
              port: targetPort,
              targetPort: targetPort,
              protocol: 'TCP'
            }]
          }
        });
        fastify.log.info(`Patched K8s Service port for ${service.name} to ${targetPort}`);
      } catch (k8sErr) {
        if (k8sErr.status !== 404) {
          fastify.log.warn(`Failed to patch K8s Service: ${k8sErr.message}`);
        }
      }

      // Update Kubernetes Deployment container port
      try {
        await patchDeployment(namespace, service.name, {
          spec: {
            template: {
              spec: {
                containers: [{
                  name: service.name,
                  ports: [{
                    containerPort: targetPort,
                    protocol: 'TCP'
                  }]
                }]
              }
            }
          }
        });
        fastify.log.info(`Patched K8s Deployment port for ${service.name} to ${targetPort}`);
      } catch (k8sErr) {
        if (k8sErr.status !== 404) {
          fastify.log.warn(`Failed to patch K8s Deployment: ${k8sErr.message}`);
        }
      }

      // Update Kubernetes Ingress backend port
      try {
        const subdomain = computeSubdomain(userHash, service.name);
        await patchIngress(namespace, service.name, {
          spec: {
            rules: [{
              host: `${subdomain}.${BASE_DOMAIN}`,
              http: {
                paths: [{
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: service.name,
                      port: {
                        number: targetPort
                      }
                    }
                  }
                }]
              }
            }]
          }
        });
        fastify.log.info(`Patched K8s Ingress port for ${service.name} to ${targetPort}`);
      } catch (k8sErr) {
        if (k8sErr.status !== 404) {
          fastify.log.warn(`Failed to patch K8s Ingress: ${k8sErr.message}`);
        }
      }

      fastify.log.info(`Fixed port mismatch for service ${serviceId}: ${service.port} -> ${targetPort}`);

      return {
        success: true,
        message: 'Port updated successfully',
        previous_port: service.port,
        new_port: targetPort,
      };
    } catch (err) {
      fastify.log.error(`Failed to fix port: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update port',
      });
    }
  });

  /**
   * GET /services/:id/logs
   * Get container logs for a service
   */
  fastify.get('/services/:id/logs', {
    schema: {
      ...serviceParamsSchema,
      querystring: {
        type: 'object',
        properties: {
          tailLines: { type: 'integer', minimum: 1, maximum: 10000, default: 100 },
          sinceSeconds: { type: 'integer', minimum: 1 },
          pod: { type: 'string' },
          container: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;
    const { tailLines = 100, sinceSeconds, pod, container } = request.query;

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
      // Get all pods for this service
      const podsResult = await getPodsByLabel(namespace, `app=${service.name}`);
      const allPods = podsResult.items || [];

      if (allPods.length === 0) {
        return { pods: [], message: 'No running pods found' };
      }

      // Filter to specific pod if requested, otherwise get all
      const targetPods = pod
        ? allPods.filter(p => p.metadata.name === pod)
        : allPods;

      if (targetPods.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: `Pod "${pod}" not found`
        });
      }

      // Get logs for each pod
      const results = await Promise.all(
        targetPods.map(async (p) => {
          const podName = p.metadata.name;
          const containers = p.spec.containers.map(c => c.name);
          const targetContainer = container || containers[0];

          try {
            const logs = await getPodLogs(namespace, podName, {
              tailLines,
              sinceSeconds,
              container: targetContainer
            });
            return {
              name: podName,
              containers,
              logs,
              status: p.status.phase
            };
          } catch (logErr) {
            fastify.log.warn(`Failed to get logs for pod ${podName}: ${logErr.message}`);
            return {
              name: podName,
              containers,
              logs: '',
              error: logErr.message,
              status: p.status.phase
            };
          }
        })
      );

      return { pods: results };
    } catch (err) {
      fastify.log.error(`Failed to get container logs: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get container logs',
      });
    }
  });

  /**
   * GET /services/:id/logs/stream (WebSocket)
   * Stream container logs in real-time
   */
  fastify.get('/services/:id/logs/stream', {
    websocket: true,
    schema: serviceParamsSchema
  }, async (connection, request) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.id;
    const { pod, container, tailLines = 50 } = request.query;

    // Verify ownership
    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: ownershipCheck.error
      }));
      connection.socket.close();
      return;
    }

    const { service } = ownershipCheck;
    const namespace = computeNamespace(userHash, service.project_name);

    try {
      // Get pods if no specific pod requested
      let targetPod = pod;
      if (!targetPod) {
        const podsResult = await getPodsByLabel(namespace, `app=${service.name}`);
        const allPods = podsResult.items || [];
        if (allPods.length === 0) {
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: 'No running pods found'
          }));
          connection.socket.close();
          return;
        }
        // Use first pod if not specified
        targetPod = allPods[0].metadata.name;

        // Send pod list to client
        connection.socket.send(JSON.stringify({
          type: 'pods',
          pods: allPods.map(p => ({
            name: p.metadata.name,
            containers: p.spec.containers.map(c => c.name),
            status: p.status.phase
          }))
        }));
      }

      // Start streaming logs
      const logStream = streamPodLogs(namespace, targetPod, {
        container,
        tailLines: parseInt(tailLines, 10)
      });

      connection.socket.send(JSON.stringify({
        type: 'connected',
        pod: targetPod,
        container: container || 'default'
      }));

      logStream.on('data', (chunk) => {
        connection.socket.send(JSON.stringify({
          type: 'log',
          data: chunk
        }));
      });

      logStream.on('error', (err) => {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: err.message
        }));
      });

      logStream.on('end', () => {
        connection.socket.send(JSON.stringify({
          type: 'end',
          message: 'Log stream ended'
        }));
      });

      // Cleanup on socket close
      connection.socket.on('close', () => {
        logStream.destroy();
      });

    } catch (err) {
      fastify.log.error(`Failed to stream container logs: ${err.message}`);
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to stream logs'
      }));
      connection.socket.close();
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

      if (result.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Service not found',
        });
      }

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
   * POST /services/:id/clone
   * Clone an existing service with a new name
   */
  fastify.post('/services/:id/clone', {
    schema: {
      ...serviceParamsSchema,
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          project_id: { type: 'string', format: 'uuid' },
          include_env: { type: 'boolean', default: false },
          auto_deploy: { type: 'boolean', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const sourceId = request.params.id;
    const { name, project_id, include_env = false, auto_deploy = false } = request.body;

    // Verify ownership of source service
    const sourceCheck = await verifyServiceOwnership(sourceId, userId);
    if (sourceCheck.error) {
      return reply.code(sourceCheck.status).send({
        error: sourceCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: sourceCheck.error,
      });
    }

    const sourceService = sourceCheck.service;

    // Validate new service name
    const validation = validateServiceName(name);
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: validation.error,
      });
    }

    const newServiceName = validation.name;

    // Determine target project (default to same project)
    const targetProjectId = project_id || sourceService.project_id;

    // If cloning to different project, verify ownership
    if (targetProjectId !== sourceService.project_id) {
      const targetCheck = await verifyProjectOwnership(targetProjectId, userId);
      if (targetCheck.error) {
        return reply.code(targetCheck.status).send({
          error: targetCheck.status === 404 ? 'Not Found' : 'Forbidden',
          message: targetCheck.error,
        });
      }
    }

    try {
      // Check if service name already exists in target project
      const existing = await fastify.db.query(
        'SELECT id FROM services WHERE project_id = $1 AND name = $2',
        [targetProjectId, newServiceName]
      );

      if (existing.rows.length > 0) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'Service name already exists in target project',
        });
      }

      // Generate new webhook secret
      const webhookSecret = generateWebhookSecret();

      // Clone service
      const result = await fastify.db.query(
        `INSERT INTO services (
          name, project_id, repo_url, image, branch, dockerfile_path,
          build_context, port, replicas, storage_gb, health_check_path, webhook_secret
        )
        SELECT
          $1, $2, repo_url, image, branch, dockerfile_path,
          build_context, port, replicas, storage_gb, health_check_path, $3
        FROM services WHERE id = $4
        RETURNING *`,
        [newServiceName, targetProjectId, webhookSecret, sourceId]
      );

      const newService = result.rows[0];

      // Clone environment variables if requested
      if (include_env) {
        await fastify.db.query(
          `INSERT INTO env_vars (service_id, key, value)
           SELECT $1, key, value
           FROM env_vars WHERE service_id = $2`,
          [newService.id, sourceId]
        );
      }

      const subdomain = computeSubdomain(userHash, newServiceName);
      const webhookUrl = computeWebhookUrl(newService.id);

      fastify.log.info(`Cloned service ${sourceService.name} (${sourceId}) to ${newServiceName} (${newService.id})`);

      // Trigger deployment if requested
      let deployment = null;
      if (auto_deploy) {
        // Create deployment record
        const deployResult = await fastify.db.query(
          `INSERT INTO deployments (service_id, commit_sha, status)
           VALUES ($1, $2, 'pending')
           RETURNING id, service_id, commit_sha, status, created_at`,
          [newService.id, 'clone-deploy']
        );
        deployment = deployResult.rows[0];

        // Get project name for namespace
        const projectResult = await fastify.db.query(
          'SELECT name FROM projects WHERE id = $1',
          [targetProjectId]
        );
        const projectName = projectResult.rows[0].name;
        const namespace = computeNamespace(userHash, projectName);

        // Get GitHub token if needed for repo-based service
        let githubToken = null;
        let commitSha = null;
        if (newService.repo_url) {
          const userResult = await fastify.db.query(
            'SELECT github_access_token FROM users WHERE id = $1',
            [userId]
          );
          if (userResult.rows[0]?.github_access_token) {
            githubToken = decrypt(userResult.rows[0].github_access_token);
            const commit = await getLatestCommit(githubToken, newService.repo_url, newService.branch);
            commitSha = commit.sha;
            // Update deployment with actual commit sha
            await fastify.db.query(
              'UPDATE deployments SET commit_sha = $1 WHERE id = $2',
              [commitSha, deployment.id]
            );
            deployment.commit_sha = commitSha;
          }
        }

        // Trigger build pipeline asynchronously
        runBuildPipeline(
          fastify.db,
          newService,
          deployment,
          commitSha || 'clone-deploy',
          githubToken,
          namespace,
          userHash
        ).catch(err => {
          fastify.log.error(`Build pipeline failed for cloned service ${newService.id}: ${err.message}`);
        });
      }

      return reply.code(201).send({
        service: {
          ...newService,
          subdomain,
          webhook_url: webhookUrl,
        },
        deployment,
        cloned_from: sourceId,
        env_vars_copied: include_env,
      });
    } catch (err) {
      fastify.log.error(`Failed to clone service: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to clone service',
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
