import { apiFetch } from './utils.js';

/**
 * Check if Dockerfile generation is available
 * @returns {Promise<{available: boolean, model: string}>}
 */
export async function getGenerationStatus() {
  return apiFetch('/dockerfile/status');
}

/**
 * Generate a Dockerfile for a repository using LLM
 * @param {string} repoUrl - Repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<{success: boolean, dockerfile: string, dockerignore: string, detectedPort: number, framework: object}>}
 */
export async function generateDockerfile(repoUrl, branch) {
  return apiFetch('/dockerfile/generate', {
    method: 'POST',
    body: JSON.stringify({ repoUrl, branch })
  });
}

/**
 * Get the generated Dockerfile for a service
 * @param {string} serviceId - Service UUID
 * @returns {Promise<{content: string, detectedFramework: object, createdAt: string, updatedAt: string}>}
 */
export async function getGeneratedDockerfile(serviceId) {
  return apiFetch(`/services/${serviceId}/generated-dockerfile`);
}
