import os
import sqlite3
import uuid
import secrets
import hashlib

from datetime import datetime, date

from flask import Flask, jsonify, render_template_string, request
import requests


app = Flask(__name__)


# ==================================================
# API / GROQ SETTINGS
# ==================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# केवल ADMIN key Render Environment Variable में रखनी है.
# Customer API key Environment Variable में नहीं रखनी.
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

MODEL_TEXT = "openai/gpt-oss-20b"

MODEL_VISION = "qwen/qwen3.8-27b"

DAILY_REQUEST_LIMIT = 100


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

    return conn


# ==================================================
# TIME
# ==================================================

def get_current_time():

    return datetime.now().strftime(
        "%d %b • %I:%M %p"
    )


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

    # API KEYS
    conn.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            key_id TEXT UNIQUE NOT NULL,

            key_hash TEXT UNIQUE NOT NULL,

            name TEXT NOT NULL,

            active INTEGER NOT NULL DEFAULT 1,

            total_requests INTEGER NOT NULL DEFAULT 0,

            created_at TEXT NOT NULL,

            last_used_at TEXT
        )
    """)

    # API USAGE
    conn.execute("""
        CREATE TABLE IF NOT EXISTS api_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            key_id TEXT NOT NULL,

            request_date TEXT NOT NULL,

            created_at TEXT NOT NULL,

            FOREIGN KEY (key_id)
            REFERENCES api_keys(key_id)
            ON DELETE CASCADE
        )
    """)

    # INDEXES
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_chats_user
        ON chats(user_id)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_chat
        ON messages(chat_id)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_api_key_hash
        ON api_keys(key_hash)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_api_usage_key_date
        ON api_usage(key_id, request_date)
    """)

    conn.commit()

    conn.close()


# ==================================================
# SYSTEM PROMPT
# ==================================================

SYSTEM_PROMPT = """
You are ChatXON Mind Version 1.

Your name is ChatXON Mind.
You are the AI assistant developed by Sahil for the ChatXON Mind project.

Identity Facts:
Creator: Sahil
Creation Date: 26 September 2026
Place: Uttarakhand
Project: ChatXON Mind project
Company: StratisSoft
Founder and CEO of StratisSoft: Sahil
Number of Founders: 1

Technology: You use the Groq API/model configured by your developer.
Never claim that Sahil created the Groq model.
You can also see and understand images that the user attaches.

Very Important Rules:
Never use markdown.
Always reply in plain text.
Never identify yourself as ChatGPT.
Respond in the same language the user is using.
Talk naturally, friendly and clearly.
Keep answers helpful and concise.
"""


