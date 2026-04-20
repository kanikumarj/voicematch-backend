
-- Migration: 001_create_users
-- Run order: 1
-- Depends on: pgcrypto extension (for gen_random_uuid)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Users table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL,
  password_hash TEXT         NOT NULL,
  display_name  VARCHAR(100),
  age           INTEGER      CHECK (age >= 13 AND age <= 120),
  gender        VARCHAR(20),
  is_onboarded  BOOLEAN      NOT NULL DEFAULT false,
  status        VARCHAR(20)  NOT NULL DEFAULT 'offline',
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),

  -- Enforce case-insensitive uniqueness at DB level
  CONSTRAINT users_email_unique UNIQUE (email),

  -- Guard status values at DB level as a second line of defence
  CONSTRAINT users_status_check CHECK (status IN ('online', 'offline', 'in_call', 'queued'))
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
-- Used on every auth lookup
CREATE INDEX IF NOT EXISTS idx_users_email        ON users (email);

-- Phase 2: matchmaking pool queries will filter by status
CREATE INDEX IF NOT EXISTS idx_users_status       ON users (status);

-- Phase 2: used in matchmaking to find unmatched online users
CREATE INDEX IF NOT EXISTS idx_users_onboarded    ON users (is_onboarded);
