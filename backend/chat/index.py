import os
import json
import psycopg2
import random
import hashlib
import secrets
import base64
import boto3

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


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}:{h}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hashlib.sha256((salt + password).encode()).hexdigest() == h
    except Exception:
        return False


def handler(event, context):
    method = event.get("method", event.get("httpMethod", "GET")).upper()

    headers_in = event.get("headers", {}) or {}
    query_params = event.get("queryStringParameters") or {}
    action = query_params.get("action", "")
    session_id = (
        headers_in.get("x-session-id")
        or headers_in.get("X-Session-Id")
        or query_params.get("sid")
        or ""
    )

    print(f"[DEBUG] method={method} action={action!r} session={session_id!r}")

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers(), "body": ""}

    body_raw = event.get("body", "") or ""
    try:
        body = json.loads(body_raw)
    except Exception:
        try:
            from urllib.parse import parse_qs
            parsed = parse_qs(body_raw)
            body = {k: v[0] for k, v in parsed.items()}
        except Exception:
            body = {}

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor()

        # POST/GET ?action=register
        if action == "register" and method in ("POST", "GET"):
            username = (query_params.get("username") or body.get("username") or "").strip()[:100]
            password = (query_params.get("password") or body.get("password") or "").strip()
            if not username:
                return json_response({"error": "Введите имя пользователя"}, 400)
            if not password:
                return json_response({"error": "Введите пароль"}, 400)

            cur.execute(f"SELECT id FROM chat_users WHERE username = {esc(username)} AND password_hash IS NOT NULL")
            if cur.fetchone():
                return json_response({"error": "Имя уже занято"}, 409)

            color = random_color()
            pwd_hash = hash_password(password)
            new_sid = f"auth_{secrets.token_hex(24)}"

            cur.execute(f"""
                INSERT INTO chat_users (username, color, session_id, password_hash, last_seen)
                VALUES ({esc(username)}, {esc(color)}, {esc(new_sid)}, {esc(pwd_hash)}, NOW())
                RETURNING id, username, color, session_id
            """)
            row = cur.fetchone()
            conn.commit()
            user = {"id": str(row[0]), "username": row[1], "color": row[2], "session_id": row[3]}
            return json_response({"user": user, "session_id": new_sid})

        # POST/GET ?action=login
        if action == "login" and method in ("POST", "GET"):
            username = (query_params.get("username") or body.get("username") or "").strip()
            password = (query_params.get("password") or body.get("password") or "").strip()
            if not username or not password:
                return json_response({"error": "Введите логин и пароль"}, 400)

            cur.execute(f"SELECT id, username, color, session_id, password_hash, avatar_url FROM chat_users WHERE username = {esc(username)} AND password_hash IS NOT NULL")
            row = cur.fetchone()
            if not row or not verify_password(password, row[4]):
                return json_response({"error": "Неверный логин или пароль"}, 401)

            new_sid = f"auth_{secrets.token_hex(24)}"
            cur.execute(f"UPDATE chat_users SET session_id = {esc(new_sid)}, last_seen = NOW() WHERE id = {esc(str(row[0]))}")
            conn.commit()
            user = {"id": str(row[0]), "username": row[1], "color": row[2], "session_id": new_sid, "avatar_url": row[5]}
            return json_response({"user": user, "session_id": new_sid})

        # GET/POST ?action=join — восстановление сессии
        if action == "join" and method in ("GET", "POST"):
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            # Если это auth_ сессия — просто найти пользователя
            if session_id.startswith("auth_"):
                cur.execute(f"SELECT id, username, color, session_id, avatar_url FROM chat_users WHERE session_id = {esc(session_id)}")
                row = cur.fetchone()
                if not row:
                    return json_response({"error": "Session not found"}, 401)
                cur.execute(f"UPDATE chat_users SET last_seen = NOW() WHERE session_id = {esc(session_id)}")
                conn.commit()
                user = {"id": str(row[0]), "username": row[1], "color": row[2], "session_id": row[3], "avatar_url": row[4]}
                return json_response({"user": user})

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

        # GET ?action=users — список онлайн пользователей (кроме себя)
        if action == "users" and method == "GET":
            cur.execute(f"""
                SELECT id, username, color, last_seen
                FROM chat_users
                WHERE last_seen > NOW() - INTERVAL '5 minutes'
                ORDER BY last_seen DESC
                LIMIT 50
            """)
            rows = cur.fetchall()
            users = [
                {
                    "id": str(r[0]),
                    "username": r[1],
                    "color": r[2],
                    "last_seen": r[3].isoformat() if r[3] else None
                }
                for r in rows
            ]
            return json_response({"users": users})

        # POST ?action=dm_open — открыть/создать личный диалог
        if action == "dm_open" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            target_user_id = body.get("target_user_id", "").strip()
            if not target_user_id:
                return json_response({"error": "target_user_id required"}, 400)

            # Получаем текущего пользователя
            cur.execute(f"SELECT id, username, color FROM chat_users WHERE session_id = {esc(session_id)}")
            row = cur.fetchone()
            if not row:
                return json_response({"error": "User not found"}, 401)
            my_id = str(row[0])
            my_username = row[1]
            my_color = row[2]

            if my_id == target_user_id:
                return json_response({"error": "Cannot DM yourself"}, 400)

            # Проверяем что target существует
            cur.execute(f"SELECT id, username, color FROM chat_users WHERE id = {esc(target_user_id)}")
            trow = cur.fetchone()
            if not trow:
                return json_response({"error": "Target user not found"}, 404)
            target_username = trow[1]
            target_color = trow[2]

            # user1_id < user2_id для уникальности пары
            u1, u2 = (my_id, target_user_id) if my_id < target_user_id else (target_user_id, my_id)

            cur.execute(f"""
                INSERT INTO direct_conversations (user1_id, user2_id)
                VALUES ({esc(u1)}, {esc(u2)})
                ON CONFLICT (user1_id, user2_id) DO UPDATE SET user1_id = direct_conversations.user1_id
                RETURNING id, created_at
            """)
            crow = cur.fetchone()
            conn.commit()

            conv = {
                "id": str(crow[0]),
                "my_id": my_id,
                "my_username": my_username,
                "my_color": my_color,
                "target_id": target_user_id,
                "target_username": target_username,
                "target_color": target_color,
                "created_at": crow[1].isoformat() if crow[1] else None
            }
            return json_response({"conversation": conv})

        # GET ?action=dm_messages&conv_id=...&since=...
        if action == "dm_messages" and method == "GET":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            conv_id = query_params.get("conv_id", "").strip()
            if not conv_id:
                return json_response({"error": "conv_id required"}, 400)

            # Проверяем что пользователь участник разговора
            cur.execute(f"SELECT id FROM chat_users WHERE session_id = {esc(session_id)}")
            urow = cur.fetchone()
            if not urow:
                return json_response({"error": "User not found"}, 401)
            my_id = str(urow[0])

            cur.execute(f"""
                SELECT id FROM direct_conversations
                WHERE id = {esc(conv_id)}
                AND (user1_id = {esc(my_id)} OR user2_id = {esc(my_id)})
            """)
            if not cur.fetchone():
                return json_response({"error": "Forbidden"}, 403)

            since = query_params.get("since")
            limit = min(int(query_params.get("limit", 50)), 100)

            if since:
                cur.execute(f"""
                    SELECT id, sender_id, sender_username, sender_color, text, created_at, read_at
                    FROM direct_messages
                    WHERE conversation_id = {esc(conv_id)} AND created_at > {esc(since)}
                    ORDER BY created_at ASC
                    LIMIT {int(limit)}
                """)
            else:
                cur.execute(f"""
                    SELECT id, sender_id, sender_username, sender_color, text, created_at, read_at
                    FROM direct_messages
                    WHERE conversation_id = {esc(conv_id)}
                    ORDER BY created_at DESC
                    LIMIT {int(limit)}
                """)

            rows = cur.fetchall()
            messages = [
                {
                    "id": str(r[0]),
                    "sender_id": str(r[1]),
                    "sender_username": r[2],
                    "sender_color": r[3],
                    "text": r[4],
                    "created_at": r[5].isoformat() if r[5] else None,
                    "read_at": r[6].isoformat() if r[6] else None,
                    "is_mine": str(r[1]) == my_id
                }
                for r in rows
            ]
            if not since:
                messages.reverse()

            # Отмечаем непрочитанные как прочитанные
            cur.execute(f"""
                UPDATE direct_messages
                SET read_at = NOW()
                WHERE conversation_id = {esc(conv_id)}
                AND sender_id != {esc(my_id)}
                AND read_at IS NULL
            """)
            conn.commit()

            return json_response({"messages": messages})

        # POST ?action=dm_send
        if action == "dm_send" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            conv_id = body.get("conv_id", "").strip()
            text = (body.get("text") or "").strip()

            if not conv_id:
                return json_response({"error": "conv_id required"}, 400)
            if not text or len(text) > 1000:
                return json_response({"error": "Invalid message"}, 400)

            cur.execute(f"SELECT id, username, color FROM chat_users WHERE session_id = {esc(session_id)}")
            urow = cur.fetchone()
            if not urow:
                return json_response({"error": "User not found"}, 401)
            my_id, my_username, my_color = str(urow[0]), urow[1], urow[2]

            # Проверяем участие в разговоре
            cur.execute(f"""
                SELECT id FROM direct_conversations
                WHERE id = {esc(conv_id)}
                AND (user1_id = {esc(my_id)} OR user2_id = {esc(my_id)})
            """)
            if not cur.fetchone():
                return json_response({"error": "Forbidden"}, 403)

            cur.execute(f"""
                INSERT INTO direct_messages (conversation_id, sender_id, sender_username, sender_color, text)
                VALUES ({esc(conv_id)}, {esc(my_id)}, {esc(my_username)}, {esc(my_color)}, {esc(text)})
                RETURNING id, sender_id, sender_username, sender_color, text, created_at
            """)
            r = cur.fetchone()
            cur.execute(f"UPDATE chat_users SET last_seen = NOW() WHERE session_id = {esc(session_id)}")
            conn.commit()

            msg = {
                "id": str(r[0]),
                "sender_id": str(r[1]),
                "sender_username": r[2],
                "sender_color": r[3],
                "text": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
                "is_mine": True
            }
            return json_response({"message": msg}, 201)

        # POST ?action=avatar_upload — загрузить аватарку в S3
        if action == "avatar_upload" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)
            cur.execute(f"SELECT id FROM chat_users WHERE session_id = {esc(session_id)}")
            urow = cur.fetchone()
            if not urow:
                return json_response({"error": "User not found"}, 401)
            my_id = str(urow[0])
            image_b64 = body.get("image") or ""
            content_type = body.get("content_type") or "image/jpeg"
            if content_type == "remove":
                cur.execute(f"UPDATE chat_users SET avatar_url = NULL WHERE id = {esc(my_id)}")
                conn.commit()
                return json_response({"url": None})
            if not image_b64:
                return json_response({"error": "No image data"}, 400)
            try:
                image_data = base64.b64decode(image_b64)
            except Exception:
                return json_response({"error": "Invalid image data"}, 400)
            if len(image_data) > 5 * 1024 * 1024:
                return json_response({"error": "Image too large (max 5MB)"}, 400)

            ext = "jpg"
            if "png" in content_type: ext = "png"
            elif "webp" in content_type: ext = "webp"
            elif "gif" in content_type: ext = "gif"
            file_key = f"avatars/{my_id}.{ext}"
            s3 = boto3.client(
                "s3",
                endpoint_url="https://bucket.poehali.dev",
                aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            )
            s3.put_object(Bucket="files", Key=file_key, Body=image_data, ContentType=content_type)
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_key}"
            cur.execute(f"UPDATE chat_users SET avatar_url = {esc(cdn_url)} WHERE id = {esc(my_id)}")
            conn.commit()
            return json_response({"url": cdn_url})

        # POST ?action=voice_upload — загрузить голосовое сообщение в S3
        if action == "voice_upload" and method == "POST":
            if not session_id:
                return json_response({"error": "No session id"}, 400)

            cur.execute(f"SELECT id, username FROM chat_users WHERE session_id = {esc(session_id)}")
            urow = cur.fetchone()
            if not urow:
                return json_response({"error": "User not found"}, 401)

            audio_b64 = body.get("audio") or ""
            content_type = body.get("content_type") or "audio/webm"
            if not audio_b64:
                return json_response({"error": "No audio data"}, 400)

            try:
                audio_data = base64.b64decode(audio_b64)
            except Exception:
                return json_response({"error": "Invalid audio data"}, 400)

            if len(audio_data) > 10 * 1024 * 1024:
                return json_response({"error": "File too large (max 10MB)"}, 400)

            ext = "webm"
            if "ogg" in content_type:
                ext = "ogg"
            elif "mp4" in content_type or "m4a" in content_type:
                ext = "mp4"
            elif "wav" in content_type:
                ext = "wav"

            file_key = f"voice/{secrets.token_hex(16)}.{ext}"

            s3 = boto3.client(
                "s3",
                endpoint_url="https://bucket.poehali.dev",
                aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
            )
            s3.put_object(
                Bucket="files",
                Key=file_key,
                Body=audio_data,
                ContentType=content_type,
            )

            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_key}"
            return json_response({"url": cdn_url})

        # POST ?action=typing — отметить что пользователь печатает
        if action == "typing" and method == "POST":
            if not session_id:
                return json_response({"ok": False})
            room = (body.get("room") or query_params.get("room") or "public").strip()[:100]
            cur.execute(f"""UPDATE chat_users SET typing_in = {esc(room)}, typing_at = NOW()
                            WHERE session_id = {esc(session_id)}""")
            conn.commit()
            return json_response({"ok": True})

        # GET ?action=poll — единый запрос: сообщения + пользователи + онлайн + dm_unread + dm_messages
        if action == "poll" and method == "GET":
            since = query_params.get("since")
            conv_id = query_params.get("conv_id")
            dm_since = query_params.get("dm_since")

            # Публичные сообщения
            if since:
                cur.execute(f"""SELECT id, username, color, text, created_at FROM chat_messages
                               WHERE room_id = {esc(ROOM_ID)} AND created_at > {esc(since)}
                               ORDER BY created_at ASC LIMIT 50""")
            else:
                cur.execute(f"""SELECT id, username, color, text, created_at FROM chat_messages
                               WHERE room_id = {esc(ROOM_ID)}
                               ORDER BY created_at DESC LIMIT 50""")
            rows = cur.fetchall()
            msgs = [{"id": str(r[0]), "username": r[1], "color": r[2], "text": r[3],
                     "created_at": r[4].isoformat() if r[4] else None} for r in rows]
            if not since:
                msgs.reverse()

            # Онлайн пользователи
            cur.execute("""SELECT id, username, color, last_seen, avatar_url FROM chat_users
                           WHERE last_seen > NOW() - INTERVAL '5 minutes'
                           ORDER BY last_seen DESC LIMIT 50""")
            users_rows = cur.fetchall()
            users = [{"id": str(r[0]), "username": r[1], "color": r[2],
                      "last_seen": r[3].isoformat() if r[3] else None, "avatar_url": r[4]} for r in users_rows]

            # Кто сейчас печатает (активность за последние 4 сек)
            cur.execute(f"""SELECT username, color, typing_in FROM chat_users
                            WHERE typing_at > NOW() - INTERVAL '4 seconds'
                            AND typing_in IS NOT NULL""")
            typing_rows = cur.fetchall()
            typing_users = [{"username": r[0], "color": r[1], "room": r[2]} for r in typing_rows]

            result = {"messages": msgs, "users": users, "online": len(users_rows),
                      "dm_unread": 0, "dm_messages": [], "typing_users": typing_users}

            # Если есть сессия — добавляем личные данные
            if session_id:
                cur.execute(f"SELECT id, avatar_url FROM chat_users WHERE session_id = {esc(session_id)}")
                urow = cur.fetchone()
                if urow:
                    my_id = str(urow[0])
                    result["my_avatar_url"] = urow[1]
                    cur.execute(f"UPDATE chat_users SET last_seen = NOW() WHERE session_id = {esc(session_id)}")

                    # DM unread
                    cur.execute(f"""SELECT COUNT(*) FROM direct_messages dm
                                    JOIN direct_conversations dc ON dc.id = dm.conversation_id
                                    WHERE (dc.user1_id = {esc(my_id)} OR dc.user2_id = {esc(my_id)})
                                    AND dm.sender_id != {esc(my_id)} AND dm.read_at IS NULL""")
                    result["dm_unread"] = cur.fetchone()[0]

                    # DM messages если открыт диалог
                    if conv_id:
                        cur.execute(f"""SELECT id FROM direct_conversations
                                        WHERE id = {esc(conv_id)}
                                        AND (user1_id = {esc(my_id)} OR user2_id = {esc(my_id)})""")
                        if cur.fetchone():
                            if dm_since:
                                cur.execute(f"""SELECT id, sender_id, sender_username, sender_color, text, created_at, read_at
                                                FROM direct_messages
                                                WHERE conversation_id = {esc(conv_id)} AND created_at > {esc(dm_since)}
                                                ORDER BY created_at ASC LIMIT 50""")
                            else:
                                cur.execute(f"""SELECT id, sender_id, sender_username, sender_color, text, created_at, read_at
                                                FROM direct_messages WHERE conversation_id = {esc(conv_id)}
                                                ORDER BY created_at DESC LIMIT 50""")
                            dm_rows = cur.fetchall()
                            dm_msgs = [{"id": str(r[0]), "sender_id": str(r[1]), "sender_username": r[2],
                                        "sender_color": r[3], "text": r[4],
                                        "created_at": r[5].isoformat() if r[5] else None,
                                        "read_at": r[6].isoformat() if r[6] else None,
                                        "is_mine": str(r[1]) == my_id} for r in dm_rows]
                            if not dm_since:
                                dm_msgs.reverse()
                            result["dm_messages"] = dm_msgs

                            # Отмечаем прочитанными
                            cur.execute(f"""UPDATE direct_messages SET read_at = NOW()
                                            WHERE conversation_id = {esc(conv_id)}
                                            AND sender_id != {esc(my_id)} AND read_at IS NULL""")

                    conn.commit()

            return json_response(result)

        # GET ?action=dm_unread — количество непрочитанных личных сообщений
        if action == "dm_unread" and method == "GET":
            if not session_id:
                return json_response({"count": 0})

            cur.execute(f"SELECT id FROM chat_users WHERE session_id = {esc(session_id)}")
            urow = cur.fetchone()
            if not urow:
                return json_response({"count": 0})
            my_id = str(urow[0])

            cur.execute(f"""
                SELECT COUNT(*)
                FROM direct_messages dm
                JOIN direct_conversations dc ON dc.id = dm.conversation_id
                WHERE (dc.user1_id = {esc(my_id)} OR dc.user2_id = {esc(my_id)})
                AND dm.sender_id != {esc(my_id)}
                AND dm.read_at IS NULL
            """)
            count = cur.fetchone()[0]
            return json_response({"count": count})

    finally:
        conn.close()

    return json_response({"error": "Not found", "action": action, "method": method}, 404)