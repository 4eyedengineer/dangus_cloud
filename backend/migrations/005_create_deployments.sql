-- Migration: 005_create_deployments
-- Description: Create deployments table for tracking build and release history

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  commit_sha VARCHAR(40) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, building, deploying, live, failed
  image_tag TEXT,
  build_logs TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups by service_id
CREATE INDEX IF NOT EXISTS idx_deployments_service_id ON deployments(service_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
