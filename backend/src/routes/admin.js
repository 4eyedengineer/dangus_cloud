import { getHealthStatus, reconcile } from '../services/reconciliation.js';

/**
 * Admin routes for system health and reconciliation
 * These endpoints provide visibility into DB/K8s consistency
 * and tools to fix discrepancies.
 */
export default async function adminRoutes(fastify, options) {
  /**
   * GET /admin/health
   * Get current health status comparing DB projects vs K8s namespaces
   * Returns orphaned namespaces and ghost projects
   */
  fastify.get('/admin/health', async (request, reply) => {
    try {
      const health = await getHealthStatus(fastify.db);

      // Set appropriate status code based on health
      const statusCode = health.healthy ? 200 : 200; // Still 200 but healthy: false

      return reply.code(statusCode).send(health);
    } catch (err) {
      fastify.log.error(`Admin health check failed: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check system health',
        details: err.message
      });
    }
  });

  /**
   * POST /admin/reconcile
   * Perform reconciliation to fix DB/K8s inconsistencies
   *
   * Body options:
   * - dryRun (boolean, default: true) - Only report what would be done
   * - deleteOrphanedNamespaces (boolean) - Delete K8s namespaces not in DB
   * - recreateMissingNamespaces (boolean) - Recreate K8s namespaces for DB projects
   * - deleteGhostProjects (boolean) - Delete DB projects without K8s namespaces
   * - confirm (string) - Must be "RECONCILE" to perform non-dry-run actions
   */
  fastify.post('/admin/reconcile', {
    schema: {
      body: {
        type: 'object',
        properties: {
          dryRun: { type: 'boolean', default: true },
          deleteOrphanedNamespaces: { type: 'boolean', default: false },
          recreateMissingNamespaces: { type: 'boolean', default: false },
          deleteGhostProjects: { type: 'boolean', default: false },
          confirm: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const {
      dryRun = true,
      deleteOrphanedNamespaces = false,
      recreateMissingNamespaces = false,
      deleteGhostProjects = false,
      confirm
    } = request.body || {};

    // Safety check: require confirmation for non-dry-run
    if (!dryRun && confirm !== 'RECONCILE') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Non-dry-run reconciliation requires confirm: "RECONCILE" in request body',
        hint: 'First run with dryRun: true to see what would be changed'
      });
    }

    // Safety check: prevent conflicting options
    if (recreateMissingNamespaces && deleteGhostProjects) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Cannot both recreate namespaces and delete ghost projects - choose one'
      });
    }

    try {
      fastify.log.info('Starting reconciliation', {
        dryRun,
        deleteOrphanedNamespaces,
        recreateMissingNamespaces,
        deleteGhostProjects,
        userId: request.user?.id
      });

      const result = await reconcile(fastify.db, {
        dryRun,
        deleteOrphanedNamespaces,
        recreateMissingNamespaces,
        deleteGhostProjects
      });

      if (!dryRun) {
        fastify.log.info('Reconciliation completed', {
          actionsCount: result.actions.length,
          errorsCount: result.errors.length,
          success: result.success
        });
      }

      return result;
    } catch (err) {
      fastify.log.error(`Reconciliation failed: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Reconciliation failed',
        details: err.message
      });
    }
  });

  /**
   * GET /admin/stats
   * Get basic system statistics
   */
  fastify.get('/admin/stats', async (request, reply) => {
    try {
      const [projectsResult, servicesResult, deploymentsResult, usersResult] = await Promise.all([
        fastify.db.query('SELECT COUNT(*) as count FROM projects'),
        fastify.db.query('SELECT COUNT(*) as count FROM services'),
        fastify.db.query('SELECT COUNT(*) as count FROM deployments'),
        fastify.db.query('SELECT COUNT(*) as count FROM users')
      ]);

      return {
        timestamp: new Date().toISOString(),
        stats: {
          projects: parseInt(projectsResult.rows[0].count),
          services: parseInt(servicesResult.rows[0].count),
          deployments: parseInt(deploymentsResult.rows[0].count),
          users: parseInt(usersResult.rows[0].count)
        }
      };
    } catch (err) {
      fastify.log.error(`Failed to get stats: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get system stats'
      });
    }
  });
}
