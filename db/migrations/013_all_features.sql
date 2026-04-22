-- ============================================================
-- Migration 013: All 5 Features Schema
-- Feature 1: In-call reporting
-- Feature 3: Profile sharing (username)
-- Feature 5: Announcements
-- ============================================================

-- Feature 1: Report during call
ALTER TABLE user_reports
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'post_call';

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(50);

-- Feature 3: Profile sharing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_public BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Feature 5: Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR(20) NOT NULL DEFAULT 'info',
  segment         VARCHAR(50) DEFAULT 'all',
  target_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  status          VARCHAR(20) DEFAULT 'draft',
  scheduled_at    TIMESTAMP,
  sent_at         TIMESTAMP,
  sent_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcement_seen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  seen_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_status
  ON announcements(status, scheduled_at);
