import { encrypt, generateUserHash } from '../services/encryption.js';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const OAUTH_SCOPES = ['read:user', 'repo'];

/**
 * Generate a unique hash with collision check
 */
async function generateUniqueHash(db) {
  let hash, exists;
  do {
    hash = generateUserHash();
    const result = await db.query('SELECT 1 FROM users WHERE hash = $1', [hash]);
    exists = result.rows.length > 0;
  } while (exists);
  return hash;
}

/**
 * Exchange OAuth code for access token
 */
async function exchangeCodeForToken(code) {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

/**
 * Fetch GitHub user profile
 */
async function fetchGitHubUser(accessToken) {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user: ${response.statusText}`);
  }

  return response.json();
}

export default async function authRoutes(fastify, options) {
  /**
   * GET /auth/github
   * Redirect to GitHub OAuth authorization page
   */
  fastify.get('/auth/github', async (request, reply) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    if (!clientId || !callbackUrl) {
      return reply.code(500).send({
        error: 'GitHub OAuth not configured',
        message: 'Missing GITHUB_CLIENT_ID or GITHUB_CALLBACK_URL',
      });
    }

    const state = crypto.randomUUID();

    // Store state in cookie for CSRF protection
    reply.setCookie('oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: OAUTH_SCOPES.join(' '),
      state,
    });

    return reply.redirect(`${GITHUB_OAUTH_URL}?${params.toString()}`);
  });

  /**
   * GET /auth/github/callback
   * Handle OAuth callback from GitHub
   */
  fastify.get('/auth/github/callback', async (request, reply) => {
    const { code, state, error, error_description } = request.query;

    // Handle OAuth errors
    if (error) {
      fastify.log.error(`GitHub OAuth error: ${error} - ${error_description}`);
      return reply.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
    }

    // Validate state for CSRF protection
    const storedState = request.cookies.oauth_state;
    if (!state || state !== storedState) {
      fastify.log.warn('OAuth state mismatch - possible CSRF attack');
      return reply.redirect('/?error=invalid_state');
    }

    // Clear the state cookie
    reply.clearCookie('oauth_state', { path: '/' });

    if (!code) {
      return reply.redirect('/?error=missing_code');
    }

    try {
      // Exchange code for access token
      const accessToken = await exchangeCodeForToken(code);

      // Fetch GitHub user profile
      const githubUser = await fetchGitHubUser(accessToken);

      // Encrypt the access token
      const encryptedToken = encrypt(accessToken);

      // Check if user exists
      const existingUser = await fastify.db.query(
        'SELECT id, hash FROM users WHERE github_id = $1',
        [githubUser.id]
      );

      let userId, userHash;

      if (existingUser.rows.length > 0) {
        // Update existing user's token
        userId = existingUser.rows[0].id;
        userHash = existingUser.rows[0].hash;

        await fastify.db.query(
          'UPDATE users SET github_access_token = $1, github_username = $2 WHERE id = $3',
          [encryptedToken, githubUser.login, userId]
        );

        fastify.log.info(`User updated: ${githubUser.login} (${userId})`);
      } else {
        // Create new user with unique hash
        userHash = await generateUniqueHash(fastify.db);

        const result = await fastify.db.query(
          `INSERT INTO users (github_id, github_username, github_access_token, hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [githubUser.id, githubUser.login, encryptedToken, userHash]
        );

        userId = result.rows[0].id;
        fastify.log.info(`User created: ${githubUser.login} (${userId})`);
      }

      // Set session cookie
      reply.setCookie('session', userId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        signed: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      // Redirect to home page
      return reply.redirect('/');
    } catch (err) {
      fastify.log.error(`OAuth callback error: ${err.message}`);
      return reply.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
  });

  /**
   * GET /auth/me
   * Get current authenticated user
   */
  fastify.get('/auth/me', async (request, reply) => {
    const sessionCookie = request.cookies.session;

    if (!sessionCookie) {
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'No session found',
      });
    }

    // Verify signed cookie
    const unsignedCookie = request.unsignCookie(sessionCookie);
    if (!unsignedCookie.valid || !unsignedCookie.value) {
      reply.clearCookie('session', { path: '/' });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid session',
      });
    }

    const userId = unsignedCookie.value;

    try {
      const result = await fastify.db.query(
        'SELECT id, github_username, hash, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        reply.clearCookie('session', { path: '/' });
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      const user = result.rows[0];
      return {
        id: user.id,
        github_username: user.github_username,
        hash: user.hash,
        created_at: user.created_at,
      };
    } catch (err) {
      fastify.log.error(`Error fetching user: ${err.message}`);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user',
      });
    }
  });

  /**
   * POST /auth/logout
   * Clear session and log out user
   */
  fastify.post('/auth/logout', async (request, reply) => {
    reply.clearCookie('session', { path: '/' });
    return { success: true, message: 'Logged out successfully' };
  });
}
