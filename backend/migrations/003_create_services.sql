-- Migration: 003_create_services
-- Description: Create services table with all fields per spec
-- Note: subdomain is computed as {user.hash}-{name}

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(63) NOT NULL,
  repo_url TEXT NOT NULL,
  branch VARCHAR(255) DEFAULT 'main',
  dockerfile_path VARCHAR(255) DEFAULT 'Dockerfile',
  port INTEGER NOT NULL,
  storage_gb INTEGER CHECK (storage_gb >= 1 AND storage_gb <= 10), -- nullable
  health_check_path VARCHAR(255), -- nullable, e.g., /health
  webhook_secret VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Index for faster lookups by project_id
CREATE INDEX IF NOT EXISTS idx_services_project_id ON services(project_id);
