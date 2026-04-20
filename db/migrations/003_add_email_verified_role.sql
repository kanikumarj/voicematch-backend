-- Migration: 003_add_email_verified_role
-- Run order: 3
-- Depends on: 001_create_users

-- ─── Email verification column ────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- ─── Role column ──────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));

-- Index: admin lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ─── Set first registered user as admin (run manually after first register) ──
-- UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
