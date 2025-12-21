import { getRepoTree, getFileContent, parseGitHubUrl } from './github.js';
import { generateDockerfile as llmGenerateDockerfile, isLLMAvailable } from './llmClient.js';
import logger from './logger.js';

// Files that are useful for detecting the project type and generating Dockerfiles
const IMPORTANT_FILES = [
  // Node.js
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.nvmrc',
  '.node-version',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'nuxt.config.js',
  'nuxt.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'svelte.config.js',
  // Python
  'requirements.txt',
  'pyproject.toml',
  'Pipfile',
  'setup.py',
  'setup.cfg',
  'poetry.lock',
  'manage.py',  // Django
  // Go
  'go.mod',
  'go.sum',
  // Rust
  'Cargo.toml',
  'Cargo.lock',
  // Ruby
  'Gemfile',
  'Gemfile.lock',
  'config.ru',
  // PHP
  'composer.json',
  'composer.lock',
  // Java
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  // .NET
  // C# project files matched by extension below
  // General
  'Procfile',
  'Makefile',
  'README.md',
  'readme.md'
];

// File extensions to look for in root or src directory
const IMPORTANT_EXTENSIONS = ['.csproj', '.fsproj', '.sln'];

// Maximum file tree entries to include in LLM context
const MAX_TREE_ENTRIES = 200;

// Maximum file content size to include (chars)
const MAX_FILE_CONTENT_SIZE = 10000;

/**
 * Generate a Dockerfile for a service that doesn't have one
 * @param {object} db - Database connection
 * @param {object} service - Service object with repo_url, branch
 * @param {string} githubToken - Decrypted GitHub token
 * @returns {Promise<{dockerfile: string, dockerignore: string, framework: object}>}
 */
export async function generateForService(db, service, githubToken) {
  if (!isLLMAvailable()) {
    throw new Error('LLM generation not available: ANTHROPIC_API_KEY not configured');
  }

  const { repo_url: repoUrl, branch } = service;

  logger.info({ serviceId: service.id, repoUrl }, 'Starting Dockerfile generation');

  // 1. Fetch repository tree
  const tree = await getRepoTree(githubToken, repoUrl, branch);

  // 2. Build formatted file tree (limited entries)
  const fileTree = formatFileTree(tree);

  // 3. Fetch key configuration files
  const files = await fetchImportantFiles(githubToken, repoUrl, branch, tree);

  // 4. Build context and call LLM
  const repoContext = {
    repoUrl,
    fileTree,
    files
  };

  const result = await llmGenerateDockerfile(repoContext);

  // 5. Store in database
  await storeGeneratedFile(db, service.id, 'dockerfile', result.dockerfile, result);
  await storeGeneratedFile(db, service.id, 'dockerignore', result.dockerignore, result);

  logger.info({
    serviceId: service.id,
    language: result.language,
    framework: result.framework,
    port: result.detectedPort
  }, 'Dockerfile generation complete');

  return {
    dockerfile: result.dockerfile,
    dockerignore: result.dockerignore,
    detectedPort: result.detectedPort,
    framework: {
      language: result.language,
      framework: result.framework,
      explanation: result.explanation
    },
    tokensUsed: result.tokensUsed
  };
}

/**
 * Generate Dockerfile without a service (for pre-creation analysis)
 * @param {string} githubToken - GitHub token
 * @param {string} repoUrl - Repository URL
 * @param {string} branch - Branch name
 * @returns {Promise<object>}
 */
export async function generateForRepo(githubToken, repoUrl, branch) {
  if (!isLLMAvailable()) {
    throw new Error('LLM generation not available: ANTHROPIC_API_KEY not configured');
  }

  logger.info({ repoUrl, branch }, 'Starting Dockerfile generation for repo');

  // 1. Fetch repository tree
  const tree = await getRepoTree(githubToken, repoUrl, branch);

  // 2. Build formatted file tree
  const fileTree = formatFileTree(tree);

  // 3. Fetch key configuration files
  const files = await fetchImportantFiles(githubToken, repoUrl, branch, tree);

  // 4. Build context and call LLM
  const repoContext = {
    repoUrl,
    fileTree,
    files
  };

  const result = await llmGenerateDockerfile(repoContext);

  return {
    dockerfile: result.dockerfile,
    dockerignore: result.dockerignore,
    detectedPort: result.detectedPort,
    framework: {
      language: result.language,
      framework: result.framework,
      explanation: result.explanation
    },
    tokensUsed: result.tokensUsed
  };
}

