-- Migration: 001_create_users
-- Description: Create users table for GitHub OAuth authenticated users

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id BIGINT UNIQUE NOT NULL,
  github_username VARCHAR(255) NOT NULL,
  github_access_token TEXT NOT NULL, -- encrypted
  hash VARCHAR(6) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by github_id
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Index for faster lookups by hash
CREATE INDEX IF NOT EXISTS idx_users_hash ON users(hash);
