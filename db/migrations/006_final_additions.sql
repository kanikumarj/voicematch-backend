-- Migration: 006_final_additions
-- Run order: 6
-- Adds call duration, missing indexes, and safe guards for all
-- previously-added columns (IF NOT EXISTS everywhere)

-- ─── sessions: call duration ──────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- ─── Sessions FK indexes (for analytics + join performance) ──────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_a
  ON sessions (user_a_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_b
  ON sessions (user_b_id);

-- ─── call_feedback: reviewed_id index (already in 005, guard here) ───────────
CREATE INDEX IF NOT EXISTS idx_feedback_reviewed
  ON call_feedback (reviewed_id);

-- ─── user_reports: composite for admin list queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_reported_status
  ON user_reports (reported_id, status);

-- ─── user_blocks: blocker index (already in 005, guard here) ─────────────────
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id
  ON user_blocks (blocker_id);

-- ─── email_verified + role safety net (already in 003, safe to re-run) ───────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- ─── Promote seeded admin user (noop in production with no such email) ────────
UPDATE users SET role = 'admin' WHERE email = 'admin@dev.com';
