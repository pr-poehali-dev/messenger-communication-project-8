ALTER TABLE chat_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE chat_users ADD COLUMN IF NOT EXISTS display_name text;