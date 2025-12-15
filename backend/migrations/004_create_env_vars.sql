-- Migration: 004_create_env_vars
-- Description: Create environment variables table
-- Note: Values are stored encrypted using AES-256-GCM

CREATE TABLE IF NOT EXISTS env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value TEXT NOT NULL, -- encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, key)
);

-- Index for faster lookups by service_id
CREATE INDEX IF NOT EXISTS idx_env_vars_service_id ON env_vars(service_id);
