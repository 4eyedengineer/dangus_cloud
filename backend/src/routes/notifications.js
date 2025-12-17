import { sendTestNotification, generateWebhookSecret } from '../services/notifications.js';

export default async function notificationRoutes(fastify, options) {
  /**
   * GET /notifications/settings
   * Get notification settings for the current user
   */
  fastify.get('/notifications/settings', async (request, reply) => {
    const userId = request.user.id;

    const result = await fastify.db.query(
      `SELECT
        email_enabled, email_address,
        webhook_enabled, webhook_url, webhook_secret,
        notify_on_success, notify_on_failure,
        created_at, updated_at
       FROM notification_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        email_enabled: false,
        email_address: null,
        webhook_enabled: false,
        webhook_url: null,
        webhook_secret: null,
        notify_on_success: true,
        notify_on_failure: true,
      };
    }

    return result.rows[0];
  });

  /**
   * PUT /notifications/settings
   * Update notification settings for the current user
   */
  fastify.put('/notifications/settings', {
    schema: {
      body: {
        type: 'object',
        properties: {
          email_enabled: { type: 'boolean' },
          email_address: { type: 'string', format: 'email', maxLength: 255 },
          webhook_enabled: { type: 'boolean' },
          webhook_url: { type: 'string', format: 'uri', maxLength: 2048 },
          notify_on_success: { type: 'boolean' },
          notify_on_failure: { type: 'boolean' },
          regenerate_secret: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const {
      email_enabled,
      email_address,
      webhook_enabled,
      webhook_url,
      notify_on_success,
      notify_on_failure,
      regenerate_secret,
    } = request.body;

    // Check if settings exist
    const existing = await fastify.db.query(
      'SELECT webhook_secret FROM notification_settings WHERE user_id = $1',
      [userId]
    );

    // Generate webhook secret if enabling webhooks or regenerating
    let webhookSecret = existing.rows[0]?.webhook_secret;
    if (webhook_enabled && (!webhookSecret || regenerate_secret)) {
      webhookSecret = generateWebhookSecret();
    }

    if (existing.rows.length === 0) {
      // Insert new settings
      const result = await fastify.db.query(
        `INSERT INTO notification_settings
          (user_id, email_enabled, email_address, webhook_enabled, webhook_url,
           webhook_secret, notify_on_success, notify_on_failure)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING
           email_enabled, email_address,
           webhook_enabled, webhook_url, webhook_secret,
           notify_on_success, notify_on_failure`,
        [
          userId,
          email_enabled ?? false,
          email_address ?? null,
          webhook_enabled ?? false,
          webhook_url ?? null,
          webhookSecret,
          notify_on_success ?? true,
          notify_on_failure ?? true,
        ]
      );

      return result.rows[0];
    } else {
      // Update existing settings
      const result = await fastify.db.query(
        `UPDATE notification_settings SET
          email_enabled = COALESCE($2, email_enabled),
          email_address = COALESCE($3, email_address),
          webhook_enabled = COALESCE($4, webhook_enabled),
          webhook_url = COALESCE($5, webhook_url),
          webhook_secret = COALESCE($6, webhook_secret),
          notify_on_success = COALESCE($7, notify_on_success),
          notify_on_failure = COALESCE($8, notify_on_failure),
          updated_at = NOW()
         WHERE user_id = $1
         RETURNING
           email_enabled, email_address,
           webhook_enabled, webhook_url, webhook_secret,
           notify_on_success, notify_on_failure`,
        [
          userId,
          email_enabled,
          email_address,
          webhook_enabled,
          webhook_url,
          webhookSecret,
          notify_on_success,
          notify_on_failure,
        ]
      );

      return result.rows[0];
    }
  });

  /**
   * POST /notifications/test
   * Send a test notification
   */
  fastify.post('/notifications/test', async (request, reply) => {
    const userId = request.user.id;

    try {
      const results = await sendTestNotification(fastify.db, userId);

      if (Object.keys(results).length === 0) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'No notification channels enabled',
        });
      }

      return { success: true, results };
    } catch (error) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: error.message,
      });
    }
  });

  /**
   * GET /notifications/history
   * Get notification history for the current user
   */
  fastify.get('/notifications/history', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const userId = request.user.id;
    const { limit = 20, offset = 0 } = request.query;

    const result = await fastify.db.query(
      `SELECT
        n.id, n.deployment_id, n.type, n.status, n.error, n.created_at, n.sent_at,
        d.commit_sha, d.status as deployment_status,
        s.name as service_name
       FROM notifications n
       JOIN deployments d ON n.deployment_id = d.id
       JOIN services s ON d.service_id = s.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await fastify.db.query(
      'SELECT COUNT(*) as total FROM notifications WHERE user_id = $1',
      [userId]
    );

    const total = parseInt(countResult.rows[0].total, 10);

    return {
      notifications: result.rows,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + result.rows.length < total,
      },
    };
  });
}
