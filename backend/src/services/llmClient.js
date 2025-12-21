import Anthropic from '@anthropic-ai/sdk';
import logger from './logger.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 4096;

let client = null;

/**
 * Get or create Anthropic client singleton
 */
function getClient() {
  if (!client) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return client;
}

/**
 * Check if LLM generation is available (API key configured)
 */
export function isLLMAvailable() {
  return !!ANTHROPIC_API_KEY;
}

/**
 * System prompt for Dockerfile generation
 */
const DOCKERFILE_SYSTEM_PROMPT = `You are an expert DevOps engineer generating production-ready Dockerfiles for Kubernetes deployment.

Generate a Dockerfile and .dockerignore optimized for the detected language/framework.

REQUIREMENTS:
- Use specific version tags (never :latest)
- Use multi-stage builds when beneficial
- Run as non-root user for security
- Include EXPOSE for the detected port
- Optimize layer caching (deps before source)
- Use alpine/slim base images when possible
- Include HEALTHCHECK when appropriate

CRITICAL FOR NON-ROOT:
Before switching to a non-root USER, fix permissions on ALL directories the process writes to at runtime (cache dirs, log dirs, pid files, etc). This is especially important for web servers like nginx/apache.

OUTPUT FORMAT - respond with valid JSON only:
{
  "dockerfile": "FROM node:20-alpine AS builder\\n...",
  "dockerignore": "node_modules\\n.git\\n...",
  "detectedPort": 3000,
  "framework": "nextjs",
  "language": "nodejs",
  "explanation": "Brief explanation of key decisions"
}`;

/**
 * Generate a Dockerfile using Claude Haiku 4.5
 * @param {object} repoContext - Repository context for the LLM
 * @param {string} repoContext.fileTree - Formatted file tree
 * @param {object} repoContext.files - Key file contents (package.json, etc.)
 * @param {string} repoContext.repoUrl - Repository URL
 * @returns {Promise<{dockerfile: string, dockerignore: string, detectedPort: number, framework: string, language: string, explanation: string, tokensUsed: number}>}
 */
export async function generateDockerfile(repoContext) {
  const anthropic = getClient();

  // Build the user message with repo context
  const userMessage = buildUserMessage(repoContext);

  logger.info({ repoUrl: repoContext.repoUrl }, 'Generating Dockerfile with LLM');

  try {
    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ],
      system: DOCKERFILE_SYSTEM_PROMPT
    });

    // Extract text content
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent) {
      throw new Error('No text response from LLM');
    }

    // Parse JSON response
    const result = parseJsonResponse(textContent.text);

    // Calculate tokens used
    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    logger.info({
      repoUrl: repoContext.repoUrl,
      language: result.language,
      framework: result.framework,
      tokensUsed
    }, 'Dockerfile generated successfully');

    return {
      ...result,
      tokensUsed
    };
  } catch (error) {
    logger.error({ error: error.message, repoUrl: repoContext.repoUrl }, 'LLM generation failed');
    throw error;
  }
}

/**
 * Build user message from repository context
 */
function buildUserMessage(repoContext) {
  let message = `Generate a Dockerfile for this repository: ${repoContext.repoUrl}\n\n`;

  message += '## Repository File Structure\n```\n';
  message += repoContext.fileTree;
  message += '\n```\n\n';

  if (repoContext.files && Object.keys(repoContext.files).length > 0) {
    message += '## Key Configuration Files\n\n';

    for (const [filename, content] of Object.entries(repoContext.files)) {
      if (content) {
        message += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    }
  }

  message += 'Generate a production-ready Dockerfile and .dockerignore for this repository.';

  return message;
}

/**
 * Parse JSON response from LLM, handling potential formatting issues
 */
function parseJsonResponse(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim());
    }

    // Try to find JSON object in the response
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error(`Failed to parse LLM response as JSON: ${text.substring(0, 200)}`);
  }
}
