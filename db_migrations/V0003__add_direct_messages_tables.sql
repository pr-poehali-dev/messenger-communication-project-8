CREATE TABLE IF NOT EXISTS direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES direct_conversations(id),
  sender_id UUID NOT NULL,
  sender_username VARCHAR(100) NOT NULL,
  sender_color VARCHAR(20) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_direct_conv_user1 ON direct_conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_direct_conv_user2 ON direct_conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_direct_msg_conv ON direct_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_msg_sender ON direct_messages(sender_id);
