import { Octokit } from '@octokit/rest';

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(type, owner, repo, extra = '') {
  return `${type}:${owner}/${repo}:${extra}`;
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL
  });
}

/**
 * Parse GitHub URL to extract owner and repo
 * Handles:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - git@github.com:owner/repo.git
 */
export function parseGitHubUrl(url) {
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${url}`);
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Create an Octokit instance with rate limit handling
 */
function createOctokit(token) {
  return new Octokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Rate limit hit for ${options.method} ${options.url}`);
        if (retryCount < 2) {
          octokit.log.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(`Secondary rate limit hit for ${options.method} ${options.url}`);
        return false;
      }
    }
  });
}

/**
 * Validate if a token has access to a repository
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - GitHub repository URL
 * @returns {Promise<{valid: boolean, permissions?: object, error?: string}>}
 */
export async function validateRepoAccess(token, repoUrl) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = getCacheKey('access', owner, repo, token.slice(-8));

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.get({ owner, repo });
    const result = {
      valid: true,
      permissions: data.permissions
    };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error.status === 404) {
      return { valid: false, error: 'Repository not found or no access' };
    }
    if (error.status === 401) {
      return { valid: false, error: 'Invalid or expired token' };
    }
    if (error.status === 403) {
      return { valid: false, error: 'Access forbidden - check token permissions' };
    }
    throw error;
  }
}

/**
 * Get the latest commit SHA for a branch
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} branch - Branch name (defaults to repo's default branch)
 * @returns {Promise<{sha: string, message: string, author: string, date: string}>}
 */
export async function getLatestCommit(token, repoUrl, branch) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // If no branch specified, get the default branch first
  if (!branch) {
    const repoInfo = await getRepoInfo(token, repoUrl);
    branch = repoInfo.defaultBranch;
  }

  const cacheKey = getCacheKey('commit', owner, repo, branch);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.repos.getBranch({ owner, repo, branch });
    const commit = data.commit;
    const result = {
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author.name,
      date: commit.commit.author.date
    };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Branch '${branch}' not found`);
    }
    throw error;
  }
}

/**
 * Get repository metadata
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - GitHub repository URL
 * @returns {Promise<{defaultBranch: string, isPrivate: boolean, fullName: string, description: string}>}
 */
export async function getRepoInfo(token, repoUrl) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = getCacheKey('info', owner, repo);

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  const { data } = await octokit.repos.get({ owner, repo });
  const result = {
    defaultBranch: data.default_branch,
    isPrivate: data.private,
    fullName: data.full_name,
    description: data.description
  };
  setCache(cacheKey, result);
  return result;
}

/**
 * Clear the cache (useful for testing or forcing fresh data)
 */
export function clearCache() {
  cache.clear();
}
