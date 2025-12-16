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

/**
 * Fetch container logs for a service
 * @param {string} id - Service ID
 * @param {object} options - Query options
 * @param {number} options.tailLines - Number of lines to fetch (default 100)
 * @param {number} options.sinceSeconds - Fetch logs from last N seconds
 * @param {string} options.pod - Specific pod name
 * @param {string} options.container - Specific container name
 * @returns {Promise<{pods: Array}>}
 */
export async function fetchServiceLogs(id, options = {}) {
  const params = new URLSearchParams();
  if (options.tailLines) params.append('tailLines', options.tailLines);
  if (options.sinceSeconds) params.append('sinceSeconds', options.sinceSeconds);
  if (options.pod) params.append('pod', options.pod);
  if (options.container) params.append('container', options.container);

  const queryString = params.toString();
  const url = `/services/${id}/logs${queryString ? `?${queryString}` : ''}`;
  return apiFetch(url);
}

/**
 * Fetch health check status for a service
 * @param {string} id - Service ID
 * @returns {Promise<{configured: boolean, path?: string, status?: string, pods?: Array, activeCheck?: object, history?: Array, events?: Array}>}
 */
export async function fetchServiceHealth(id) {
  return apiFetch(`/services/${id}/health`);
}
