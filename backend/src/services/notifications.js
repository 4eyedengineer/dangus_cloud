import nodemailer from 'nodemailer';
import crypto from 'crypto';
import logger from './logger.js';

/**
 * Send deployment notification (webhook and/or email) based on user preferences
 * @param {object} db - Database connection
 * @param {object} deployment - Deployment object with status
 * @param {object} service - Service object
 * @param {object} project - Project object with user_id
 */
export async function sendDeploymentNotification(db, deployment, service, project) {
  const settings = await db.query(
    'SELECT * FROM notification_settings WHERE user_id = $1',
    [project.user_id]
  );

  if (!settings.rows[0]) {
    logger.debug('No notification settings found for user', { userId: project.user_id });
    return;
  }

  const prefs = settings.rows[0];
  const isSuccess = deployment.status === 'live';

  // Check if user wants this type of notification
  if (isSuccess && !prefs.notify_on_success) {
    logger.debug('User disabled success notifications', { userId: project.user_id });
    return;
  }
  if (!isSuccess && !prefs.notify_on_failure) {
    logger.debug('User disabled failure notifications', { userId: project.user_id });
    return;
  }

  const payload = {
    event: 'deployment.completed',
    deployment: {
      id: deployment.id,
      status: deployment.status,
      commit_sha: deployment.commit_sha,
      created_at: deployment.created_at,
    },
    service: {
      id: service.id,
      name: service.name,
      url: service.url || null,
    },
    project: {
      id: project.id,
      name: project.name,
    },
    timestamp: new Date().toISOString(),
  };

  // Send webhook notification
  if (prefs.webhook_enabled && prefs.webhook_url) {
    await sendWebhook(db, project.user_id, deployment.id, prefs, payload);
  }

  // Send email notification
  if (prefs.email_enabled && prefs.email_address) {
    await sendEmail(db, project.user_id, deployment.id, prefs, payload, service);
  }
}

/**
 * Send webhook notification
 */
async function sendWebhook(db, userId, deploymentId, prefs, payload) {
  const signature = crypto
    .createHmac('sha256', prefs.webhook_secret || '')
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(prefs.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dangus-Signature': `sha256=${signature}`,
        'X-Dangus-Event': 'deployment.completed',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    await db.query(
      `INSERT INTO notifications (user_id, deployment_id, type, status, sent_at)
       VALUES ($1, $2, 'webhook', 'sent', NOW())`,
      [userId, deploymentId]
    );

    logger.info('Webhook notification sent', { userId, deploymentId, url: prefs.webhook_url });
  } catch (error) {
    const errorMessage = error.name === 'AbortError' ? 'Request timed out' : error.message;

    await db.query(
      `INSERT INTO notifications (user_id, deployment_id, type, status, error)
       VALUES ($1, $2, 'webhook', 'failed', $3)`,
      [userId, deploymentId, errorMessage]
    );

    logger.error('Webhook notification failed', { userId, deploymentId, error: errorMessage });
  }
}

/**
 * Send email notification
 */
