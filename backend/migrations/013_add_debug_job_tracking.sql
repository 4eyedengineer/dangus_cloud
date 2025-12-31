-- Track current Kaniko job for debug sessions to enable cancellation
-- Issue #90: Add Kubernetes job termination on debug session cancel

ALTER TABLE debug_sessions ADD COLUMN current_job_name VARCHAR(255);
ALTER TABLE debug_sessions ADD COLUMN current_namespace VARCHAR(255);
