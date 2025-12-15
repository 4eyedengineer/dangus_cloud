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

export async function fetchWebhookSecret(id) {
  return apiFetch(`/services/${id}/webhook-secret`);
}
