-- Пользователи чата
CREATE TABLE IF NOT EXISTS chat_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#C9A84C',
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Комнаты чата
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Общий чат',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Вставляем комнату по умолчанию
INSERT INTO chat_rooms (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Общий чат') ON CONFLICT DO NOTHING;

-- Сообщения чата
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id),
  user_id UUID REFERENCES chat_users(id) ON UPDATE CASCADE,
  username TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#C9A84C',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_users_session ON chat_users(session_id);
