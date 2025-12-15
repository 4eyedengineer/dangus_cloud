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
  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
  return `${apiBaseUrl}/auth/github`;
}
