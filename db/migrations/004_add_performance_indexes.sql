-- Migration: 004_add_performance_indexes
-- Run order: 4
-- Depends on: 002_create_sessions
-- Addresses: QA-P5-4 (analytics query performance at scale)

-- ─── Sessions: range queries in analytics ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_started_at
  ON sessions (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_ended_at
  ON sessions (ended_at)
  WHERE ended_at IS NOT NULL;      -- Partial index — only indexes completed calls

-- ─── Sessions: end_reason grouping (disconnect reasons analytics) ─────────────
CREATE INDEX IF NOT EXISTS idx_sessions_end_reason
  ON sessions (end_reason)
  WHERE end_reason IS NOT NULL;

-- ─── Users: status queries ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users (status);

-- ─── Users: email lookup on login ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (lower(email));         -- Case-insensitive unique lookup
