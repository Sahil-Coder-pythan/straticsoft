import os
import sqlite3
import uuid
import secrets
import hashlib
import re
from datetime import datetime, date

from flask import Flask, jsonify, render_template_string, request
import requests


# ==================================================
# FLASK
# ==================================================

app = Flask(__name__)


# ==================================================
# GROQ SETTINGS
# ==================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Text model
MODEL_TEXT = "openai/gpt-oss-20b"

# Vision model
MODEL_VISION = "qwen/qwen3.8-27b"

MODEL = MODEL_TEXT


# ==================================================
# ADMIN API KEY
# ==================================================

ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")

DEFAULT_DAILY_LIMIT = 100


# ==================================================
# DATABASE
# ==================================================

DATABASE = os.environ.get(
    "DATABASE_PATH",
    "chatxon.db"
)


def get_db():

    conn = sqlite3.connect(
        DATABASE,
        timeout=30
    )

    conn.row_factory = sqlite3.Row

    conn.execute(
        "PRAGMA foreign_keys = ON"
    )

    conn.execute(
        "PRAGMA busy_timeout = 30000"
    )

    return conn


# ==================================================
# DATABASE INITIALIZATION
# ==================================================

def init_database():

    conn = get_db()

    # USERS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        )
    """)

    # CHATS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS chats (
            chat_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT 'New Chat',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,

            FOREIGN KEY (user_id)
            REFERENCES users(user_id)
            ON DELETE CASCADE
        )
    """)

    # MESSAGES
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,

            FOREIGN KEY (chat_id)
            REFERENCES chats(chat_id)
            ON DELETE CASCADE
        )
    """)

    # CHAT INDEX
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_chats_user
        ON chats(user_id)
    """)

    # MESSAGE INDEX
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_chat
        ON messages(chat_id)
    """)

    # CUSTOMER API KEYS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS customer_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hash TEXT UNIQUE NOT NULL,
            key_prefix TEXT NOT NULL,
            daily_limit INTEGER NOT NULL DEFAULT 100,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)

    # CUSTOMER API USAGE
    conn.execute("""
        CREATE TABLE IF NOT EXISTS customer_api_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id INTEGER NOT NULL,
            usage_date TEXT NOT NULL,
            requests INTEGER NOT NULL DEFAULT 0,

            UNIQUE(key_id, usage_date),

            FOREIGN KEY (key_id)
            REFERENCES customer_api_keys(id)
            ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


init_database()


# ==================================================
# SYSTEM PROMPT  (Gemini style clean answers)
# ==================================================

SYSTEM_PROMPT = """
You are ChatXON Mind, a helpful AI assistant developed by Sahil for StratisSoft.

Identity:
- Creator: Sahil
- Company: StratisSoft
- You are not ChatGPT or made by OpenAI.

Response style (very important):
- Reply in the same language the user is using (Hindi, English or natural Hinglish).
- Write clean, natural and easy to read answers.
- Prefer short paragraphs and clear structure.
- When listing points, use simple bullet points with • 
- Do not use markdown stars (**bold**), code blocks or heavy formatting unless truly needed.
- Keep answers accurate, direct and helpful.
- Be friendly but professional.
- Never invent facts. If unsure, say so politely.
"""


# ==================================================
# CLEAN AI RESPONSE
# ==================================================

def clean_ai_answer(text):

    if not text:
        return text

    # Remove Markdown formatting characters.
    text = re.sub(r"\*+", "", text)
    text = re.sub(r"(?m)^\s*#+\s*", "", text)
    text = text.replace("```", "")
    text = text.replace("`", "")

    # Convert common Markdown list markers into clean bullets.
    text = re.sub(r"(?m)^\s*[-•]\s+", "• ", text)

    # Keep normal brackets when they are meaningful.
    text = re.sub(r"\(\s*\)", "", text)
    text = re.sub(r"\[\s*\]", "", text)

    # Clean excessive spaces and blank lines.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ==================================================
