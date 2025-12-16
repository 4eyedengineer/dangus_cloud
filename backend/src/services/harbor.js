import https from 'https';
import http from 'http';
import logger from './logger.js';

const HARBOR_REGISTRY = process.env.HARBOR_REGISTRY || 'harbor.192.168.1.124.nip.io';
const HARBOR_PROJECT = process.env.HARBOR_PROJECT || 'dangus';
const HARBOR_ROBOT_USER = process.env.HARBOR_ROBOT_USER || 'robot$runner';
const HARBOR_ROBOT_PASSWORD = process.env.HARBOR_ROBOT_PASSWORD;

/**
 * Make a request to Harbor API
 * @param {string} method - HTTP method
 * @param {string} path - API path (without /api/v2.0 prefix)
 * @returns {Promise<object>}
 */
async function harborRequest(method, path) {
  if (!HARBOR_ROBOT_PASSWORD) {
    logger.warn('HARBOR_ROBOT_PASSWORD not set - skipping Harbor API request');
    return null;
  }

  const auth = Buffer.from(`${HARBOR_ROBOT_USER}:${HARBOR_ROBOT_PASSWORD}`).toString('base64');
  const url = `https://${HARBOR_REGISTRY}/api/v2.0${path}`;

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      // Skip TLS verification for self-signed certs
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch {
            resolve(data);
          }
        } else if (res.statusCode === 404) {
          // Not found is okay for cleanup operations
          resolve(null);
        } else {
          const error = new Error(`Harbor API error: ${res.statusCode}`);
          error.status = res.statusCode;
          error.body = data;
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * List all repositories in the Harbor project that match a prefix
 * @param {string} prefix - Repository name prefix (e.g., namespace name)
 * @returns {Promise<Array<{name: string}>>}
 */
export async function listRepositories(prefix) {
  try {
    // Harbor API supports q parameter for filtering
    const encodedQuery = encodeURIComponent(`name=~${prefix}`);
    const repos = await harborRequest('GET', `/projects/${HARBOR_PROJECT}/repositories?q=${encodedQuery}&page_size=100`);
    return repos || [];
  } catch (err) {
    logger.error('Failed to list Harbor repositories', { prefix, error: err.message });
    return [];
  }
}

/**
 * Delete a repository from Harbor
 * @param {string} repositoryName - Full repository name (e.g., "namespace/service")
 * @returns {Promise<boolean>}
 */
export async function deleteRepository(repositoryName) {
  try {
    // Repository name needs to be URL encoded (slashes become %2F)
    const encodedName = encodeURIComponent(repositoryName);
    await harborRequest('DELETE', `/projects/${HARBOR_PROJECT}/repositories/${encodedName}`);
    logger.info(`Deleted Harbor repository: ${HARBOR_PROJECT}/${repositoryName}`);
    return true;
  } catch (err) {
    logger.warn('Failed to delete Harbor repository', { repositoryName, error: err.message });
    return false;
  }
}

/**
 * Delete all repositories matching a namespace prefix
 * Used when deleting a project to clean up all associated images
 * @param {string} namespace - Kubernetes namespace (used as repo prefix)
 * @returns {Promise<{deleted: number, failed: number}>}
 */
export async function deleteRepositoriesByNamespace(namespace) {
  const results = { deleted: 0, failed: 0 };

  try {
    const repos = await listRepositories(namespace);

    if (!repos || repos.length === 0) {
      logger.debug(`No Harbor repositories found for namespace: ${namespace}`);
      return results;
    }

    logger.info(`Found ${repos.length} Harbor repositories to delete for namespace: ${namespace}`);

    for (const repo of repos) {
      // repo.name is in format "project/namespace/service" - we need just "namespace/service"
      const repoName = repo.name.replace(`${HARBOR_PROJECT}/`, '');

      if (repoName.startsWith(namespace + '/') || repoName === namespace) {
        const success = await deleteRepository(repoName);
        if (success) {
          results.deleted++;
        } else {
          results.failed++;
        }
      }
    }

    logger.info(`Harbor cleanup complete for namespace ${namespace}`, results);
  } catch (err) {
    logger.error('Failed to cleanup Harbor repositories', { namespace, error: err.message });
  }

  return results;
}
