import crypto from 'crypto';
import dns from 'dns';
import { promisify } from 'util';
import { applyManifest, deleteIngress, getSecret } from '../services/kubernetes.js';
import { generateDomainIngressManifest } from '../services/manifestGenerator.js';

const resolveCname = promisify(dns.resolveCname);
const resolveTxt = promisify(dns.resolveTxt);

const BASE_DOMAIN = process.env.BASE_DOMAIN || '192.168.1.124.nip.io';

// Domain validation regex (basic format check)
const DOMAIN_REGEX = /^(?!-)([a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,}$/;

function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > 255) return false;
  return DOMAIN_REGEX.test(domain);
}

function computeSubdomain(userHash, serviceName) {
  return `${userHash}-${serviceName}`;
}

function computeNamespace(userHash, projectName) {
  return `${userHash}-${projectName}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function computeDomainHash(domain) {
  return crypto.createHash('md5').update(domain).digest('hex').substring(0, 8);
}

export default async function domainRoutes(fastify, options) {
  const serviceParamsSchema = {
    params: {
      type: 'object',
      required: ['serviceId'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
      },
    },
  };

  const domainIdParamsSchema = {
    params: {
      type: 'object',
      required: ['serviceId', 'domainId'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
        domainId: { type: 'string', format: 'uuid' },
      },
    },
  };

  const addDomainSchema = {
    body: {
      type: 'object',
      required: ['domain'],
      properties: {
        domain: { type: 'string' },
      },
    },
  };

  /**
   * Helper to verify service ownership
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
   * GET /services/:serviceId/domains
   * List all custom domains for a service
   */
  fastify.get('/services/:serviceId/domains', { schema: serviceParamsSchema }, async (request, reply) => {
    const userId = request.user.id;
    const serviceId = request.params.serviceId;

    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    try {
      const result = await fastify.db.query(
        `SELECT id, domain, verified, tls_enabled, certificate_status, created_at, verified_at
         FROM custom_domains
         WHERE service_id = $1
         ORDER BY created_at DESC`,
        [serviceId]
      );

      return { domains: result.rows };
    } catch (err) {
      fastify.log.error(`Failed to list domains: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list domains',
      });
    }
  });

  /**
   * POST /services/:serviceId/domains
   * Add a custom domain to a service
   */
  fastify.post('/services/:serviceId/domains', {
    schema: { ...serviceParamsSchema, ...addDomainSchema },
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.serviceId;
    const { domain } = request.body;

    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;

    // Validate domain format
    const normalizedDomain = domain.toLowerCase().trim();
    if (!isValidDomain(normalizedDomain)) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Invalid domain format',
      });
    }

    // Check if domain is already registered
    const existing = await fastify.db.query(
      'SELECT id FROM custom_domains WHERE domain = $1',
      [normalizedDomain]
    );

    if (existing.rows.length > 0) {
      return reply.code(409).send({
        error: 'Conflict',
        message: 'Domain is already registered',
      });
    }

    try {
      const verificationToken = generateVerificationToken();
      const subdomain = computeSubdomain(userHash, service.name);

      const result = await fastify.db.query(
        `INSERT INTO custom_domains (service_id, domain, verification_token)
         VALUES ($1, $2, $3)
         RETURNING id, domain, verified, tls_enabled, certificate_status, created_at`,
        [serviceId, normalizedDomain, verificationToken]
      );

      const domainRecord = result.rows[0];

      fastify.log.info(`Added custom domain ${normalizedDomain} to service ${serviceId}`);

      return reply.code(201).send({
        ...domainRecord,
        verification_method: 'CNAME',
        verification_target: `${subdomain}.${BASE_DOMAIN}`,
        verification_instructions: `Add a CNAME record pointing ${normalizedDomain} to ${subdomain}.${BASE_DOMAIN}`,
      });
    } catch (err) {
      fastify.log.error(`Failed to add domain: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add domain',
      });
    }
  });

  /**
   * POST /services/:serviceId/domains/:domainId/verify
   * Verify DNS configuration and provision TLS certificate
   */
  fastify.post('/services/:serviceId/domains/:domainId/verify', {
    schema: domainIdParamsSchema,
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.serviceId;
    const domainId = request.params.domainId;

    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;
    const subdomain = computeSubdomain(userHash, service.name);
    const namespace = computeNamespace(userHash, service.project_name);
    const expectedTarget = `${subdomain}.${BASE_DOMAIN}`;

    // Get domain record
    const domainResult = await fastify.db.query(
      'SELECT * FROM custom_domains WHERE id = $1 AND service_id = $2',
      [domainId, serviceId]
    );

    if (domainResult.rows.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Domain not found',
      });
    }

    const domainRecord = domainResult.rows[0];

    // If already verified, return success
    if (domainRecord.verified) {
      return {
        verified: true,
        tls_enabled: domainRecord.tls_enabled,
        certificate_status: domainRecord.certificate_status,
        message: 'Domain is already verified',
      };
    }

    try {
      // Try to resolve CNAME
      let verified = false;
      let records = [];

      try {
        records = await resolveCname(domainRecord.domain);
        // Check if any CNAME record points to our target
        verified = records.some(record =>
          record.toLowerCase() === expectedTarget.toLowerCase()
        );
      } catch (dnsErr) {
        // CNAME lookup failed, domain might not be configured
        fastify.log.warn(`DNS lookup failed for ${domainRecord.domain}: ${dnsErr.message}`);
      }

      if (!verified) {
        return reply.code(400).send({
          error: 'Verification Failed',
          message: `DNS verification failed. Please add a CNAME record pointing ${domainRecord.domain} to ${expectedTarget}`,
          expected_target: expectedTarget,
          found_records: records,
        });
      }

      // DNS verified - create ingress with TLS
      const domainHash = computeDomainHash(domainRecord.domain);
      const ingressName = `${service.name}-domain-${domainHash}`;
      const secretName = `${service.name}-${domainHash}-tls`;

      const ingressManifest = generateDomainIngressManifest({
        namespace,
        serviceName: service.name,
        port: service.port,
        domain: domainRecord.domain,
        ingressName,
        secretName,
      });

      await applyManifest(ingressManifest);

      // Update database
      await fastify.db.query(
        `UPDATE custom_domains
         SET verified = true, verified_at = NOW(), tls_enabled = true, certificate_status = 'pending'
         WHERE id = $1`,
        [domainId]
      );

      fastify.log.info(`Verified domain ${domainRecord.domain} for service ${serviceId}, created ingress ${ingressName}`);

      return {
        verified: true,
        tls_enabled: true,
        certificate_status: 'pending',
        message: 'Domain verified. TLS certificate is being provisioned.',
      };
    } catch (err) {
      fastify.log.error(`Failed to verify domain: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify domain',
      });
    }
  });

  /**
   * GET /services/:serviceId/domains/:domainId
   * Get details for a specific domain including verification info
   */
  fastify.get('/services/:serviceId/domains/:domainId', {
    schema: domainIdParamsSchema,
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.serviceId;
    const domainId = request.params.domainId;

    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;
    const subdomain = computeSubdomain(userHash, service.name);
    const namespace = computeNamespace(userHash, service.project_name);

    const result = await fastify.db.query(
      'SELECT * FROM custom_domains WHERE id = $1 AND service_id = $2',
      [domainId, serviceId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Domain not found',
      });
    }

    const domainRecord = result.rows[0];
    const response = {
      ...domainRecord,
      verification_method: 'CNAME',
      verification_target: `${subdomain}.${BASE_DOMAIN}`,
    };

    // If verified, check TLS certificate status
    if (domainRecord.verified) {
      const domainHash = computeDomainHash(domainRecord.domain);
      const secretName = `${service.name}-${domainHash}-tls`;

      try {
        const secret = await getSecret(namespace, secretName);
        if (secret && secret.data && secret.data['tls.crt']) {
          // Certificate exists
          response.certificate_status = 'issued';

          // Update DB if status changed
          if (domainRecord.certificate_status !== 'issued') {
            await fastify.db.query(
              'UPDATE custom_domains SET certificate_status = $1 WHERE id = $2',
              ['issued', domainId]
            );
          }
        }
      } catch (err) {
        fastify.log.warn(`Failed to check certificate for ${domainRecord.domain}: ${err.message}`);
      }
    }

    return response;
  });

  /**
   * DELETE /services/:serviceId/domains/:domainId
   * Remove a custom domain
   */
  fastify.delete('/services/:serviceId/domains/:domainId', {
    schema: domainIdParamsSchema,
  }, async (request, reply) => {
    const userId = request.user.id;
    const userHash = request.user.hash;
    const serviceId = request.params.serviceId;
    const domainId = request.params.domainId;

    const ownershipCheck = await verifyServiceOwnership(serviceId, userId);
    if (ownershipCheck.error) {
      return reply.code(ownershipCheck.status).send({
        error: ownershipCheck.status === 404 ? 'Not Found' : 'Forbidden',
        message: ownershipCheck.error,
      });
    }

    const { service } = ownershipCheck;
    const namespace = computeNamespace(userHash, service.project_name);

    // Get domain record
    const result = await fastify.db.query(
      'SELECT * FROM custom_domains WHERE id = $1 AND service_id = $2',
      [domainId, serviceId]
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Domain not found',
      });
    }

    const domainRecord = result.rows[0];

    try {
      // If domain was verified, clean up K8s resources
      if (domainRecord.verified) {
        const domainHash = computeDomainHash(domainRecord.domain);
        const ingressName = `${service.name}-domain-${domainHash}`;

        try {
          await deleteIngress(namespace, ingressName);
          fastify.log.info(`Deleted ingress ${ingressName} for domain ${domainRecord.domain}`);
        } catch (k8sErr) {
          if (k8sErr.status !== 404) {
            fastify.log.warn(`Failed to delete ingress ${ingressName}: ${k8sErr.message}`);
          }
        }
      }

      // Delete from database
      await fastify.db.query('DELETE FROM custom_domains WHERE id = $1', [domainId]);

      fastify.log.info(`Deleted custom domain ${domainRecord.domain} from service ${serviceId}`);

      return { success: true, message: 'Domain deleted successfully' };
    } catch (err) {
      fastify.log.error(`Failed to delete domain: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete domain',
      });
    }
  });
}