# TIME
# ==================================================

def get_current_time():

    return datetime.now().strftime(
        "%d %b • %I:%M %p"
    )


# ==================================================
# USER
# ==================================================

def ensure_user(user_id):

    if not user_id:
        return False

    conn = get_db()

    existing = conn.execute(
        """
        SELECT user_id
        FROM users
        WHERE user_id = ?
        """,
        (user_id,)
    ).fetchone()

    if not existing:

        conn.execute(
            """
            INSERT INTO users
            (
                user_id,
                created_at
            )
            VALUES (?, ?)
            """,
            (
                user_id,
                get_current_time()
            )
        )

        conn.commit()

    conn.close()

    return True


# ==================================================
# HTML
# ==================================================

def get_html():

    path = os.path.join(
        os.path.dirname(
            os.path.abspath(__file__)
        ),
        "template.html"
    )

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as f:

        return f.read()


# ==================================================
# HOME
# ==================================================

@app.route("/")
def home():

    return render_template_string(
        get_html()
    )


# ==================================================
# GET CHATS
# ==================================================

@app.route(
    "/get_chats",
    methods=["POST"]
)
def get_chats():

    data = request.get_json() or {}

    user_id = data.get("user_id")

    if not user_id:

        return jsonify({
            "chats": []
        })

    ensure_user(user_id)

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            chat_id,
            title,
            updated_at
        FROM chats
        WHERE user_id = ?
        ORDER BY updated_at DESC
        """,
        (user_id,)
    ).fetchall()

    conn.close()

    chats = [

        {
            "chat_id": row["chat_id"],
            "title": row["title"],
            "updated_at": row["updated_at"]
        }

        for row in rows
    ]

    return jsonify({
        "chats": chats
    })


# ==================================================
# GET ONE CHAT
# ==================================================

@app.route(
    "/get_chat",
    methods=["POST"]
)
def get_chat():

    data = request.get_json() or {}

    user_id = data.get("user_id")
    chat_id = data.get("chat_id")

    if not user_id or not chat_id:

        return jsonify({
            "messages": []
        })

    conn = get_db()

    chat = conn.execute(
        """
        SELECT chat_id
        FROM chats
        WHERE chat_id = ?
        AND user_id = ?
        """,
        (
            chat_id,
            user_id
        )
    ).fetchone()

    if not chat:

        conn.close()

        return jsonify({
            "messages": []
        })

    rows = conn.execute(
        """
        SELECT
            role,
            content
        FROM messages
        WHERE chat_id = ?
        ORDER BY id ASC
        """,
        (chat_id,)
    ).fetchall()

    conn.close()

    messages = [

        {
            "role": row["role"],
            "content": row["content"]
        }

        for row in rows
    ]

    return jsonify({
        "messages": messages
    })


# ==================================================
# NEW CHAT
# ==================================================

@app.route(
    "/new_chat",
    methods=["POST"]
)
def new_chat():

    data = request.get_json() or {}

    user_id = data.get("user_id")

    if not user_id:

        return jsonify({
            "error": "user_id required"
        }), 400

    ensure_user(user_id)

    chat_id = uuid.uuid4().hex

    now = get_current_time()

    conn = get_db()

    conn.execute(
        """
        INSERT INTO chats
        (
            chat_id,
            user_id,
            title,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            chat_id,
            user_id,
            "New Chat",
            now,
            now
        )
    )

    conn.execute(
        """
        INSERT INTO messages
        (
            chat_id,
            role,
            content,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            chat_id,
            "system",
            SYSTEM_PROMPT,
            now
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "chat_id": chat_id
    })


# ==================================================
# ASK AI
# ==================================================

@app.route(
    "/ask",
    methods=["POST"]
)
def ask():

    data = request.get_json() or {}

    question = data.get(
        "question",
        ""
    ).strip()

    user_id = data.get("user_id")
    chat_id = data.get("chat_id")

    images = data.get("images") or []

    if not isinstance(images, list):

        images = []

    # Maximum 3 images
    images = [
        img
        for img in images
        if (
            isinstance(img, str)
            and img.startswith("data:image")
        )
    ][:3]

    if not question and not images:

        return jsonify({
            "answer":
            "Please type something or attach an image."
        })

    if not user_id or not chat_id:

        return jsonify({
            "session_error": True
        })

    if not GROQ_API_KEY:

        return jsonify({
            "answer":
            "API key not configured."
        })

    ensure_user(user_id)

    conn = get_db()

    chat = conn.execute(
        """
        SELECT
            chat_id,
            title
        FROM chats
        WHERE chat_id = ?
        AND user_id = ?
        """,
        (
            chat_id,
            user_id
        )
    ).fetchone()

    if not chat:

        conn.close()

        return jsonify({
            "session_error": True
        })

    rows = conn.execute(
        """
        SELECT
            role,
            content
        FROM messages
        WHERE chat_id = ?
        ORDER BY id ASC
        """,
        (chat_id,)
    ).fetchall()

    messages = [

        {
            "role": row["role"],
            "content": row["content"]
        }

        for row in rows
    ]

    now = get_current_time()

    # Save user message
    store_content = question

    if images:

        store_content = (
            question
            + "\n\n[User attached "
            + str(len(images))
            + " image(s)]"
        ).strip()

    conn.execute(
        """
        INSERT INTO messages
        (
            chat_id,
            role,
            content,
            created_at
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            chat_id,
            "user",
            store_content,
            now
        )
    )

    # Chat title
    current_title = chat["title"]

    if current_title == "New Chat":

        new_title = (
            question or "Image chat"
        )[:42]

        if len(question or "") > 42:

            new_title += "..."

        conn.execute(
            """
            UPDATE chats
            SET
                title = ?,
                updated_at = ?
            WHERE chat_id = ?
            AND user_id = ?
            """,
            (
                new_title,
                now,
                chat_id,
                user_id
            )
        )

    else:

        conn.execute(
            """
            UPDATE chats
            SET updated_at = ?
            WHERE chat_id = ?
            AND user_id = ?
            """,
            (
                now,
                chat_id,
                user_id
            )
        )

    conn.commit()
    conn.close()


    # ==================================================
    # BUILD GROQ MESSAGE
    # ==================================================

    if images:

        content_parts = []

        if question:

            content_parts.append({
                "type": "text",
                "text": question
            })

        else:

            content_parts.append({
                "type": "text",
                "text":
                "Please look at the attached image(s) and help me."
            })

        for img_data in images:

            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": img_data
                }
            })

        messages.append({
            "role": "user",
            "content": content_parts
        })

        use_model = MODEL_VISION
        max_out_tokens = 800

    else:

        messages.append({
            "role": "user",
            "content": question
        })

        use_model = MODEL_TEXT
        max_out_tokens = 1024


    # ==================================================
    # GROQ REQUEST
    # ==================================================

    headers = {
        "Authorization":
        f"Bearer {GROQ_API_KEY}",

        "Content-Type":
        "application/json"
    }

    payload = {
        "model": use_model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_out_tokens
    }

    try:

        response = requests.post(
            GROQ_URL,
            headers=headers,
            json=payload,
            timeout=90
        )

        if response.status_code != 200:

            return jsonify({
                "answer":
                "API Error: "
                + response.text
            })

        result = response.json()

        choices = result.get(
            "choices",
            []
        )

        if not choices:

            return jsonify({
                "answer":
                "The AI returned an empty response."
            })

        answer = (
            choices[0]
            .get("message", {})
            .get("content", "")
        )

        answer = clean_ai_answer(answer)

        if not answer:

            return jsonify({
                "answer":
                "The AI returned an empty response."
            })

        # Save assistant answer
        conn = get_db()

        conn.execute(
            """
            INSERT INTO messages
            (
                chat_id,
                role,
                content,
                created_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                chat_id,
                "assistant",
                answer,
                get_current_time()
            )
        )

        conn.execute(
            """
            UPDATE chats
            SET updated_at = ?
            WHERE chat_id = ?
            AND user_id = ?
            """,
            (
                get_current_time(),
                chat_id,
                user_id
            )
        )

        conn.commit()
        conn.close()

        return jsonify({
            "answer": answer
        })

    except requests.exceptions.Timeout:

        return jsonify({
            "answer":
            "The AI server took too long to respond. Please try again."
        })

    except requests.exceptions.RequestException as e:

        return jsonify({
            "answer":
            "Network error: " + str(e)
        })

    except Exception as e:

        return jsonify({
            "answer":
            "Server error: " + str(e)
        })


# ==================================================
# CUSTOMER API SYSTEM
# ==================================================


def hash_customer_key(api_key):

    return hashlib.sha256(
        api_key.encode("utf-8")
    ).hexdigest()


def generate_customer_key():

    return (
        "cxm_live_"
        + secrets.token_urlsafe(32)
    )


def check_admin():

    if not ADMIN_API_KEY:

        return False

    supplied_key = request.headers.get(
        "X-Admin-Key",
        ""
    )

    return secrets.compare_digest(
        supplied_key,
        ADMIN_API_KEY
    )


def create_customer_key(daily_limit):

    while True:

        new_key = generate_customer_key()

        key_hash = hash_customer_key(
            new_key
        )

        conn = get_db()

        existing = conn.execute(
            """
            SELECT id
            FROM customer_api_keys
            WHERE key_hash = ?
            """,
            (key_hash,)
        ).fetchone()

        if existing:

            conn.close()
            continue

        conn.execute(
            """
            INSERT INTO customer_api_keys
            (
                key_hash,
                key_prefix,
                daily_limit,
                active,
                created_at
            )
            VALUES (?, ?, ?, 1, ?)
            """,
            (
                key_hash,
                new_key[:16],
                daily_limit,
                datetime.utcnow().isoformat()
            )
        )

        conn.commit()

        conn.close()

        return new_key


def authenticate_customer():

    customer_key = request.headers.get(
        "X-API-Key",
        ""
    ).strip()

    if not customer_key:

        authorization = request.headers.get(
            "Authorization",
            ""
        )

        if authorization.startswith(
            "Bearer "
        ):

            customer_key = (
                authorization[7:]
                .strip()
            )

    if not customer_key:

        return None

    key_hash = hash_customer_key(
        customer_key
    )

    conn = get_db()

    row = conn.execute(
        """
        SELECT *
        FROM customer_api_keys
        WHERE key_hash = ?
        AND active = 1
        """,
        (key_hash,)
    ).fetchone()

    conn.close()

    return row


def get_customer_usage(key_id):

    today = date.today().isoformat()

    conn = get_db()

    row = conn.execute(
        """
        SELECT requests
        FROM customer_api_usage
        WHERE key_id = ?
        AND usage_date = ?
        """,
        (
            key_id,
            today
        )
    ).fetchone()

    conn.close()

    if not row:

        return 0

    return row["requests"]


def record_customer_usage(key_id):

    today = date.today().isoformat()

    conn = get_db()

    conn.execute(
        """
        INSERT INTO customer_api_usage
        (
            key_id,
            usage_date,
            requests
        )
        VALUES (?, ?, 1)

        ON CONFLICT(key_id, usage_date)
        DO UPDATE SET
            requests = requests + 1
        """,
        (
            key_id,
            today
        )
    )

    conn.commit()

    conn.close()


def check_customer_limit(key):

    used = get_customer_usage(
        key["id"]
    )

    limit = key["daily_limit"]

    return used < limit


@app.route(
    "/admin/generate-key",
    methods=["POST"]
)
def admin_generate_key():

    if not check_admin():

        return jsonify({
            "error": "Unauthorized"
        }), 401

    data = request.get_json() or {}

    daily_limit = data.get(
        "daily_limit",
        DEFAULT_DAILY_LIMIT
    )

    try:

        daily_limit = int(
            daily_limit
        )

    except (TypeError, ValueError):

        daily_limit = DEFAULT_DAILY_LIMIT

    if daily_limit < 1:

        daily_limit = 1

    if daily_limit > 100000:

        daily_limit = 100000

    new_key = create_customer_key(
        daily_limit
    )

    return jsonify({
        "success": True,
        "key": new_key,
        "daily_limit": daily_limit,
        "message":
        "Save this API key securely. The raw key is shown only once."
    })


@app.route(
    "/admin/keys",
    methods=["GET"]
)
def admin_keys():

    if not check_admin():

        return jsonify({
            "error": "Unauthorized"
        }), 401

    conn = get_db()

    rows = conn.execute(
        """
        SELECT
            id,
            key_prefix,
            daily_limit,
            active,
            created_at
        FROM customer_api_keys
        ORDER BY id DESC
        """
    ).fetchall()

    conn.close()

    result = []

    for row in rows:

        used = get_customer_usage(
            row["id"]
        )

        result.append({
            "id": row["id"],
            "key_prefix": row["key_prefix"],
            "daily_limit": row["daily_limit"],
            "used_today": used,
            "remaining_today":
                max(
                    row["daily_limit"] - used,
                    0
                ),
            "active":
                bool(row["active"]),
            "created_at":
                row["created_at"]
        })

    return jsonify({
        "keys": result
    })


@app.route(
    "/admin/key/<int:key_id>/limit",
    methods=["POST"]
)
def admin_change_limit(key_id):

    if not check_admin():

        return jsonify({
            "error": "Unauthorized"
        }), 401

    data = request.get_json() or {}

    daily_limit = data.get(
        "daily_limit"
    )

    try:

        daily_limit = int(
            daily_limit
        )

    except (TypeError, ValueError):

        return jsonify({
            "error":
            "daily_limit must be a number"
        }), 400

    if daily_limit < 1:

        return jsonify({
            "error":
            "daily_limit must be at least 1"
        }), 400

    if daily_limit > 100000:

        return jsonify({
            "error":
            "daily_limit is too large"
        }), 400

    conn = get_db()

    cursor = conn.execute(
        """
        UPDATE customer_api_keys
        SET daily_limit = ?
        WHERE id = ?
        """,
        (
            daily_limit,
            key_id
        )
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:

        return jsonify({
            "error":
            "API key not found"
        }), 404

    return jsonify({
        "success": True,
        "key_id": key_id,
        "daily_limit": daily_limit
    })


@app.route(
    "/admin/key/<int:key_id>/revoke",
    methods=["POST"]
)
def admin_revoke_key(key_id):

    if not check_admin():

        return jsonify({
            "error": "Unauthorized"
        }), 401

    conn = get_db()

    cursor = conn.execute(
        """
        UPDATE customer_api_keys
        SET active = 0
        WHERE id = ?
        """,
        (key_id,)
    )

    conn.commit()
    conn.close()

    if cursor.rowcount == 0:

        return jsonify({
            "error":
            "API key not found"
        }), 404

    return jsonify({
        "success": True,
        "key_id": key_id,
        "active": False,
        "message":
        "API key revoked successfully."
    })


@app.route(
    "/v1/status",
    methods=["GET"]
)
def customer_status():

    key = authenticate_customer()

    if not key:

        return jsonify({
            "error":
            "Invalid or missing API key"
        }), 401

    used = get_customer_usage(
        key["id"]
    )

    limit = key["daily_limit"]

    return jsonify({
        "success": True,
        "key_id": key["id"],
        "key_prefix": key["key_prefix"],
        "daily_limit": limit,
        "used_today": used,
        "remaining_today":
            max(limit - used, 0),
        "active": bool(key["active"]),
        "usage_date":
            date.today().isoformat()
    })


@app.route(
    "/v1/chat",
    methods=["POST"]
)
def customer_chat():

    key = authenticate_customer()

    if not key:

        return jsonify({
            "error":
            "Invalid or missing API key"
        }), 401

    if not check_customer_limit(key):

        used = get_customer_usage(
            key["id"]
        )

        return jsonify({
            "error":
            "Daily API limit reached.",
            "key_id":
            key["id"],
            "daily_limit":
            key["daily_limit"],
            "used_today":
            used,
            "remaining_today": 0
        }), 429

    data = request.get_json() or {}

    question = data.get(
        "question",
        ""
    )

    if not isinstance(
        question,
        str
    ):

        question = str(question)

    question = question.strip()

    images = data.get(
        "images"
    ) or []

    if not isinstance(
        images,
        list
    ):

        images = []

    images = [
        img
        for img in images
        if (
            isinstance(img, str)
            and img.startswith("data:image")
        )
    ][:3]

    if not question and not images:

        return jsonify({
            "error":
            "Please provide question or images."
        }), 400

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        }
    ]

    if images:

        content_parts = []

        if question:

            content_parts.append({
                "type": "text",
                "text": question
            })

        else:

            content_parts.append({
                "type": "text",
                "text":
                "Please look at the attached image(s) and help me."
            })

        for img_data in images:

            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": img_data
                }
            })

        messages.append({
            "role": "user",
            "content": content_parts
        })

        use_model = MODEL_VISION
        max_out_tokens = 800

    else:

        messages.append({
            "role": "user",
            "content": question
        })

        use_model = MODEL_TEXT
        max_out_tokens = 1024

    headers = {
        "Authorization":
        f"Bearer {GROQ_API_KEY}",

        "Content-Type":
        "application/json"
    }

    payload = {
        "model": use_model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_out_tokens
    }

    try:

        if not GROQ_API_KEY:

            return jsonify({
                "error":
                "Server API key is not configured."
            }), 500

        response = requests.post(
            GROQ_URL,
            headers=headers,
            json=payload,
            timeout=90
        )

        if response.status_code != 200:

            return jsonify({
                "error":
                "AI provider error.",
                "provider_status":
                response.status_code,
                "details":
                response.text
            }), response.status_code

        result = response.json()

        choices = result.get(
            "choices",
            []
        )

        if not choices:

            return jsonify({
                "error":
                "AI returned an empty response."
            }), 502

        answer = (
            choices[0]
            .get("message", {})
            .get("content", "")
        )

        answer = clean_ai_answer(answer)

        if not answer:

            return jsonify({
                "error":
                "AI returned an empty response."
            }), 502

        record_customer_usage(
            key["id"]
        )

        used = get_customer_usage(
            key["id"]
        )

        remaining = max(
            key["daily_limit"] - used,
            0
        )

        return jsonify({
            "success": True,
            "answer": answer,
            "model": use_model,
            "key_id": key["id"],
            "daily_limit":
                key["daily_limit"],
            "used_today": used,
            "remaining_today":
                remaining
        })

    except requests.exceptions.Timeout:

        return jsonify({
            "error":
            "AI provider timeout. Please try again."
        }), 504

    except requests.exceptions.RequestException:

        return jsonify({
            "error":
            "Network error while contacting AI provider."
        }), 502

    except Exception as e:

        return jsonify({
            "error":
            "Server error: " + str(e)
        }), 500


# ==================================================
# HEALTH CHECK
# ==================================================

@app.route(
    "/health",
    methods=["GET"]
)
def health():

    return jsonify({
        "status": "ok",
        "service": "ChatXON Mind",
        "company": "StratisSoft"
    })


# ==================================================
# RUN
# ==================================================

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
