import os
import json
import psycopg2
import random

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROOM_ID = "00000000-0000-0000-0000-000000000001"

USER_COLORS = [
    "#C9A84C", "#E07B7B", "#7BE0C9", "#7B9BE0", "#C97BE0",
    "#E0C97B", "#7BE07B", "#E07BB5", "#7BB5E0", "#E0957B",
]

ADJECTIVES = ["Быстрый", "Смелый", "Мудрый", "Тихий", "Яркий", "Добрый", "Острый"]
NOUNS = ["Кот", "Лис", "Волк", "Орёл", "Тигр", "Лось", "Рысь"]


def random_username():
    adj = random.choice(ADJECTIVES)
    noun = random.choice(NOUNS)
    num = random.randint(1, 99)
    return f"{adj}{noun}{num}"


def random_color():
    return random.choice(USER_COLORS)


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
        "Content-Type": "application/json",
    }


def json_response(data, status=200):
    return {
        "statusCode": status,
        "headers": cors_headers(),
        "body": json.dumps(data, default=str),
    }


def esc(val):
    """Escape a string value for safe SQL interpolation."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def handler(event, context):
    method = event.get("method", event.get("httpMethod", "GET")).upper()

    headers_in = event.get("headers", {}) or {}
    session_id = headers_in.get("x-session-id") or headers_in.get("X-Session-Id") or ""

    query_params = event.get("queryStringParameters") or {}
    action = query_params.get("action", "")

    print(f"[DEBUG] method={method} action={action!r} session={session_id!r}")

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}

    body_raw = event.get("body", "{}")
    try:
        body = json.loads(body_raw) if body_raw else {}
    except Exception:
        body = {}

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor()

        # POST ?action=join
        if action == "join" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            username = (body.get("username") or random_username()).strip()[:50]
            color = random_color()

            sql = f"""INSERT INTO chat_users (username, color, session_id, last_seen)
                       VALUES ({esc(username)}, {esc(color)}, {esc(session_id)}, NOW())
                       ON CONFLICT (session_id)
                       DO UPDATE SET last_seen = NOW()
                       RETURNING id, username, color, session_id"""
            cur.execute(sql)
            row = cur.fetchone()
            conn.commit()
            user = {"id": str(row[0]), "username": row[1], "color": row[2], "session_id": row[3]}
            return json_response({"user": user})

        # GET ?action=messages
        if action == "messages" and method == "GET":
            limit = min(int(query_params.get("limit", 50)), 100)
            since = query_params.get("since")

            if since:
                sql = f"""SELECT id, username, color, text, created_at
                           FROM chat_messages
                           WHERE room_id = {esc(ROOM_ID)} AND created_at > {esc(since)}
                           ORDER BY created_at ASC
                           LIMIT {int(limit)}"""
            else:
                sql = f"""SELECT id, username, color, text, created_at
                           FROM chat_messages
                           WHERE room_id = {esc(ROOM_ID)}
                           ORDER BY created_at DESC
                           LIMIT {int(limit)}"""

            cur.execute(sql)
            rows = cur.fetchall()
            messages = [
                {
                    "id": str(r[0]),
                    "username": r[1],
                    "color": r[2],
                    "text": r[3],
                    "created_at": r[4].isoformat() if r[4] else None
                }
                for r in rows
            ]
            if not since:
                messages.reverse()
            return json_response({"messages": messages})

        # POST ?action=send
        if action == "send" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            text = (body.get("text") or "").strip()
            if not text or len(text) > 1000:
                return json_response({"error": "Invalid message"}, 400)

            cur.execute(f"SELECT id, username, color FROM chat_users WHERE session_id = {esc(session_id)}")
            row = cur.fetchone()
            if not row:
                return json_response({"error": "User not found"}, 401)

            user_id, username, color = row

            cur.execute(f"UPDATE chat_users SET last_seen = NOW() WHERE session_id = {esc(session_id)}")

            cur.execute(f"""INSERT INTO chat_messages (room_id, user_id, username, color, text)
                         VALUES ({esc(ROOM_ID)}, {esc(str(user_id))}, {esc(username)}, {esc(color)}, {esc(text)})
                         RETURNING id, username, color, text, created_at""")
            r = cur.fetchone()
            conn.commit()
            msg = {
                "id": str(r[0]),
                "username": r[1],
                "color": r[2],
                "text": r[3],
                "created_at": r[4].isoformat() if r[4] else None
            }
            return json_response({"message": msg}, 201)

        # GET ?action=online
        if action == "online" and method == "GET":
            cur.execute("SELECT COUNT(*) FROM chat_users WHERE last_seen > NOW() - INTERVAL '2 minutes'")
            count = cur.fetchone()[0]
            return json_response({"count": count})

    finally:
        conn.close()

    return json_response({"error": "Not found", "action": action, "method": method}, 404)
