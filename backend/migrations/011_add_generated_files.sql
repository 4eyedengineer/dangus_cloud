-- Migration: 011_add_generated_files
-- Description: Add table for LLM-generated infrastructure files (Dockerfiles, etc.)
-- These are stored in the database, not in the user's repository (the "Dangus Layer")

CREATE TABLE IF NOT EXISTS generated_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL,  -- 'dockerfile', 'dockerignore'
  content TEXT NOT NULL,
  llm_model VARCHAR(100),          -- e.g., 'claude-3-5-haiku-20241022'
  detected_framework JSONB DEFAULT '{}',  -- {language, framework, port, explanation}
  tokens_used INTEGER,             -- Track token usage for cost monitoring
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(service_id, file_type)
);

-- Index for faster lookups by service_id
CREATE INDEX IF NOT EXISTS idx_generated_files_service_id ON generated_files(service_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_generated_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
DROP TRIGGER IF EXISTS trigger_generated_files_updated_at ON generated_files;
CREATE TRIGGER trigger_generated_files_updated_at
  BEFORE UPDATE ON generated_files
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_files_updated_at();
