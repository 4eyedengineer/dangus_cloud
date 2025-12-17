-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT false,
  email_address VARCHAR(255),
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret VARCHAR(64),
  notify_on_success BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Notification history
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'email', 'webhook'
  status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'failed'
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_deployment_id ON notifications(deployment_id);
