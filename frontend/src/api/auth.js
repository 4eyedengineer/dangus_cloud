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
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  return `${backendUrl}/auth/github`;
}