async function sendEmail(db, userId, deploymentId, prefs, payload, service) {
  // Check if SMTP is configured
  if (!process.env.SMTP_HOST) {
    logger.warn('SMTP not configured, skipping email notification');
    await db.query(
      `INSERT INTO notifications (user_id, deployment_id, type, status, error)
       VALUES ($1, $2, 'email', 'failed', $3)`,
      [userId, deploymentId, 'SMTP not configured']
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });

  const statusEmoji = payload.deployment.status === 'live' ? '✅' : '❌';
  const statusText = payload.deployment.status === 'live' ? 'succeeded' : 'failed';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Dangus Cloud" <notifications@dangus.cloud>',
      to: prefs.email_address,
      subject: `${statusEmoji} Deployment ${statusText}: ${service.name}`,
      html: `
        <div style="font-family: monospace; background: #0a0a0a; color: #00ff00; padding: 20px; border: 1px solid #00ff00;">
          <h2 style="color: ${payload.deployment.status === 'live' ? '#00ff00' : '#ff0000'};">
            Deployment ${statusText}
          </h2>
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Project:</strong> ${payload.project.name}</p>
          <p><strong>Status:</strong> ${payload.deployment.status}</p>
          <p><strong>Commit:</strong> ${payload.deployment.commit_sha || 'N/A'}</p>
          ${service.url ? `<p><strong>URL:</strong> <a href="${service.url}" style="color: #00ff00;">${service.url}</a></p>` : ''}
          <p style="margin-top: 20px;">
            <a href="${frontendUrl}/services/${service.id}" style="color: #00ff00; border: 1px solid #00ff00; padding: 10px 20px; text-decoration: none;">
              View in Dashboard
            </a>
          </p>
        </div>
      `,
      text: `
Deployment ${statusText}

Service: ${service.name}
Project: ${payload.project.name}
Status: ${payload.deployment.status}
Commit: ${payload.deployment.commit_sha || 'N/A'}
${service.url ? `URL: ${service.url}` : ''}

View in Dashboard: ${frontendUrl}/services/${service.id}
      `.trim(),
    });

    await db.query(
      `INSERT INTO notifications (user_id, deployment_id, type, status, sent_at)
       VALUES ($1, $2, 'email', 'sent', NOW())`,
      [userId, deploymentId]
    );

    logger.info('Email notification sent', { userId, deploymentId, to: prefs.email_address });
  } catch (error) {
    await db.query(
      `INSERT INTO notifications (user_id, deployment_id, type, status, error)
       VALUES ($1, $2, 'email', 'failed', $3)`,
      [userId, deploymentId, error.message]
    );

    logger.error('Email notification failed', { userId, deploymentId, error: error.message });
  }
}

/**
 * Send a test notification to verify settings
 * @param {object} db - Database connection
 * @param {string} userId - User ID
 * @returns {Promise<{webhook?: {success: boolean, error?: string}, email?: {success: boolean, error?: string}}>}
 */
export async function sendTestNotification(db, userId) {
  const settings = await db.query(
    'SELECT * FROM notification_settings WHERE user_id = $1',
    [userId]
  );

  if (!settings.rows[0]) {
    throw new Error('No notification settings configured');
  }

  const prefs = settings.rows[0];
  const results = {};

  const testPayload = {
    event: 'test',
    message: 'This is a test notification from Dangus Cloud',
    timestamp: new Date().toISOString(),
  };

  // Test webhook
  if (prefs.webhook_enabled && prefs.webhook_url) {
    const signature = crypto
      .createHmac('sha256', prefs.webhook_secret || '')
      .update(JSON.stringify(testPayload))
      .digest('hex');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(prefs.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dangus-Signature': `sha256=${signature}`,
          'X-Dangus-Event': 'test',
        },
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      results.webhook = { success: true };
    } catch (error) {
      results.webhook = {
        success: false,
        error: error.name === 'AbortError' ? 'Request timed out' : error.message,
      };
    }
  }

  // Test email
  if (prefs.email_enabled && prefs.email_address) {
    if (!process.env.SMTP_HOST) {
      results.email = { success: false, error: 'SMTP not configured' };
    } else {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });

      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Dangus Cloud" <notifications@dangus.cloud>',
          to: prefs.email_address,
          subject: 'Test Notification - Dangus Cloud',
          html: `
            <div style="font-family: monospace; background: #0a0a0a; color: #00ff00; padding: 20px; border: 1px solid #00ff00;">
              <h2 style="color: #00ff00;">Test Notification</h2>
              <p>Your email notifications are configured correctly.</p>
              <p style="color: #888;">Sent at: ${new Date().toISOString()}</p>
            </div>
          `,
          text: 'Test Notification\n\nYour email notifications are configured correctly.',
        });

        results.email = { success: true };
      } catch (error) {
        results.email = { success: false, error: error.message };
      }
    }
  }

  return results;
}

/**
 * Generate a new webhook secret
 * @returns {string} 64-character hex string
 */
export function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}
