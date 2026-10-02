import os
import sqlite3
import uuid
import base64
from datetime import datetime

from flask import Flask, jsonify, render_template_string, request
import requests

app = Flask(__name__)

# ==================================================
# GROQ SETTINGS
# ==================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

# Text-only model (fallback)
MODEL_TEXT = "openai/gpt-oss-20b"

# Vision / multimodal model (supports images)
MODEL_VISION = "qwen/qwen3.8-27b"

MODEL = MODEL_TEXT


# ==================================================
# DATABASE
# ==================================================

DATABASE = os.environ.get("DATABASE_PATH", "chatxon.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row

    # Foreign key system ON
    conn.execute("PRAGMA foreign_keys = ON")

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

    return datetime.now().strftime("%d %b • %I:%M %p")


# ==================================================
# USER SYSTEM
# ==================================================

def ensure_user(user_id):

    if not user_id:
        return False

    conn = get_db()

    existing = conn.execute(
        "SELECT user_id FROM users WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    if not existing:

        conn.execute(
            """
            INSERT INTO users (user_id, created_at)
            VALUES (?, ?)
            """,
            (user_id, get_current_time())
        )

        conn.commit()

    conn.close()

    return True


# ==================================================
# HTML TEMPLATE
# ==================================================

def get_html():
    """Load the HTML template from file."""
    import os
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "template.html")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()




# ==================================================
# HOME
# ==================================================

@app.route("/")
def home():

    return render_template_string(get_html())


# ==================================================
# GET ALL CHATS OF ONE USER
# ==================================================

@app.route("/get_chats", methods=["POST"])
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

@app.route("/get_chat", methods=["POST"])
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
        (chat_id, user_id)
    ).fetchone()


    if not chat:

        conn.close()

        return jsonify({
            "messages": []
        })


    rows = conn.execute(
        """
        SELECT role, content
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

@app.route("/new_chat", methods=["POST"])
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

@app.route("/ask", methods=["POST"])
def ask():

    data = request.get_json() or {}


    question = data.get(
        "question",
        ""
    ).strip()


    user_id = data.get("user_id")


    chat_id = data.get("chat_id")


    # Optional list of base64 data-URL images from frontend
    images = data.get("images") or []
    if not isinstance(images, list):
        images = []

    # Keep only valid image data URLs (max 3)
    images = [
        img for img in images
        if isinstance(img, str) and img.startswith("data:image")
    ][:3]


    if not question and not images:

        return jsonify({
            "answer": "Please type something or attach an image."
        })


    if not user_id or not chat_id:

        return jsonify({
            "session_error": True
        })


    if not GROQ_API_KEY:

        return jsonify({
            "answer": "API key not configured."
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
        SELECT role, content
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


    # Store text note in DB (images not persisted as base64 to keep DB small)
    store_content = question
    if images:
        store_content = (question + "\n\n[User attached " + str(len(images)) + " image(s)]").strip()


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

        new_title = (question or "Image chat")[:42]

        if len(question or "") > 42:

            new_title += "..."


        conn.execute(
            """
            UPDATE chats
            SET title = ?,
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


    # Build user message for API
    # If images present → multimodal content list + vision model
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
                "text": "Please look at the attached image(s) and help me."
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

    else:

        messages.append({
            "role": "user",
            "content": question
        })

        use_model = MODEL_TEXT


    headers = {

        "Authorization": f"Bearer {GROQ_API_KEY}",

        "Content-Type": "application/json"

    }


    payload = {

        "model": use_model,

        "messages": messages,

        "temperature": 0.7,

        "max_tokens": 2048

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

                "answer": "API Error: " + response.text

            })


        result = response.json()


        answer = result["choices"][0]["message"]["content"]


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
            "answer": "Server error: " + str(e)
        })


# ==================================================
# START SERVER
# ==================================================

if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))


    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
