import { apiFetch } from './utils.js';

export async function getCurrentUser() {
  return apiFetch('/auth/me');
}

export async function logout() {
  return apiFetch('/auth/logout', {
    method: 'POST',
  });
}

export function getLoginUrl() {
  // OAuth redirects need to go directly to the backend, not through the proxy
  // VITE_BACKEND_URL must be set in production deployments
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) {
    // Development fallback only - in production this should always be set
    console.warn('VITE_BACKEND_URL not set, using localhost fallback');
    return 'http://localhost:3001/auth/github';
  }
  return `${backendUrl}/auth/github`;
}
