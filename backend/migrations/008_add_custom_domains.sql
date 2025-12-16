-- Migration: 008_add_custom_domains
-- Description: Create custom_domains table for user-defined domains with TLS

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(64) NOT NULL,
  tls_enabled BOOLEAN DEFAULT FALSE,
  certificate_status VARCHAR(50) DEFAULT 'pending', -- pending, issued, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  UNIQUE(domain)
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_service ON custom_domains(service_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);
