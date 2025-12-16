import { apiFetch } from './utils.js';

/**
 * List repositories accessible to the authenticated user
 * @param {object} options - Query options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.perPage - Results per page
 * @param {string} options.search - Search query
 * @returns {Promise<{repos: Array, hasMore: boolean}>}
 */
export async function listRepos(options = {}) {
  const params = new URLSearchParams();
  if (options.page) params.set('page', options.page);
  if (options.perPage) params.set('perPage', options.perPage);
  if (options.search) params.set('search', options.search);

  const query = params.toString();
  return apiFetch(`/github/repos${query ? `?${query}` : ''}`);
}

/**
 * Analyze a repository for docker-compose and Dockerfiles
 * @param {string} repoUrl - Repository URL
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<object>} Analysis result with composeServices and standaloneDockerfiles
 */
export async function analyzeRepo(repoUrl, branch) {
  return apiFetch('/github/analyze', {
    method: 'POST',
    body: JSON.stringify({ repoUrl, branch })
  });
}

/**
 * List branches for a repository
 * @param {string} repoUrl - Repository URL
 * @param {string} search - Search filter (optional)
 * @returns {Promise<{branches: Array<{name: string, protected: boolean, isDefault: boolean}>}>}
 */
export async function listBranches(repoUrl, search = '') {
  const params = new URLSearchParams();
  params.set('repo_url', repoUrl);
  if (search) params.set('search', search);

  return apiFetch(`/github/branches?${params.toString()}`);
}
