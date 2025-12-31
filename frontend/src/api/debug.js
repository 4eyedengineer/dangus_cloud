import { apiFetch } from './utils.js';

/**
 * Start a debug session for a failed deployment
 * @param {string} deploymentId - Deployment UUID
 * @returns {Promise<{sessionId: string, status: string, message: string}>}
 */
export async function startDebugSession(deploymentId) {
  return apiFetch(`/deployments/${deploymentId}/debug`, {
    method: 'POST',
  });
}

/**
 * Get debug session state
 * @param {string} sessionId - Debug session UUID
 * @returns {Promise<object>}
 */
export async function fetchDebugSession(sessionId) {
  return apiFetch(`/debug-sessions/${sessionId}`);
}

/**
 * Get all attempts for a debug session
 * @param {string} sessionId - Debug session UUID
 * @returns {Promise<{sessionId: string, attempts: Array}>}
 */
export async function fetchDebugAttempts(sessionId) {
  return apiFetch(`/debug-sessions/${sessionId}/attempts`);
}

/**
 * Cancel a running debug session
 * @param {string} sessionId - Debug session UUID
 * @returns {Promise<{cancelled: boolean, sessionId: string}>}
 */
export async function cancelDebugSession(sessionId) {
  return apiFetch(`/debug-sessions/${sessionId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Retry a failed debug session
 * @param {string} sessionId - Debug session UUID
 * @returns {Promise<{sessionId: string, previousSessionId: string, status: string}>}
 */
export async function retryDebugSession(sessionId) {
  return apiFetch(`/debug-sessions/${sessionId}/retry`, {
    method: 'POST',
  });
}

/**
 * Rollback a debug session to restore original files
 * @param {string} sessionId - Debug session UUID
 * @returns {Promise<{success: boolean, sessionId: string, restoredFiles: string[]}>}
 */
export async function rollbackDebugSession(sessionId) {
  return apiFetch(`/debug-sessions/${sessionId}/rollback`, {
    method: 'POST',
  });
}

/**
 * Get active or most recent debug session for a service
 * @param {string} serviceId - Service UUID
 * @returns {Promise<{session: object | null}>}
 */
export async function fetchServiceDebugSession(serviceId) {
  return apiFetch(`/services/${serviceId}/debug-session`);
}
