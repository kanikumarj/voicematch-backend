-- Migration: 005_phase6_schema
-- Run order: 5
-- Depends on: 001_create_users, 002_create_sessions

-- ─── call_feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_feedback (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  reviewer_id   UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  reviewed_id   UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  rating        INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  was_reported  BOOLEAN     NOT NULL DEFAULT false,
  report_reason VARCHAR(50) CHECK (
    report_reason IN ('harassment','hate_speech','spam','inappropriate','other')
  ),
  report_detail TEXT        CHECK (char_length(report_detail) <= 500),
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_feedback_reviewer_session UNIQUE (session_id, reviewer_id),
  CONSTRAINT chk_report_reason_required
    CHECK (NOT was_reported OR report_reason IS NOT NULL),
  CONSTRAINT chk_not_self_review
    CHECK (reviewer_id <> reviewed_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_reviewed_id  ON call_feedback (reviewed_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session_id   ON call_feedback (session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at   ON call_feedback (created_at DESC);

-- ─── user_blocks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_blocks (
  id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_block UNIQUE (blocker_id, blocked_id),
  CONSTRAINT chk_not_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks (blocked_id);

-- ─── user_reports ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_reports (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID        NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  reported_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   UUID        REFERENCES sessions(id)       ON DELETE SET NULL,
  reason       VARCHAR(50) NOT NULL,
  detail       TEXT        CHECK (char_length(detail) <= 500),
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  created_at   TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reported_id ON user_reports (reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_status      ON user_reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at  ON user_reports (created_at DESC);

-- ─── user_bans ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_bans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  ban_type    VARCHAR(20) NOT NULL CHECK (ban_type IN ('soft','hard')),
  reason      VARCHAR(100),
  banned_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMP,   -- NULL = permanent
  banned_by   VARCHAR(20) NOT NULL DEFAULT 'system'
              CHECK (banned_by IN ('system','admin'))
);

CREATE INDEX IF NOT EXISTS idx_bans_user_id    ON user_bans (user_id);
CREATE INDEX IF NOT EXISTS idx_bans_expires_at ON user_bans (expires_at)
  WHERE expires_at IS NOT NULL;

-- ─── users — additional columns ───────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trust_score      INTEGER   NOT NULL DEFAULT 100
                           CHECK (trust_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS total_calls      INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minutes    INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_count     INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date DATE,
  ADD COLUMN IF NOT EXISTS gender_filter    VARCHAR(20) NOT NULL DEFAULT 'any'
                           CHECK (gender_filter    IN ('any','male','female','other')),
  ADD COLUMN IF NOT EXISTS preferred_gender VARCHAR(20) NOT NULL DEFAULT 'any'
                           CHECK (preferred_gender IN ('any','male','female','other'));

-- Add 'banned' to existing status constraint (replace constraint)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending_onboarding','online','searching','in_call','offline','banned'));

-- ─── Index for trust score routing (deprioritization) ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_trust_score ON users (trust_score);