# ==================================================
# USER SYSTEM
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

    return jsonify({
        "chats": [
            {
                "chat_id": row["chat_id"],
                "title": row["title"],
                "updated_at": row["updated_at"]
            }
            for row in rows
        ]
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

    return jsonify({
        "messages": [
            {
                "role": row["role"],
                "content": row["content"]
            }
            for row in rows
        ]
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

    images = [
        img
        for img in images
        if isinstance(img, str)
        and img.startswith("data:image")
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

    # IMAGE
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
        max_out_tokens = 2048

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

        answer = result[
            "choices"
        ][0][
            "message"
        ][
            "content"
        ]

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

    except Exception as e:

        return jsonify({
            "answer":
            "Server error: " + str(e)
        })


# ==================================================
# API KEY FUNCTIONS
# ==================================================

def hash_api_key(api_key):

    return hashlib.sha256(
        api_key.encode("utf-8")
    ).hexdigest()


def generate_customer_api_key():

    # Example:
    # cxm_live_xxxxxxxxxxxxxxxxxxxxxxxxx
    return (
        "cxm_live_"
        + secrets.token_urlsafe(32)
    )


# ==================================================
# AUTO ROTATE CUSTOMER KEY
# ==================================================

def rotate_customer_key():

    """
    Server start होते ही:

    1. सभी पुरानी customer keys delete
    2. पुराना usage data delete
    3. नई customer key generate
    4. नई key database में hash के रूप में save
    5. raw key memory में रखी जाती है
    """

    global CURRENT_CUSTOMER_KEY

    new_key = generate_customer_api_key()

    new_key_hash = hash_api_key(
        new_key
    )

    new_key_id = (
        "key_"
        + uuid.uuid4().hex
    )

    now = get_current_time()

    conn = get_db()

    # पुरानी usage हटाओ
    conn.execute(
        """
        DELETE FROM api_usage
        """
    )

    # पुरानी सभी customer keys हटाओ
    conn.execute(
        """
        DELETE FROM api_keys
        """
    )

    # नई customer key
    conn.execute(
        """
        INSERT INTO api_keys
        (
            key_id,
            key_hash,
            name,
            active,
            total_requests,
            created_at,
            last_used_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_key_id,
            new_key_hash,
            "ChatXON Customer Key",
            1,
            0,
            now,
            None
        )
    )

    conn.commit()

    conn.close()

    # Raw key केवल server memory में
    CURRENT_CUSTOMER_KEY = new_key

    return new_key


# ==================================================
# FIND API KEY
# ==================================================

def find_api_key(api_key):

    if not api_key:
        return None

    key_hash = hash_api_key(
        api_key
    )

    conn = get_db()

    row = conn.execute(
        """
        SELECT *
        FROM api_keys
        WHERE key_hash = ?
        AND active = 1
        """,
        (key_hash,)
    ).fetchone()

    conn.close()

    return row


# ==================================================
# GET CUSTOMER API KEY
# ==================================================

def get_customer_api_key():

    authorization = request.headers.get(
        "Authorization",
        ""
    )

    if not authorization.startswith(
        "Bearer "
    ):
        return None

    api_key = authorization[
        7:
    ].strip()

    if not api_key:
        return None

    return api_key


# ==================================================
# CHECK DAILY LIMIT
# ==================================================

def check_daily_limit(key_id):

    today = date.today().isoformat()

    conn = get_db()

    row = conn.execute(
        """
        SELECT COUNT(*) AS total
        FROM api_usage
        WHERE key_id = ?
        AND request_date = ?
        """,
        (
            key_id,
            today
        )
    ).fetchone()

    conn.close()

    return row["total"] < DAILY_REQUEST_LIMIT


# ==================================================
# RECORD API USAGE
# ==================================================

def record_api_usage(key_id):

    now = get_current_time()

    today = date.today().isoformat()

    conn = get_db()

    conn.execute(
        """
        INSERT INTO api_usage
        (
            key_id,
            request_date,
            created_at
        )
        VALUES (?, ?, ?)
        """,
        (
            key_id,
            today,
            now
        )
    )

    conn.execute(
        """
        UPDATE api_keys
        SET
            total_requests =
            total_requests + 1,

            last_used_at = ?
        WHERE key_id = ?
        """,
        (
            now,
            key_id
        )
    )

    conn.commit()

    conn.close()


# ==================================================
# ADMIN AUTH
# ==================================================

def check_admin():

    if not ADMIN_API_KEY:
        return False

    supplied_key = request.headers.get(
        "X-Admin-Key",
        ""
    ).strip()

    return (
        secrets.compare_digest(
            supplied_key,
            ADMIN_API_KEY
        )
    )


# ==================================================
# ADMIN: GET CURRENT CUSTOMER KEY
# ==================================================

@app.route(
    "/admin/customer-key",
    methods=["GET"]
)
def admin_customer_key():

    if not check_admin():

        return jsonify({
            "error":
            "Unauthorized"
        }), 401

    return jsonify({

        "service":
        "ChatXON Mind API",

        "status":
        "online",

        "key":
        CURRENT_CUSTOMER_KEY,

        "daily_limit":
        DAILY_REQUEST_LIMIT

    })


# ==================================================
# ADMIN: ROTATE CUSTOMER KEY MANUALLY
# ==================================================

@app.route(
    "/admin/rotate-key",
    methods=["POST"]
)
def admin_rotate_key():

    if not check_admin():

        return jsonify({
            "error":
            "Unauthorized"
        }), 401

    new_key = rotate_customer_key()

    return jsonify({

        "service":
        "ChatXON Mind API",

        "message":
        "Old customer key deleted. New customer key generated.",

        "key":
        new_key,

        "daily_limit":
        DAILY_REQUEST_LIMIT

    })


# ==================================================
# PUBLIC API V1
# ==================================================

@app.route(
    "/v1/chat",
    methods=["POST"]
)
def api_chat():

    # CUSTOMER KEY
    customer_key = get_customer_api_key()

    if not customer_key:

        return jsonify({
            "error":
            "API key required"
        }), 401

    # FIND KEY
    api_key_row = find_api_key(
        customer_key
    )

    if not api_key_row:

        return jsonify({
            "error":
            "Invalid or inactive API key"
        }), 401

    # DAILY LIMIT
    if not check_daily_limit(
        api_key_row["key_id"]
    ):

        return jsonify({
            "error":
            "Daily request limit reached",
            "daily_limit":
            DAILY_REQUEST_LIMIT
        }), 429

    # REQUEST DATA
    data = request.get_json() or {}

    question = data.get(
        "question",
        ""
    ).strip()

    if not question:

        return jsonify({
            "error":
            "question required"
        }), 400

    if not GROQ_API_KEY:

        return jsonify({
            "error":
            "GROQ_API_KEY is not configured"
        }), 500

    # RECORD USAGE
    record_api_usage(
        api_key_row["key_id"]
    )

    # GROQ REQUEST
    headers = {

        "Authorization":
        f"Bearer {GROQ_API_KEY}",

        "Content-Type":
        "application/json"

    }

    payload = {

        "model":
        MODEL_TEXT,

        "messages": [

            {
                "role":
                "system",

                "content":
                SYSTEM_PROMPT
            },

            {
                "role":
                "user",

                "content":
                question
            }

        ],

        "temperature":
        0.7,

        "max_tokens":
        2048
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

                "error":
                "Groq API error",

                "details":
                response.text

            }), 502

        result = response.json()

        answer = result[
            "choices"
        ][0][
            "message"
        ][
            "content"
        ]

        return jsonify({

            "answer":
            answer,

            "key_id":
            api_key_row["key_id"],

            "daily_limit":
            DAILY_REQUEST_LIMIT

        })

    except requests.exceptions.Timeout:

        return jsonify({

            "error":
            "AI request timed out"

        }), 504

    except Exception as e:

        return jsonify({

            "error":
            "Server error",

            "details":
            str(e)

        }), 500


# ==================================================
# API STATUS
# ==================================================

@app.route(
    "/api/status",
    methods=["GET"]
)
def api_status():

    return jsonify({

        "service":
        "ChatXON Mind API",

        "status":
        "online",

        "version":
        "v1"

    })


# ==================================================
# STARTUP
# ==================================================

# Database पहले initialize करो
init_database()


# Server start/deploy होते ही
# पुरानी customer key हटाकर नई generate होगी.
CURRENT_CUSTOMER_KEY = rotate_customer_key()


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
        port=port
    )
