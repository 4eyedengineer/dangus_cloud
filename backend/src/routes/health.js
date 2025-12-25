/**
 * Health summary routes for dashboard
 * Provides aggregated system health status across all projects and services
 */

export default async function healthRoutes(fastify, options) {
  /**
   * GET /api/health/summary
   * Returns aggregated health status for dashboard display
   */
  fastify.get('/api/health/summary', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    const userId = request.user.id;

    // Get all projects for this user with their services
    // Note: namespace is the same as project name in this system
    const projectsResult = await fastify.db.query(`
      SELECT p.id, p.name, p.name as namespace
      FROM projects p
      WHERE p.user_id = $1
    `, [userId]);

    if (projectsResult.rows.length === 0) {
      return {
        errors: [],
        warnings: [],
        activeDeployments: [],
        recentActivity: [],
        summary: { running: 0, deploying: 0, warning: 0, failed: 0 }
      };
    }

    const projectIds = projectsResult.rows.map(p => p.id);

    // Get all services with their latest deployment status
    const servicesResult = await fastify.db.query(`
      SELECT
        s.id,
        s.name,
        s.project_id,
        s.health_check_path,
        p.name as project_name,
        d.id as deployment_id,
        d.status as deployment_status,
        d.created_at as deployment_created_at
      FROM services s
      JOIN projects p ON s.project_id = p.id
      LEFT JOIN LATERAL (
        SELECT id, status, created_at
        FROM deployments
        WHERE service_id = s.id
        ORDER BY created_at DESC
        LIMIT 1
      ) d ON true
      WHERE s.project_id = ANY($1)
      ORDER BY d.created_at DESC NULLS LAST
    `, [projectIds]);

    const errors = [];
    const warnings = [];
    const activeDeployments = [];
    const recentActivity = [];
    let running = 0;
    let deploying = 0;
    let warning = 0;
    let failed = 0;

    const now = new Date();

    for (const svc of servicesResult.rows) {
      const status = svc.deployment_status;

      // Count statuses
      if (status === 'live') {
        running++;
        // Add to recent activity if deployed in last 24h
        if (svc.deployment_created_at) {
          const deployedAt = new Date(svc.deployment_created_at);
          const hoursSince = (now - deployedAt) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            recentActivity.push({
              type: 'deployment_success',
              service: { id: svc.id, name: svc.name },
              project: { id: svc.project_id, name: svc.project_name },
              timestamp: svc.deployment_created_at
            });
          }
        }
      } else if (status === 'failed') {
        failed++;
        errors.push({
          type: 'deployment_failed',
          service: { id: svc.id, name: svc.name },
          project: { id: svc.project_id, name: svc.project_name },
          message: 'Deployment failed',
          deploymentId: svc.deployment_id,
          timestamp: svc.deployment_created_at
        });
      } else if (['pending', 'building', 'deploying'].includes(status)) {
        deploying++;
        activeDeployments.push({
          service: { id: svc.id, name: svc.name },
          project: { id: svc.project_id, name: svc.project_name },
          status: status,
          startedAt: svc.deployment_created_at,
          deploymentId: svc.deployment_id
        });
      }

      // TODO: Check actual health check status from k8s when implemented
      // For now, we only track deployment status
    }

    // Sort recent activity by timestamp descending, limit to 5
    recentActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedRecentActivity = recentActivity.slice(0, 5);

    return {
      errors,
      warnings,
      activeDeployments,
      recentActivity: limitedRecentActivity,
      summary: { running, deploying, warning, failed }
    };
  });
}
