import os
import json
import psycopg
from datetime import datetime, timezone

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ROOM_ID = "00000000-0000-0000-0000-000000000001"

USER_COLORS = [
    "#C9A84C", "#E07B7B", "#7BE0C9", "#7B9BE0", "#C97BE0",
    "#E0C97B", "#7BE07B", "#E07BB5", "#7BB5E0", "#E0957B",
]

import random

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

def handler(event, context):
    method = event.get("method", event.get("httpMethod", "GET")).upper()
    path = event.get("path", "/").strip("/")
    # Remove "api/chat/" prefix if present
    for prefix in ["api/chat/", "api/chat"]:
        if path.startswith(prefix):
            path = path[len(prefix):].strip("/")
            break

    headers_in = event.get("headers", {}) or {}
    # Headers may be lowercase
    session_id = headers_in.get("x-session-id") or headers_in.get("X-Session-Id") or ""

    query_params = event.get("queryStringParameters") or {}

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}

    body_raw = event.get("body", "{}")
    try:
        body = json.loads(body_raw) if body_raw else {}
    except Exception:
        body = {}

    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:

            # POST /join
            if path == "join" and method == "POST":
                if not session_id:
                    return json_response({"error": "No session id"}, 400)

                username = (body.get("username") or random_username()).strip()[:50]
                color = random_color()

                cur.execute(
                    """INSERT INTO chat_users (username, color, session_id, last_seen)
                       VALUES (%s, %s, %s, NOW())
                       ON CONFLICT (session_id)
                       DO UPDATE SET last_seen = NOW()
                       RETURNING id, username, color, session_id""",
                    (username, color, session_id)
                )
                row = cur.fetchone()
                conn.commit()
                user = {"id": str(row[0]), "username": row[1], "color": row[2], "session_id": row[3]}
                return json_response({"user": user})

            # GET /messages
            if path == "messages" and method == "GET":
                limit = min(int(query_params.get("limit", 50)), 100)
                since = query_params.get("since")

                if since:
                    cur.execute(
                        """SELECT id, username, color, text, created_at
                           FROM chat_messages
                           WHERE room_id = %s AND created_at > %s
                           ORDER BY created_at ASC
                           LIMIT %s""",
                        (ROOM_ID, since, limit)
                    )
                else:
                    cur.execute(
                        """SELECT id, username, color, text, created_at
                           FROM chat_messages
                           WHERE room_id = %s
                           ORDER BY created_at DESC
                           LIMIT %s""",
                        (ROOM_ID, limit)
                    )

                rows = cur.fetchall()
                messages = [
                    {"id": str(r[0]), "username": r[1], "color": r[2], "text": r[3], "created_at": r[4].isoformat() if r[4] else None}
                    for r in rows
                ]
                if not since:
                    messages.reverse()
                return json_response({"messages": messages})

            # POST /messages
            if path == "messages" and method == "POST":
                if not session_id:
                    return json_response({"error": "No session id"}, 400)

                text = (body.get("text") or "").strip()
                if not text or len(text) > 1000:
                    return json_response({"error": "Invalid message"}, 400)

                cur.execute(
                    "SELECT id, username, color FROM chat_users WHERE session_id = %s",
                    (session_id,)
                )
                row = cur.fetchone()
                if not row:
                    return json_response({"error": "User not found"}, 401)

                user_id, username, color = row

                cur.execute(
                    "UPDATE chat_users SET last_seen = NOW() WHERE session_id = %s",
                    (session_id,)
                )

                cur.execute(
                    """INSERT INTO chat_messages (room_id, user_id, username, color, text)
                       VALUES (%s, %s, %s, %s, %s)
                       RETURNING id, username, color, text, created_at""",
                    (ROOM_ID, user_id, username, color, text)
                )
                r = cur.fetchone()
                conn.commit()
                msg = {"id": str(r[0]), "username": r[1], "color": r[2], "text": r[3], "created_at": r[4].isoformat() if r[4] else None}
                return json_response({"message": msg}, 201)

            # GET /online
            if path == "online" and method == "GET":
                cur.execute(
                    "SELECT COUNT(*) FROM chat_users WHERE last_seen > NOW() - INTERVAL '2 minutes'"
                )
                count = cur.fetchone()[0]
                return json_response({"count": count})

    return json_response({"error": "Not found"}, 404)
