-- AI Debug Sessions for iterative build failure repair
-- Issue #88: Iterative AI Debug Agent for Failed Builds

CREATE TABLE debug_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES deployments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,

  status VARCHAR(20) DEFAULT 'running',
  -- running: actively debugging
  -- succeeded: build fixed and deployed
  -- failed: max attempts reached
  -- cancelled: user cancelled

  current_attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 10,

  -- Snapshot of original files before debugging (for restore on cancel)
  original_files JSONB DEFAULT '{}',

  -- Final accumulated file changes after success
  file_changes JSONB DEFAULT '[]',

  -- Final explanation if failed after max attempts
  final_explanation TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Only one active debug session per service at a time
CREATE UNIQUE INDEX idx_one_active_debug_session
ON debug_sessions(service_id) WHERE status = 'running';

CREATE INDEX idx_debug_sessions_deployment ON debug_sessions(deployment_id);
CREATE INDEX idx_debug_sessions_service ON debug_sessions(service_id);
CREATE INDEX idx_debug_sessions_status ON debug_sessions(status);

CREATE TABLE debug_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES debug_sessions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,

  -- LLM's natural language explanation of what it tried
  explanation TEXT NOT NULL,

  -- Files modified in this attempt: [{path, content}]
  file_changes JSONB NOT NULL,

  -- Build result
  succeeded BOOLEAN NOT NULL,
  build_logs TEXT,

  -- Token usage for cost tracking
  tokens_used INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(session_id, attempt_number)
);

CREATE INDEX idx_debug_attempts_session ON debug_attempts(session_id);
