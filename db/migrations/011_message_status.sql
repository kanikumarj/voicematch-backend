-- Add status column to chat_messages table for delivery tracking
ALTER TABLE chat_messages 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';

-- Create index for performance on status queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_status ON chat_messages(status);
