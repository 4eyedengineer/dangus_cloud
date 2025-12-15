import { apiFetch } from './utils.js';

export async function fetchEnvVars(serviceId) {
  const response = await apiFetch(`/services/${serviceId}/env`);
  return response.env_vars;
}

export async function createEnvVar(serviceId, key, value) {
  return apiFetch(`/services/${serviceId}/env`, {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
}

export async function updateEnvVar(serviceId, envId, value) {
  return apiFetch(`/services/${serviceId}/env/${envId}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}

export async function deleteEnvVar(serviceId, envId) {
  return apiFetch(`/services/${serviceId}/env/${envId}`, {
    method: 'DELETE',
  });
}

export async function revealEnvVar(serviceId, envId) {
  return apiFetch(`/services/${serviceId}/env/${envId}/value`);
}
