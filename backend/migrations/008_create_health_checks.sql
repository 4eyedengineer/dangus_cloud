-- Health check history table
CREATE TABLE health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- healthy, unhealthy
  status_code INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries by service and time
CREATE INDEX idx_health_checks_service ON health_checks(service_id, checked_at DESC);

-- Auto-cleanup old records (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void AS $$
BEGIN
  DELETE FROM health_checks
  WHERE checked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
