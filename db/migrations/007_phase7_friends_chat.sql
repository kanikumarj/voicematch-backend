-- db/migrations/007_phase7_friends_chat.sql

-- Friend requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(sender_id, receiver_id),
  CHECK(sender_id != receiver_id)
);

-- Friendships
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id),
  CHECK(user_a_id < user_b_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id UUID REFERENCES friendships(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(20) DEFAULT 'text',
  is_deleted BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Chat rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id UUID REFERENCES friendships(id) ON DELETE CASCADE UNIQUE,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  unread_count_a INTEGER DEFAULT 0,
  unread_count_b INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver
  ON friend_requests(receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender
  ON friend_requests(sender_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a
  ON friendships(user_a_id);

CREATE INDEX IF NOT EXISTS idx_friendships_user_b
  ON friendships(user_b_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_friendship
  ON chat_messages(friendship_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_friendship
  ON chat_rooms(friendship_id);
