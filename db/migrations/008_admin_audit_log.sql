-- Migration: 008_admin_audit_log
-- Run order: 8
-- Admin audit trail — append-only

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id   UUID,
  detail      JSONB,
  admin_ip    VARCHAR(50),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON admin_audit_log(created_at DESC);