/**
 * Format file tree for LLM context
 */
function formatFileTree(tree) {
  // Sort by path and limit entries
  const sortedFiles = tree
    .map(f => f.path)
    .sort()
    .slice(0, MAX_TREE_ENTRIES);

  return sortedFiles.join('\n');
}

/**
 * Fetch important files from the repository
 */
async function fetchImportantFiles(token, repoUrl, branch, tree) {
  const files = {};
  const filePaths = tree.map(f => f.path);

  // Find which important files exist in the repo
  const filesToFetch = [];

  for (const importantFile of IMPORTANT_FILES) {
    // Check root level
    if (filePaths.includes(importantFile)) {
      filesToFetch.push(importantFile);
    }
    // Check src/ directory
    if (filePaths.includes(`src/${importantFile}`)) {
      filesToFetch.push(`src/${importantFile}`);
    }
  }

  // Check for files by extension
  for (const ext of IMPORTANT_EXTENSIONS) {
    const matches = filePaths.filter(p => p.endsWith(ext) && !p.includes('/'));
    filesToFetch.push(...matches.slice(0, 3)); // Limit to 3 per extension
  }

  // Limit total files to fetch
  const filesToFetchLimited = filesToFetch.slice(0, 15);

  // Fetch files in parallel
  const fetchPromises = filesToFetchLimited.map(async (filePath) => {
    try {
      const result = await getFileContent(token, repoUrl, filePath, branch);
      if (result && result.content) {
        // Truncate if too large
        const content = result.content.length > MAX_FILE_CONTENT_SIZE
          ? result.content.substring(0, MAX_FILE_CONTENT_SIZE) + '\n... (truncated)'
          : result.content;
        files[filePath] = content;
      }
    } catch (error) {
      logger.warn({ filePath, error: error.message }, 'Failed to fetch file');
    }
  });

  await Promise.all(fetchPromises);

  return files;
}

/**
 * Store a generated file in the database
 */
async function storeGeneratedFile(db, serviceId, fileType, content, metadata) {
  const { language, framework, detectedPort, explanation, tokensUsed } = metadata;

  const detectedFramework = {
    language,
    framework,
    port: detectedPort,
    explanation
  };

  await db.query(`
    INSERT INTO generated_files (service_id, file_type, content, llm_model, detected_framework, tokens_used)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (service_id, file_type)
    DO UPDATE SET
      content = EXCLUDED.content,
      llm_model = EXCLUDED.llm_model,
      detected_framework = EXCLUDED.detected_framework,
      tokens_used = EXCLUDED.tokens_used,
      updated_at = NOW()
  `, [serviceId, fileType, content, 'claude-3-5-haiku-20241022', JSON.stringify(detectedFramework), tokensUsed]);
}

/**
 * Get a generated file from the database
 * @param {object} db - Database connection
 * @param {string} serviceId - Service UUID
 * @param {string} fileType - 'dockerfile' or 'dockerignore'
 * @returns {Promise<{content: string, detectedFramework: object} | null>}
 */
export async function getGeneratedFile(db, serviceId, fileType) {
  const result = await db.query(`
    SELECT content, detected_framework, tokens_used, created_at, updated_at
    FROM generated_files
    WHERE service_id = $1 AND file_type = $2
  `, [serviceId, fileType]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    content: row.content,
    detectedFramework: row.detected_framework,
    tokensUsed: row.tokens_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Check if a service has a generated Dockerfile
 */
export async function hasGeneratedDockerfile(db, serviceId) {
  const result = await db.query(`
    SELECT 1 FROM generated_files
    WHERE service_id = $1 AND file_type = 'dockerfile'
    LIMIT 1
  `, [serviceId]);

  return result.rows.length > 0;
}

/**
 * Delete generated files for a service
 */
export async function deleteGeneratedFiles(db, serviceId) {
  await db.query(`
    DELETE FROM generated_files WHERE service_id = $1
  `, [serviceId]);
}
