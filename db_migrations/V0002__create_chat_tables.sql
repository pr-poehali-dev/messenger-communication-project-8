CREATE TABLE IF NOT EXISTS chat_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    session_id VARCHAR(200) NOT NULL UNIQUE,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    username VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_users_session ON chat_users(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_users_last_seen ON chat_users(last_seen);