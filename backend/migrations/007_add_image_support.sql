-- Migration: 007_add_image_support
-- Description: Add support for direct image deployments without requiring a repo
-- This enables services like postgres:15, redis:alpine to be deployed directly

-- Make repo_url nullable (was NOT NULL before)
ALTER TABLE services ALTER COLUMN repo_url DROP NOT NULL;

-- Add image column for direct image deployments (e.g., 'postgres:15', 'redis:alpine')
ALTER TABLE services ADD COLUMN image TEXT;

-- Add build_context column for monorepo subdirectories (e.g., './backend', './services/api')
ALTER TABLE services ADD COLUMN build_context VARCHAR(255);

-- Ensure either repo_url or image is provided (service must have a source)
ALTER TABLE services ADD CONSTRAINT service_source_check
  CHECK (repo_url IS NOT NULL OR image IS NOT NULL);
