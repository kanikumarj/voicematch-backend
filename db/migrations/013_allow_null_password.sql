-- Migration: 013_allow_null_password
-- Google OAuth users don't have a password, so password_hash must be nullable.

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
