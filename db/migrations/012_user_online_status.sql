-- Add last_seen and is_online columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Create index for online users queries
CREATE INDEX IF NOT EXISTS idx_users_is_online ON users(is_online);
