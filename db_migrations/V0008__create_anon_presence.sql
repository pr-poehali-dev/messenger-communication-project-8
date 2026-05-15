CREATE TABLE IF NOT EXISTS anon_presence (
    session_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#a78bfa',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS anon_presence_last_seen_idx ON anon_presence(last_seen DESC);
