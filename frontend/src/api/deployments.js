import { apiFetch } from './utils.js';

export async function fetchDeployments(serviceId, options = {}) {
  const { limit = 20, offset = 0 } = options;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiFetch(`/services/${serviceId}/deployments?${params}`);
}

export async function fetchDeployment(id) {
  return apiFetch(`/deployments/${id}`);
}
