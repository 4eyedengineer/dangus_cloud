-- Add detected_port column to services table
-- This stores the port detected from the Dockerfile EXPOSE directive

ALTER TABLE services
ADD COLUMN IF NOT EXISTS detected_port INTEGER;

-- Add index for quick lookups of services with port mismatches
CREATE INDEX IF NOT EXISTS idx_services_detected_port ON services(detected_port)
WHERE detected_port IS NOT NULL;

COMMENT ON COLUMN services.detected_port IS 'Port detected from Dockerfile EXPOSE directive';
