import { apiFetch } from './utils.js';

export async function createService(projectId, data) {
  return apiFetch(`/projects/${projectId}/services`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchService(id) {
  return apiFetch(`/services/${id}`);
}

export async function updateService(id, data) {
  return apiFetch(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteService(id) {
  return apiFetch(`/services/${id}`, {
    method: 'DELETE',
  });
}

export async function triggerDeploy(id) {
  return apiFetch(`/services/${id}/deploy`, {
    method: 'POST',
  });
}

export async function restartService(id, type = 'rolling') {
  return apiFetch(`/services/${id}/restart`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
}

export async function fetchWebhookSecret(id) {
  return apiFetch(`/services/${id}/webhook-secret`);
}

export async function fetchServiceMetrics(id) {
  return apiFetch(`/services/${id}/metrics`);
}

/**
 * Create multiple services at once
 * @param {string} projectId - Project ID
 * @param {Array} services - Array of service configurations
 * @returns {Promise<{created: Array, errors: Array, summary: object}>}
 */
export async function createServicesBatch(projectId, services) {
  return apiFetch(`/projects/${projectId}/services/batch`, {
    method: 'POST',
    body: JSON.stringify({ services })
  });
}

/**
 * Validate the Dockerfile for a service
 * @param {string} id - Service ID
 * @returns {Promise<{valid: boolean, errors: Array, warnings: Array, summary: object, dockerfile_path: string}>}
 */
export async function validateDockerfile(id) {
  return apiFetch(`/services/${id}/validate-dockerfile`, {
    method: 'POST'
  });
}
