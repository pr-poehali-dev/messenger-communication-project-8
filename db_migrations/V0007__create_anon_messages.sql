CREATE TABLE IF NOT EXISTS anon_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    username TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#a78bfa',
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS anon_messages_created_at_idx ON anon_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS anon_messages_session_idx ON anon_messages(session_id);
