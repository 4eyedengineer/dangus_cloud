-- Migration: 010_global_unique_project_names
-- Description: Make project names globally unique (not per-user)
-- This enables simpler URLs: {projectName}-{serviceName}.domain
--
-- IMPORTANT: If this migration fails with a unique constraint violation,
-- it means there are duplicate project names across users.
-- Run this query to find duplicates:
--   SELECT name, COUNT(*) as count FROM projects GROUP BY name HAVING COUNT(*) > 1;
--
-- You must resolve duplicates before running this migration by renaming projects:
--   UPDATE projects SET name = name || '-' || SUBSTRING(user_id::text, 1, 4) WHERE id = '<duplicate_id>';

-- First, check for duplicates (this will fail the migration if any exist)
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (SELECT name FROM projects GROUP BY name HAVING COUNT(*) > 1) AS duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot add unique constraint: % duplicate project name(s) found. See migration comments for resolution.', duplicate_count;
  END IF;
END $$;

-- Drop the old per-user unique constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_name_key;

-- Add global uniqueness constraint on name
ALTER TABLE projects ADD CONSTRAINT projects_name_unique UNIQUE (name);

-- Add index for faster name lookups
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
