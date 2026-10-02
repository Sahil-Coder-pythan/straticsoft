import os
import sqlite3
import uuid
import base64
import secrets
import hashlib
from datetime import datetime, date

from flask import Flask, jsonify, render_template_string, request
import requests

app = Flask(__name__)


# ==================================================
# GROQ SETTINGS
# ==================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Text-only model
MODEL_TEXT = "openai/gpt-oss-20b"

# Vision / multimodal model
MODEL_VISION = "qwen/qwen3.8-27b"

MODEL = MODEL_TEXT


# ==================================================
# ADMIN API KEY
# ==================================================

# इसे Render Environment Variables में रखो
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")

# नई Customer Key की default limit
DEFAULT_DAILY_LIMIT = 100


# ==================================================
# DATABASE
# ==================================================

DATABASE = os.environ.get(
    "DATABASE_PATH",
    "chatxon.db"
)


def get_db():

    conn = sqlite3.connect(DATABASE)

    conn.row_factory = sqlite3.Row

    conn.execute(
        "PRAGMA foreign_keys = ON"
    )

    return conn


def init_database():

    conn = get_db()

    # ----------------------------------------------
    # USERS
    # ----------------------------------------------

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        )
    """)

    # ----------------------------------------------
    # CHATS
    # ----------------------------------------------

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

    # ----------------------------------------------
    # MESSAGES
    # ----------------------------------------------

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

    # Faster searching
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_chats_user
        ON chats(user_id)
    """)

    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_chat
        ON messages(chat_id)
    """)


    # ==================================================
    # CUSTOMER API KEYS
    #
    # यह existing AI database से अलग tables हैं।
    # ==================================================

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


    # ==================================================
    # CUSTOMER API USAGE
    # ==================================================

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


# Database automatically initialize
init_database()


# ==================================================
# SYSTEM PROMPT
# ==================================================

SYSTEM_PROMPT = """
You are ChatXON Mind Version 1.

Your name is ChatXON Mind.
You are the AI assistant developed by Sahil for the ChatXON Mind project.

Identity Facts (use these when asked about yourself):
- Creator: Sahil
- Creation Date: 26 September 2026
- Place: Uttarakhand
- Project: ChatXON Mind project
- Company: StratisSoft
- Founder and CEO of StratisSoft: Sahil
- Number of Founders: 1 (only Sahil)
- StratisSoft was created on 26 September 2026 by Sahil alone.

Technology: You use the Groq API/model configured by your developer.
Never claim that Sahil created the Groq model.
You can also see and understand images that the user attaches.

Very Important Rules:
- Never use any markdown. Do not use ** for bold, * for italic,
  # for headings, - or * for lists, or any other symbols for formatting.
