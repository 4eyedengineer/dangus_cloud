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

/**
 * List branches for a repository
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - GitHub repository URL
 * @param {string} search - Optional search filter
 * @returns {Promise<Array<{name: string, protected: boolean, isDefault: boolean}>>}
 */
export async function listBranches(token, repoUrl, search = '') {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = getCacheKey('branches', owner, repo, search);

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  // Fetch all branches (paginated)
  const { data } = await octokit.repos.listBranches({
    owner,
    repo,
    per_page: 100
  });

  // Get default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  let branches = data.map(b => ({
    name: b.name,
    protected: b.protected,
    isDefault: b.name === defaultBranch
  }));

  // Filter by search if provided
  if (search) {
    const searchLower = search.toLowerCase();
    branches = branches.filter(b =>
      b.name.toLowerCase().includes(searchLower)
    );
  }

  // Sort: default first, then alphabetically
  branches.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return a.name.localeCompare(b.name);
  });

  setCache(cacheKey, branches);
  return branches;
}

/**
 * List repositories accessible to the authenticated user
 * Includes personal repos and repos from organizations the user belongs to
 * @param {string} token - GitHub personal access token
 * @param {object} options - Pagination options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.perPage - Results per page (max 100)
 * @returns {Promise<{repos: Array, hasMore: boolean}>}
 */
export async function listUserRepos(token, options = {}) {
  const { page = 1, perPage = 30 } = options;
  const cacheKey = `repos:${token.slice(-8)}:${page}:${perPage}`;

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  const { data } = await octokit.repos.listForAuthenticatedUser({
    visibility: 'all',
    affiliation: 'owner,collaborator,organization_member',
    sort: 'updated',
    direction: 'desc',
    per_page: perPage,
    page
  });

  const result = {
    repos: data.map(repo => ({
      id: repo.id,
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      description: repo.description,
      updatedAt: repo.updated_at,
      language: repo.language,
      url: repo.html_url
    })),
    hasMore: data.length === perPage
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Get content of a file from a repository
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - Repository URL
 * @param {string} filePath - Path to file (e.g., "docker-compose.yml")
 * @param {string} branch - Branch name (optional, uses default branch if not specified)
 * @returns {Promise<{content: string, sha: string} | null>} - null if file not found
 */
export async function getFileContent(token, repoUrl, filePath, branch) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const cacheKey = getCacheKey('file', owner, repo, `${branch || 'default'}:${filePath}`);

  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  try {
    const params = { owner, repo, path: filePath };
    if (branch) params.ref = branch;

    const { data } = await octokit.repos.getContent(params);

    // Handle file content (not directory)
    if (data.type !== 'file') {
      return null;
    }

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const result = { content, sha: data.sha };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Parse Dockerfile content to extract EXPOSE directives
 * Handles multi-stage Dockerfiles by using the last EXPOSE directive
 * @param {string} dockerfileContent - Raw Dockerfile content
 * @returns {number|null} - Exposed port number or null if not found
 */
export function parseDockerfileExpose(dockerfileContent) {
  if (!dockerfileContent) return null;

  // Split into lines and find all EXPOSE directives
  const lines = dockerfileContent.split('\n');
  let lastExposedPort = null;

  for (const line of lines) {
    // Match EXPOSE directive: EXPOSE 80, EXPOSE 80/tcp, EXPOSE 8080/udp
    // Handle multiple ports: EXPOSE 80 443
    const exposeMatch = line.match(/^\s*EXPOSE\s+(.+)/i);
    if (exposeMatch) {
      const portsStr = exposeMatch[1].trim();
      // Split by whitespace for multiple ports, take the first one
      const ports = portsStr.split(/\s+/);
      for (const port of ports) {
        // Remove protocol suffix if present (e.g., 80/tcp -> 80)
        const portMatch = port.match(/^(\d+)/);
        if (portMatch) {
          lastExposedPort = parseInt(portMatch[1], 10);
        }
      }
    }
  }

  return lastExposedPort;
}

/**
 * Fetch Dockerfile from GitHub and parse EXPOSE directive
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - Repository URL
 * @param {string} dockerfilePath - Path to Dockerfile (e.g., "Dockerfile" or "backend/Dockerfile")
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<{port: number|null, content: string|null}>}
 */
export async function getDockerfileExposedPort(token, repoUrl, dockerfilePath = 'Dockerfile', branch) {
  const fileResult = await getFileContent(token, repoUrl, dockerfilePath, branch);

  if (!fileResult) {
    return { port: null, content: null };
  }

  const port = parseDockerfileExpose(fileResult.content);
  return { port, content: fileResult.content };
}

/**
 * Get repository file tree (for finding Dockerfiles in various locations)
 * @param {string} token - GitHub personal access token
 * @param {string} repoUrl - Repository URL
 * @param {string} branch - Branch name (optional, uses default branch if not specified)
 * @returns {Promise<Array<{path: string, type: string}>>}
 */
export async function getRepoTree(token, repoUrl, branch) {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  // Get default branch if not specified
  if (!branch) {
    const repoInfo = await getRepoInfo(token, repoUrl);
    branch = repoInfo.defaultBranch;
  }

  const cacheKey = getCacheKey('tree', owner, repo, branch);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const octokit = createOctokit(token);

  const { data } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: 'true'
  });

  const result = data.tree
    .filter(item => item.type === 'blob')
    .map(item => ({ path: item.path, type: item.type }));

  setCache(cacheKey, result);
  return result;
}
