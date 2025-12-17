-- Migration: 009_add_rollback_tracking
-- Description: Add rollback tracking to deployments table

-- Add rollback_to column to track which deployment was rolled back to
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rollback_to UUID REFERENCES deployments(id);

-- Add index for rollback queries
CREATE INDEX IF NOT EXISTS idx_deployments_rollback_to ON deployments(rollback_to);