- Always reply in pure plain text only. No stars, no symbols for formatting.
- Never identify yourself as ChatGPT.
- Respond in the same language the user is using (Hindi, Hinglish or English).
- Talk naturally, friendly and clearly — like ChatGPT or Grok.
- Do not sound robotic.
- Keep answers helpful and concise.
"""


# ==================================================
# TIME
# ==================================================

def get_current_time():

    return datetime.now().strftime(
        "%d %b • %I:%M %p"
    )


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
# HTML TEMPLATE
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
# GET ALL CHATS OF ONE USER
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
#
# तुम्हारा पुराना AI LOGIC
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

    # Optional list of base64 data-URL images
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


    # Store text note in DB
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


    # ==================================================
    # BUILD USER MESSAGE FOR GROQ
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
            "Server error: "
            + str(e)
        })


# ==================================================
# ==================================================
#
# CUSTOMER API SYSTEM
#
# ==================================================
# ==================================================


# ==================================================
# HASH CUSTOMER KEY
# ==================================================

def hash_customer_key(api_key):

    return hashlib.sha256(
        api_key.encode("utf-8")
    ).hexdigest()


# ==================================================
# GENERATE UNIQUE CUSTOMER KEY
# ==================================================

def generate_customer_key():

    return (
        "cxm_live_"
        + secrets.token_urlsafe(32)
    )


# ==================================================
# CHECK ADMIN KEY
# ==================================================

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


# ==================================================
# CREATE CUSTOMER KEY
# ==================================================

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


# ==================================================
# AUTHENTICATE CUSTOMER
# ==================================================

def authenticate_customer():

    authorization = request.headers.get(
        "Authorization",
        ""
    )


    if not authorization.startswith(
        "Bearer "
    ):

        return None


    customer_key = (
        authorization[7:].strip()
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


# ==================================================
# GET CUSTOMER USAGE
# ==================================================

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


# ==================================================
# RECORD CUSTOMER USAGE
# ==================================================

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
        (key_id, today)
    )


    conn.commit()

    conn.close()


# ==================================================
# ADMIN: GENERATE NEW CUSTOMER KEY
# ==================================================

@app.route(
    "/admin/generate-key",
    methods=["POST"]
)
def admin_generate_key():

    if not check_admin():

        return jsonify({
            "error": "Invalid admin key"
        }), 401


    data = request.get_json(
        silent=True
    ) or {}


    daily_limit = data.get(
        "daily_limit",
        DEFAULT_DAILY_LIMIT
    )


    try:

        daily_limit = int(
            daily_limit
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({
            "error":
            "daily_limit must be a number"
        }), 400


    if daily_limit < 1:

        return jsonify({
            "error":
            "daily_limit must be at least 1"
        }), 400


    # IMPORTANT:
    # पुरानी keys को delete नहीं किया जा रहा।
    new_key = create_customer_key(
        daily_limit
    )


    return jsonify({

        "service":
        "ChatXON Mind API",

        "message":
        "New customer key generated. Previous keys remain active.",

        "key":
        new_key,

        "daily_limit":
        daily_limit

    })


# ==================================================
# ADMIN: LIST ALL CUSTOMER KEYS
# ==================================================

@app.route(
    "/admin/keys",
    methods=["GET"]
)
def admin_list_keys():

    if not check_admin():

        return jsonify({
            "error": "Invalid admin key"
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


    keys = []


    for row in rows:

        keys.append({

            "id":
            row["id"],

            "key_prefix":
            row["key_prefix"],

            "daily_limit":
            row["daily_limit"],

            "active":
            bool(row["active"]),

            "created_at":
            row["created_at"]

        })


    return jsonify({

        "service":
        "ChatXON Mind API",

        "total_keys":
        len(keys),

        "keys":
        keys

    })


# ==================================================
# ADMIN: CHANGE ONE KEY LIMIT
# ==================================================

@app.route(
    "/admin/key/<int:key_id>/limit",
    methods=["POST"]
)
def admin_change_limit(key_id):

    if not check_admin():

        return jsonify({
            "error":
            "Invalid admin key"
        }), 401


    data = request.get_json(
        silent=True
    ) or {}


    new_limit = data.get(
        "daily_limit"
    )


    try:

        new_limit = int(
            new_limit
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({
            "error":
            "daily_limit must be a number"
        }), 400


    if new_limit < 1:

        return jsonify({
            "error":
            "daily_limit must be at least 1"
        }), 400


    conn = get_db()


    result = conn.execute(
        """
        UPDATE customer_api_keys
        SET daily_limit = ?
        WHERE id = ?
        """,
        (
            new_limit,
            key_id
        )
    )


    conn.commit()

    changed = result.rowcount

    conn.close()


    if changed == 0:

        return jsonify({
            "error":
            "Customer key not found"
        }), 404


    return jsonify({

        "message":
        "Customer daily limit updated",

        "key_id":
        key_id,

        "daily_limit":
        new_limit

    })


# ==================================================
# ADMIN: REVOKE ONE CUSTOMER KEY
# ==================================================

@app.route(
    "/admin/key/<int:key_id>/revoke",
    methods=["POST"]
)
def admin_revoke_key(key_id):

    if not check_admin():

        return jsonify({
            "error":
            "Invalid admin key"
        }), 401


    conn = get_db()


    result = conn.execute(
        """
        UPDATE customer_api_keys
        SET active = 0
        WHERE id = ?
        """,
        (key_id,)
    )


    conn.commit()

    changed = result.rowcount

    conn.close()


    if changed == 0:

        return jsonify({
            "error":
            "Customer key not found"
        }), 404


    return jsonify({

        "message":
        "Customer key revoked",

        "key_id":
        key_id

    })


# ==================================================
# CUSTOMER API: STATUS
# ==================================================

@app.route(
    "/v1/status",
    methods=["GET"]
)
def customer_status():

    customer = authenticate_customer()


    if not customer:

        return jsonify({
            "error":
            "Invalid or inactive customer API key"
        }), 401


    used = get_customer_usage(
        customer["id"]
    )


    limit = customer[
        "daily_limit"
    ]


    return jsonify({

        "service":
        "ChatXON Mind API",

        "status":
        "active",

        "key_id":
        customer["id"],

        "daily_limit":
        limit,

        "used_today":
        used,

        "remaining_today":
        max(
            0,
            limit - used
        )

    })


# ==================================================
# CUSTOMER API: CHAT
#
# यह तुम्हारे existing /ask को replace नहीं करता।
# ==================================================

@app.route(
    "/v1/chat",
    methods=["POST"]
)
def customer_chat():

    customer = authenticate_customer()


    if not customer:

        return jsonify({
            "error":
            "Invalid or inactive customer API key"
        }), 401


    used = get_customer_usage(
        customer["id"]
    )


    limit = customer[
        "daily_limit"
    ]


    if used >= limit:

        return jsonify({

            "error":
            "Daily rate limit reached",

            "key_id":
            customer["id"],

            "daily_limit":
            limit,

            "used_today":
            used

        }), 429


    data = request.get_json(
        silent=True
    ) or {}


    question = data.get(
        "question",
        ""
    ).strip()


    images = data.get(
        "images"
    ) or []


    if not isinstance(
        images,
        list
    ):

        images = []


    # API में भी maximum 3 images
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
            "question or images required"
        }), 400


    # ==================================================
    # CUSTOMER API MESSAGE
    #
    # Existing AI models वही हैं।
    # ==================================================

    api_messages = [

        {
            "role":
            "system",

            "content":
            SYSTEM_PROMPT
        }

    ]


    if images:

        content_parts = []


        if question:

            content_parts.append({

                "type":
                "text",

                "text":
                question

            })


        else:

            content_parts.append({

                "type":
                "text",

                "text":
                "Please look at the attached image(s) and help me."

            })


        for img_data in images:

            content_parts.append({

                "type":
                "image_url",

                "image_url": {

                    "url":
                    img_data

                }

            })


        api_messages.append({

            "role":
            "user",

            "content":
            content_parts

        })


        use_model = MODEL_VISION

        max_out_tokens = 800


    else:

        api_messages.append({

            "role":
            "user",

            "content":
            question

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

        "model":
        use_model,

        "messages":
        api_messages,

        "temperature":
        0.7,

        "max_tokens":
        max_out_tokens

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
                "AI provider error",

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


        # केवल successful AI response को count करें
        record_customer_usage(
            customer["id"]
        )


        new_used = used + 1


        return jsonify({

            "service":
            "ChatXON Mind API",

            "answer":
            answer,

            "key_id":
            customer["id"],

            "daily_limit":
            limit,

            "used_today":
            new_used,

            "remaining_today":
            max(
                0,
                limit - new_used
            )

        })


    except Exception as e:

        return jsonify({

            "error":
            "Server error",

            "details":
            str(e)

        }), 500


# ==================================================
# START SERVER
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