import { apiFetch } from './utils.js';

export async function fetchDomains(serviceId) {
  const response = await apiFetch(`/services/${serviceId}/domains`);
  return response.domains;
}

export async function addDomain(serviceId, domain) {
  return apiFetch(`/services/${serviceId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
}

export async function getDomain(serviceId, domainId) {
  return apiFetch(`/services/${serviceId}/domains/${domainId}`);
}

export async function verifyDomain(serviceId, domainId) {
  return apiFetch(`/services/${serviceId}/domains/${domainId}/verify`, {
    method: 'POST',
  });
}

export async function deleteDomain(serviceId, domainId) {
  return apiFetch(`/services/${serviceId}/domains/${domainId}`, {
    method: 'DELETE',
  });
}
