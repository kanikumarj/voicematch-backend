-- Migration: 002_create_sessions
-- Run order: 2
-- Depends on: 001_create_users

-- ─── Fix status constraint from Phase 1 ──────────────────────────────────────
-- Phase 1 had 'queued' — Phase 2 replaces with 'searching'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('online', 'offline', 'searching', 'in_call'));

-- ─── Sessions table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  user_b_id   UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  started_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMP,
  end_reason  VARCHAR(50) CHECK (end_reason IN ('user_disconnect', 'skip', 'error', 'mutual_end'))
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Phase 5: analytics queries on session history per user
CREATE INDEX IF NOT EXISTS idx_sessions_user_a ON sessions (user_a_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_b ON sessions (user_b_id);

-- Phase 5: filter active (not yet ended) sessions
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions (ended_at) WHERE ended_at IS NULL;
