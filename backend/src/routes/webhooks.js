import crypto from 'crypto';

/**
 * Verify GitHub webhook signature using HMAC SHA-256
 * @param {string} payload - Raw request body
 * @param {string} signature - x-hub-signature-256 header value
 * @param {string} secret - Webhook secret for this service
 * @param {object} logger - Logger instance
 * @returns {boolean} True if signature is valid
 */
function verifySignature(payload, signature, secret, logger) {
  if (!signature || !secret) {
    logger?.warn('Webhook signature verification failed: missing signature or secret');
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch (err) {
    // timingSafeEqual throws if buffers have different lengths
    // This indicates a malformed or incorrect signature
    logger?.warn('Webhook signature verification failed: signature length mismatch', {
      signatureLength: signature?.length,
      expectedLength: expected?.length,
      error: err.message
    });
    return false;
  }
}

/**
 * Extract branch name from GitHub ref
 * @param {string} ref - Git ref (e.g., "refs/heads/main")
 * @returns {string|null} Branch name or null
 */
function extractBranch(ref) {
  if (!ref || typeof ref !== 'string') {
    return null;
  }

  const prefix = 'refs/heads/';
  if (ref.startsWith(prefix)) {
    return ref.slice(prefix.length);
  }

  return null;
}

export default async function webhookRoutes(fastify, options) {
  // Use raw body for signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    req.rawBody = body;
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err) {
      done(err, undefined);
    }
  });

  /**
   * POST /webhooks/github/:serviceId
   * Handle GitHub webhook events
   */
  fastify.post('/webhooks/github/:serviceId', async (request, reply) => {
    const serviceId = request.params.serviceId;
    const event = request.headers['x-github-event'];
    const signature = request.headers['x-hub-signature-256'];
    const deliveryId = request.headers['x-github-delivery'];

    fastify.log.info({
      msg: 'Webhook received',
      serviceId,
      event,
      deliveryId,
    });

    // Validate serviceId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serviceId)) {
      fastify.log.warn({ msg: 'Invalid service ID format', serviceId });
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Service not found',
      });
    }

    // Look up service and get webhook secret
    let service;
    try {
      const result = await fastify.db.query(
        `SELECT s.id, s.name, s.repo_url, s.branch, s.webhook_secret, s.project_id
         FROM services s
         WHERE s.id = $1`,
        [serviceId]
      );

      if (result.rows.length === 0) {
        fastify.log.warn({ msg: 'Service not found', serviceId });
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Service not found',
        });
      }

      service = result.rows[0];
    } catch (err) {
      fastify.log.error({ msg: 'Database error looking up service', error: err.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process webhook',
      });
    }

    // Verify signature
    if (!verifySignature(request.rawBody, signature, service.webhook_secret, fastify.log)) {
      fastify.log.warn({ msg: 'Invalid webhook signature', serviceId, deliveryId });
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid signature',
      });
    }

    // Handle ping event
    if (event === 'ping') {
      fastify.log.info({ msg: 'Ping event received', serviceId, deliveryId });
      return { pong: true, zen: request.body.zen };
    }

    // Only process push events
    if (event !== 'push') {
      fastify.log.info({ msg: 'Ignoring non-push event', serviceId, event, deliveryId });
      return { ignored: true, reason: `Event type '${event}' not processed` };
    }

    // Extract branch and commit from push payload
    const payload = request.body;
    const branch = extractBranch(payload.ref);
    const commitSha = payload.after;

    if (!branch || !commitSha) {
      fastify.log.warn({ msg: 'Invalid push payload', serviceId, ref: payload.ref, after: payload.after });
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid push payload',
      });
    }

    // Check if push is to the configured branch
    if (branch !== service.branch) {
      fastify.log.info({
        msg: 'Ignoring push to non-configured branch',
        serviceId,
        pushBranch: branch,
        configuredBranch: service.branch,
      });
      return { ignored: true, reason: `Push to '${branch}' ignored, watching '${service.branch}'` };
    }

    // Skip if this is a branch deletion (all zeros commit)
    if (commitSha === '0000000000000000000000000000000000000000') {
      fastify.log.info({ msg: 'Ignoring branch deletion', serviceId, branch });
      return { ignored: true, reason: 'Branch deletion ignored' };
    }

    // Create deployment record with pending status
    let deployment;
    try {
      const result = await fastify.db.query(
        `INSERT INTO deployments (service_id, commit_sha, status)
         VALUES ($1, $2, 'pending')
         RETURNING id, service_id, commit_sha, status, created_at`,
        [serviceId, commitSha]
      );

      deployment = result.rows[0];

      fastify.log.info({
        msg: 'Deployment created from webhook',
        deploymentId: deployment.id,
        serviceId,
        commitSha,
        branch,
      });
    } catch (err) {
      fastify.log.error({ msg: 'Failed to create deployment', error: err.message });
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create deployment',
      });
    }

    // Return immediately - build will be triggered asynchronously
    // TODO: Trigger build pipeline (will be implemented in build service)
    return reply.code(200).send({
      received: true,
      deployment_id: deployment.id,
      commit_sha: commitSha,
      branch,
    });
  });
}
