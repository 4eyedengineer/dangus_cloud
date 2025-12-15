-- Migration: 002_create_projects
-- Description: Create projects table with foreign key to users
-- Note: namespace is computed as {user.hash}-{name}

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(63) NOT NULL, -- k8s namespace limit
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
