import { createNamespace, deleteNamespace, createSecret } from '../services/kubernetes.js';
import { deleteRepositoriesByNamespace } from '../services/harbor.js';

// Harbor registry config - loaded from environment for pushing built images
const HARBOR_REGISTRY = process.env.HARBOR_REGISTRY || 'harbor.192.168.1.124.nip.io';
const HARBOR_ROBOT_USER = process.env.HARBOR_ROBOT_USER || 'robot$runner';
const HARBOR_ROBOT_PASSWORD = process.env.HARBOR_ROBOT_PASSWORD;
const REGISTRY_SECRET_NAME = process.env.REGISTRY_SECRET_NAME || 'harbor-registry-secret';

const NAME_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/;
const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 63;

function validateProjectName(name) {
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

function computeNamespace(userHash, projectName) {
  return `${userHash}-${projectName}`;
}

/**
 * Create the harbor registry secret in a namespace for Kaniko builds
 */
async function createRegistrySecret(namespace, logger) {
  if (!HARBOR_ROBOT_PASSWORD) {
    logger.warn('HARBOR_ROBOT_PASSWORD not set - skipping registry secret creation');
    return;
  }

  const auth = Buffer.from(`${HARBOR_ROBOT_USER}:${HARBOR_ROBOT_PASSWORD}`).toString('base64');
  const dockerConfig = JSON.stringify({
    auths: {
      [HARBOR_REGISTRY]: {
        username: HARBOR_ROBOT_USER,
        password: HARBOR_ROBOT_PASSWORD,
        auth: auth,
      },
    },
  });

  const secretData = {
    'config.json': Buffer.from(dockerConfig).toString('base64'),
  };

  try {
    await createSecret(namespace, REGISTRY_SECRET_NAME, secretData);
    logger.info(`Created registry secret in namespace ${namespace}`);
  } catch (err) {
    // Ignore if already exists (409 Conflict)
    if (err.status !== 409) {
      throw err;
    }
    logger.debug(`Registry secret already exists in namespace ${namespace}`);
  }
}

export default async function projectRoutes(fastify, options) {
  const createProjectSchema = {
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    },
  };

  const projectParamsSchema = {
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', format: 'uuid' },
      },
    },
  };

  /**
   * GET /projects
   * List all projects for the authenticated user
   */
  fastify.get('/projects', async (request, reply) => {
    const userId = request.user.id;

    try {
      const result = await fastify.db.query(
        `SELECT
          p.id,
          p.name,
          p.created_at,
          COUNT(s.id)::int AS service_count
        FROM projects p
        LEFT JOIN services s ON s.project_id = p.id
        WHERE p.user_id = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC`,
        [userId]
      );

      const projects = result.rows.map((row) => ({
        ...row,
        namespace: computeNamespace(request.user.hash, row.name),
      }));

      return { projects };
    } catch (err) {
      fastify.log.error(`Failed to list projects: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list projects',
      });
    }
  });

  /**
   * POST /projects
   * Create a new project
   */
  fastify.post('/projects', { schema: createProjectSchema }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;

    const validation = validateProjectName(request.body.name);
    if (!validation.valid) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: validation.error,
      });
    }

    const projectName = validation.name;
    const namespace = computeNamespace(userHash, projectName);

    try {
      // Check if project name already exists for this user
      const existing = await fastify.db.query(
        'SELECT id FROM projects WHERE user_id = $1 AND name = $2',
        [userId, projectName]
      );

      if (existing.rows.length > 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'A project with this name already exists',
        });
      }

      // Create Kubernetes namespace
      try {
        await createNamespace(namespace);
        fastify.log.info(`Created Kubernetes namespace: ${namespace}`);

        // Create registry secret for Kaniko builds
        await createRegistrySecret(namespace, fastify.log);
      } catch (k8sErr) {
        fastify.log.error(`Failed to create Kubernetes namespace: ${k8sErr.message}`);
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create project namespace',
        });
      }

      // Insert into database
      const result = await fastify.db.query(
        `INSERT INTO projects (user_id, name)
         VALUES ($1, $2)
         RETURNING id, name, created_at`,
        [userId, projectName]
      );

      const project = result.rows[0];

      fastify.log.info(`Created project: ${projectName} (${project.id}) for user ${userId}`);

      return reply.code(201).send({
        ...project,
        namespace,
        service_count: 0,
      });
    } catch (err) {
      fastify.log.error(`Failed to create project: ${err.message}`);

      // Attempt to clean up the namespace if database insert failed
      try {
        await deleteNamespace(namespace);
      } catch (cleanupErr) {
        fastify.log.error(`Failed to cleanup namespace after error: ${cleanupErr.message}`);
      }

      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create project',
      });
    }
  });

  /**
   * GET /projects/:id
   * Get project details with services
   */
  fastify.get('/projects/:id', { schema: projectParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const projectId = request.params.id;

    try {
      // Get project
      const projectResult = await fastify.db.query(
        'SELECT id, user_id, name, created_at FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const project = projectResult.rows[0];

      // Verify ownership
      if (project.user_id !== userId) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }

      // Get services for this project
      const servicesResult = await fastify.db.query(
        `SELECT
          s.id,
          s.name,
          s.repo_url,
          s.branch,
          s.dockerfile_path,
          s.port,
          s.storage_gb,
          s.health_check_path,
          s.created_at,
          d.status AS current_status,
          d.created_at AS last_deployment_at
        FROM services s
        LEFT JOIN LATERAL (
          SELECT status, created_at
          FROM deployments
          WHERE service_id = s.id
          ORDER BY created_at DESC
          LIMIT 1
        ) d ON true
        WHERE s.project_id = $1
        ORDER BY s.created_at DESC`,
        [projectId]
      );

      const namespace = computeNamespace(request.user.hash, project.name);

      return {
        id: project.id,
        name: project.name,
        namespace,
        created_at: project.created_at,
        services: servicesResult.rows,
      };
    } catch (err) {
      fastify.log.error(`Failed to get project: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get project',
      });
    }
  });

  /**
   * DELETE /projects/:id
   * Delete a project and its Kubernetes namespace
   */
  fastify.delete('/projects/:id', { schema: projectParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const projectId = request.params.id;

    try {
      // Get project
      const projectResult = await fastify.db.query(
        'SELECT id, user_id, name FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      const project = projectResult.rows[0];

      // Verify ownership
      if (project.user_id !== userId) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Access denied',
        });
      }

      const namespace = computeNamespace(request.user.hash, project.name);

      // Delete Harbor repositories (cleanup container images)
      try {
        const harborResult = await deleteRepositoriesByNamespace(namespace);
        if (harborResult.deleted > 0) {
          fastify.log.info(`Deleted ${harborResult.deleted} Harbor repositories for namespace: ${namespace}`);
        }
      } catch (harborErr) {
        // Log but continue - Harbor cleanup is best-effort
        fastify.log.warn(`Failed to cleanup Harbor repositories: ${harborErr.message}`);
      }

      // Delete Kubernetes namespace (cascades all resources)
      try {
        await deleteNamespace(namespace);
        fastify.log.info(`Deleted Kubernetes namespace: ${namespace}`);
      } catch (k8sErr) {
        // Log but continue - namespace might not exist or already deleted
        if (k8sErr.status !== 404) {
          fastify.log.warn(`Failed to delete Kubernetes namespace: ${k8sErr.message}`);
        }
      }

      // Delete from database (cascades services, env_vars, deployments)
      await fastify.db.query('DELETE FROM projects WHERE id = $1', [projectId]);

      fastify.log.info(`Deleted project: ${project.name} (${projectId})`);

      return { success: true, message: 'Project deleted successfully' };
    } catch (err) {
      fastify.log.error(`Failed to delete project: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete project',
      });
    }
  });
}
