import os
import sqlite3
import uuid
from datetime import datetime

from flask import Flask, jsonify, render_template_string, request
import requests

app = Flask(__name__)

# ==================================================
# GROQ SETTINGS
# ==================================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

MODEL = "openai/gpt-oss-20b"


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

HTML = r"""
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>ChatXON Mind</title>

<meta name="author" content="Sahil">

<meta name="description"
content="ChatXON Mind - AI Assistant by Sahil">

<style>

:root {

  --bg: #0f0f13;
  --sidebar-bg: #16161c;
  --card: #1c1c24;
  --border: #2a2a35;

  --text: #ececf1;
  --text-muted: #8b8b9a;

  --accent: #7c5cff;
  --accent-hover: #6a4de0;

  --user-bubble: #2a2a35;
  --ai-bubble: #1c1c24;

}

* {

  box-sizing: border-box;
  margin: 0;
  padding: 0;

}

body {

  background: var(--bg);
  color: var(--text);

  font-family:
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  Helvetica,
  Arial,
  sans-serif;

  height: 100vh;
  overflow: hidden;

}

.app {

  display: flex;
  height: 100dvh;

}


/* SIDEBAR */

.sidebar {

  width: 260px;

  background: var(--sidebar-bg);

  border-right: 1px solid var(--border);

  display: flex;
  flex-direction: column;

  flex-shrink: 0;

  transition: transform 0.25s ease;

}

.sidebar-header {

  padding: 16px;

  border-bottom:
  1px solid var(--border);

}

.new-chat-btn {

  width: 100%;

  background: var(--accent);

  color: white;

  border: none;

  border-radius: 10px;

  padding: 11px 14px;

  font-size: 14px;

  font-weight: 500;

  cursor: pointer;

  display: flex;

  align-items: center;
  justify-content: center;

  gap: 8px;

}

.new-chat-btn:hover {

  background:
  var(--accent-hover);

}

.chat-list {

  flex: 1;

  overflow-y: auto;

  padding: 10px;

}

.chat-item {

  padding: 12px 14px;

  border-radius: 10px;

  cursor: pointer;

  font-size: 13.5px;

  margin-bottom: 3px;

  color: var(--text-muted);

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

}

.chat-item:hover {

  background: #22222b;

  color: var(--text);

}

.chat-item.active {

  background: #2a2a35;

  color: var(--text);

}

.chat-item .time {

  font-size: 11px;

  color: #555;

  margin-top: 3px;

}


/* MAIN */

.main {

  flex: 1;

  display: flex;

  flex-direction: column;

  min-width: 0;

  position: relative;

}

.topbar {

  height: 56px;

  display: flex;

  align-items: center;

  padding: 0 16px;

  border-bottom:
  1px solid var(--border);

  background: var(--bg);

  gap: 12px;

}

.menu-btn {

  display: none;

  background: none;

  border: none;

  color: var(--text);

  font-size: 22px;

  cursor: pointer;

  padding: 4px 8px;

}

.brand {

  display: flex;

  align-items: center;

  gap: 10px;

}

.logo {

  width: 32px;
  height: 32px;

  border-radius: 9px;

  background:
  linear-gradient(
    135deg,
    #7c5cff,
    #4f46e5
  );

  display: flex;

  align-items: center;
  justify-content: center;

  font-weight: 700;

  font-size: 14px;

  color: white;

}

.brand-name {

  font-size: 15px;

  font-weight: 600;

}


/* CHAT */

.chat {

  flex: 1;

  overflow-y: auto;

  padding:
  24px 16px 140px;

  scroll-behavior: smooth;

}

.message {

  display: flex;

  width: 100%;

  margin-bottom: 20px;

}

.message.user {

  justify-content: flex-end;

}

.message.ai {

  justify-content: flex-start;

}

.bubble {

  max-width:
  min(720px, 85%);

  padding:
  12px 16px;

  border-radius: 16px;

  line-height: 1.6;

  font-size: 15px;

  white-space: pre-wrap;

  word-wrap: break-word;

}

.user .bubble {

  background:
  var(--user-bubble);

  border-bottom-right-radius: 4px;

}

.ai .bubble {

  background:
  var(--ai-bubble);

  border:
  1px solid var(--border);

  border-bottom-left-radius: 4px;

}

.ai-label {

  font-size: 11px;

  color:
  var(--text-muted);

  margin-bottom: 5px;

  letter-spacing: 0.4px;

  font-weight: 500;

}


/* WELCOME */

.welcome {

  height: 100%;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  text-align: center;

  padding: 20px;

  color:
  var(--text-muted);

}

.welcome-logo {

  width: 56px;
  height: 56px;

  border-radius: 16px;

  background:
  linear-gradient(
    135deg,
    #7c5cff,
    #4f46e5
  );

  display: flex;

  align-items: center;
  justify-content: center;

  font-size: 24px;

  font-weight: 700;

  color: white;

  margin-bottom: 20px;

}

.welcome h1 {

  font-size: 22px;

  font-weight: 600;

  color: var(--text);

  margin-bottom: 8px;

}

.welcome p {

  font-size: 15px;

  max-width: 360px;

  line-height: 1.5;

}


/* THINKING */

.thinking {

  display: flex;

  align-items: center;

  gap: 5px;

  padding: 14px 16px;

  background:
  var(--ai-bubble);

  border:
  1px solid var(--border);

  border-radius: 16px;

  width: max-content;

}

.dot {

  width: 6px;
  height: 6px;

  background: #888;

  border-radius: 50%;

  animation:
  blink 1.2s infinite;

}

.dot:nth-child(2) {

  animation-delay: 0.2s;

}

.dot:nth-child(3) {

  animation-delay: 0.4s;

}

@keyframes blink {

  0%, 100% {

    opacity: 0.3;

    transform:
    translateY(0);

  }

  50% {

    opacity: 1;

    transform:
    translateY(-3px);

  }

}


/* INPUT */

.input-area {

  position: absolute;

  left: 0;
  right: 0;
  bottom: 0;

  padding:
  12px 16px 20px;

  background:
  linear-gradient(
    transparent,
    var(--bg) 30%
  );

}

.input-box {

  max-width: 780px;

  margin: 0 auto;

  background:
  var(--card);

  border:
  1px solid var(--border);

  border-radius: 16px;

  display: flex;

  align-items: center;

  padding:
  8px 10px 8px 16px;

  gap: 8px;

  box-shadow:
  0 4px 24px
  rgba(0,0,0,0.3);

}

#question {

  flex: 1;

  background: transparent;

  border: none;

  outline: none;

  color: var(--text);

  font-size: 15px;

  min-width: 0;

}

#question::placeholder {

  color: #666;

}

.send {

  width: 40px;
  height: 40px;

  border: none;

  border-radius: 12px;

  background:
  var(--accent);

  color: white;

  font-size: 18px;

  cursor: pointer;

  display: flex;

  align-items: center;

  justify-content: center;

}

.send:hover {

  background:
  var(--accent-hover);

}

.send:disabled {

  opacity: 0.4;

  cursor: not-allowed;

}


/* OVERLAY */

.overlay {

  display: none;

  position: fixed;

  inset: 0;

  background:
  rgba(0,0,0,0.5);

  z-index: 20;

}


/* MOBILE */

@media (max-width: 768px) {

  .sidebar {

    position: fixed;

    left: 0;
    top: 0;
    bottom: 0;

    z-index: 30;

    transform:
    translateX(-100%);

  }

  .sidebar.open {

    transform:
    translateX(0);

  }

  .menu-btn {

    display: block;

  }

  .overlay.show {

    display: block;

  }

}


/* SCROLLBAR */

.chat::-webkit-scrollbar,
.chat-list::-webkit-scrollbar {

  width: 5px;

}

.chat::-webkit-scrollbar-thumb,
.chat-list::-webkit-scrollbar-thumb {

  background: #333;

  border-radius: 10px;

}

</style>

</head>

<body>

<div class="app">

  <div class="sidebar" id="sidebar">

    <div class="sidebar-header">

      <button
        class="new-chat-btn"
        onclick="createNewChat()">

        + New Chat

      </button>

    </div>

    <div
      class="chat-list"
      id="chatList">
    </div>

  </div>


  <div
    class="overlay"
    id="overlay"
    onclick="closeSidebar()">
  </div>


  <div class="main">

    <div class="topbar">

      <button
        class="menu-btn"
        onclick="toggleSidebar()">

        ☰

      </button>

      <div class="brand">

        <div class="logo">
          X
        </div>

        <div class="brand-name">
          ChatXON Mind
        </div>

      </div>

    </div>


    <div
      id="chat"
      class="chat">
    </div>


    <div class="input-area">

      <div class="input-box">

        <input
          id="question"
          type="text"
          placeholder="Message ChatXON Mind..."
          autocomplete="off">

        <button
          id="send"
          class="send"
          onclick="sendMessage()">

          ↑

        </button>

      </div>

    </div>

  </div>

</div>


<script>

const chat =
document.getElementById("chat");

const question =
document.getElementById("question");

const sendBtn =
document.getElementById("send");

const chatList =
document.getElementById("chatList");

const sidebar =
document.getElementById("sidebar");

const overlay =
document.getElementById("overlay");


let currentChatId = null;


/* ==========================================
   UNIQUE USER ID
   ========================================== */

function getUserId() {

  let id =
    localStorage.getItem(
      "chatxon_user_id"
    );

  if (!id) {

    id =
      crypto.randomUUID();

    localStorage.setItem(
      "chatxon_user_id",
      id
    );

  }

  return id;

}


/* ==========================================
   SIDEBAR
   ========================================== */

function toggleSidebar() {

  sidebar.classList.toggle("open");

  overlay.classList.toggle("show");

}


function closeSidebar() {

  sidebar.classList.remove("open");

  overlay.classList.remove("show");

}


/* ==========================================
   SCROLL
   ========================================== */

function scrollToBottom() {

  setTimeout(() => {

    chat.scrollTo({

      top: chat.scrollHeight,

      behavior: "smooth"

    });

  }, 40);

}


/* ==========================================
   CHAT UI
   ========================================== */

function clearChat() {

  chat.innerHTML = "";

}


function showWelcome() {

  clearChat();

  chat.innerHTML = `

    <div class="welcome">

      <div class="welcome-logo">
        X
      </div>

      <h1>
        ChatXON Mind
      </h1>

      <p>
        How can I help you today?
      </p>

    </div>

  `;

}


function addMessage(text, type) {

  const welcome =
    chat.querySelector(".welcome");

  if (welcome) {

    welcome.remove();

  }


  const div =
    document.createElement("div");

  div.className =
    `message ${type}`;


  if (type === "ai") {

    div.innerHTML = `

      <div>

        <div class="ai-label">
          CHATXON MIND
        </div>

        <div class="bubble">
        </div>

      </div>

    `;

  } else {

    div.innerHTML = `

      <div class="bubble">
      </div>

    `;

  }


  div.querySelector(".bubble")
     .textContent = text;


  chat.appendChild(div);

  scrollToBottom();

}


/* ==========================================
   THINKING
   ========================================== */

function showThinking() {

  const div =
    document.createElement("div");

  div.id = "thinking";

  div.className =
    "message ai";


  div.innerHTML = `

    <div>

      <div class="ai-label">
        CHATXON MIND
      </div>

      <div class="thinking">

        <span class="dot"></span>

        <span class="dot"></span>

        <span class="dot"></span>

      </div>

    </div>

  `;


  chat.appendChild(div);

  scrollToBottom();

}


function removeThinking() {

  const el =
    document.getElementById(
      "thinking"
    );

  if (el) {

    el.remove();

  }

}


/* ==========================================
   LOAD CHAT LIST
   ========================================== */

async function loadChatList() {

  try {

    const res =
      await fetch("/get_chats", {

        method: "POST",

        headers: {

          "Content-Type":
          "application/json"

        },

        body: JSON.stringify({

          user_id:
          getUserId()

        })

      });


    const data =
      await res.json();


    renderChatList(
      data.chats || []
    );


  } catch (e) {

    console.error(e);

  }

}


/* ==========================================
   RENDER CHAT LIST
   ========================================== */

function renderChatList(chats) {

  chatList.innerHTML = "";


  if (chats.length === 0) {

    chatList.innerHTML = `

      <div
        style="
        padding:24px;
        text-align:center;
        color:#555;
        font-size:13px;">

        No conversations yet

      </div>

    `;

    return;

  }


  chats.forEach(c => {

    const item =
      document.createElement("div");


    item.className =
      "chat-item" +
      (
        c.chat_id === currentChatId
        ? " active"
        : ""
      );


    item.innerHTML = `

      <div>
        ${escapeHtml(
          c.title || "New Chat"
        )}
      </div>

      <div class="time">
        ${escapeHtml(
          c.updated_at || ""
        )}
      </div>

    `;


    item.onclick = () =>
      loadChat(c.chat_id);


    chatList.appendChild(item);

  });

}


/* ==========================================
   HTML ESCAPE
   ========================================== */

function escapeHtml(text) {

  const div =
    document.createElement("div");

  div.textContent =
    text;

  return div.innerHTML;

}


/* ==========================================
   LOAD PARTICULAR CHAT
   ========================================== */

async function loadChat(chatId) {

  currentChatId =
    chatId;


  localStorage.setItem(
    "chatxon_chat_id",
    chatId
  );


  closeSidebar();


  try {

    const res =
      await fetch("/get_chat", {

        method: "POST",

        headers: {

          "Content-Type":
          "application/json"

        },

        body: JSON.stringify({

          user_id:
          getUserId(),

          chat_id:
          chatId

        })

      });


    const data =
      await res.json();


    if (!data.messages || data.messages.length === 0) {

      return false;

    }


    clearChat();


    let userOrAiMessages = 0;

    data.messages.forEach(m => {

      if (m.role === "user") {

        addMessage(
          m.content,
          "user"
        );

        userOrAiMessages++;

      }

      else if (
        m.role === "assistant"
      ) {

        addMessage(
          m.content,
          "ai"
        );

        userOrAiMessages++;

      }

    });


    if (userOrAiMessages === 0) {

      showWelcome();

    }


    loadChatList();

    return true;


  } catch (e) {

    return false;

  }

}


/* ==========================================
   CREATE NEW CHAT
   ========================================== */

async function createNewChat() {

  try {

    const res =
      await fetch("/new_chat", {

        method: "POST",

        headers: {

          "Content-Type":
          "application/json"

        },

        body: JSON.stringify({

          user_id:
          getUserId()

        })

      });


    const data =
      await res.json();


    currentChatId =
      data.chat_id;


    localStorage.setItem(
      "chatxon_chat_id",
      currentChatId
    );


    showWelcome();

    loadChatList();

    closeSidebar();

    question.focus();


  } catch (e) {

    console.error(e);

  }

}


/* ==========================================
   SEND MESSAGE
   ========================================== */

async function sendMessage() {

  const text =
    question.value.trim();


  if (!text) {

    return;

  }


  if (!currentChatId) {

    await createNewChat();

  }


  addMessage(
    text,
    "user"
  );


  question.value = "";

  sendBtn.disabled = true;

  showThinking();


  try {

    const res =
      await fetch("/ask", {

        method: "POST",

        headers: {

          "Content-Type":
          "application/json"

        },

        body: JSON.stringify({

          question: text,

          user_id:
          getUserId(),

          chat_id:
          currentChatId

        })

      });


    const data =
      await res.json();


    removeThinking();


    if (data.answer) {

      addMessage(
        data.answer,
        "ai"
      );

    }

    else {

      addMessage(
        "Something went wrong. Please try again.",
        "ai"
      );

    }


    loadChatList();


  } catch (e) {

    removeThinking();


    addMessage(
      "Connection error. Please try again.",
      "ai"
    );

  }


  sendBtn.disabled = false;

  question.focus();

}


/* ==========================================
   INITIALIZE
   ========================================== */

async function init() {

  const saved =
    localStorage.getItem(
      "chatxon_chat_id"
    );


  let success = false;


  if (saved) {

    success = await loadChat(saved);

  }


  if (!success) {

    await createNewChat();

  }


  loadChatList();

}


question.addEventListener(
  "keydown",
  (e) => {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      sendMessage();

    }

  }
);


init();

question.focus();

</script>

</body>

</html>
"""


# ==================================================
# HOME
# ==================================================

@app.route("/")
def home():

    return render_template_string(HTML)


# ==================================================
# GET ALL CHATS OF ONE USER
# ==================================================

@app.route("/get_chats", methods=["POST"])
def get_chats():

    data = (
        request.get_json() or {}
    )

    user_id = (
        data.get("user_id")
    )


    if not user_id:

        return jsonify({
            "chats": []
        })


    ensure_user(user_id)


    conn = (
        get_db()
    )


    rows = (
        conn.execute(
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
    )


    conn.close()


    chats = [

        {
            "chat_id":
                row["chat_id"],

            "title":
                row["title"],

            "updated_at":
                row["updated_at"]

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

    data = (
        request.get_json() or {}
    )


    user_id = (
        data.get("user_id")
    )

    chat_id = (
        data.get("chat_id")
    )


    if not user_id or not chat_id:

        return jsonify({
            "messages": []
        })


    conn = (
        get_db()
    )


    # IMPORTANT:
    # chat_id AND user_id दोनों check होंगे.
    # इससे दूसरे user की chat नहीं खुलेगी.

    chat = (
        conn.execute(
            """
            SELECT chat_id
            FROM chats
            WHERE chat_id = ?
            AND user_id = ?
            """,
            (chat_id, user_id)
        ).fetchone()
    )


    if not chat:

        conn.close()

        return jsonify({
            "messages": []
        })


    rows = (
        conn.execute(
            """
            SELECT role, content
            FROM messages
            WHERE chat_id = ?
            ORDER BY id ASC
            """,
            (chat_id,)
        ).fetchall()
    )


    conn.close()


    messages = [

        {
            "role":
                row["role"],

            "content":
                row["content"]

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

    data = (
        request.get_json() or {}
    )


    user_id = (
        data.get("user_id")
    )


    if not user_id:

        return jsonify({
            "error":
            "user_id required"
        }), 400


    ensure_user(user_id)


    chat_id = (
        uuid.uuid4().hex
    )


    now = (
        get_current_time()
    )


    conn = (
        get_db()
    )


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


    # System prompt भी database में रहेगा

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
        "chat_id":
        chat_id
    })


# ==================================================
# ASK AI
# ==================================================

@app.route("/ask", methods=["POST"])
def ask():

    data = (
        request.get_json() or {}
    )


    question = (
        data.get(
            "question",
            ""
        ).strip()
    )


    user_id = (
        data.get("user_id")
    )


    chat_id = (
        data.get("chat_id")
    )


    if not question:

        return jsonify({
            "answer":
            "Please type something."
        })


    if not user_id or not chat_id:

        return jsonify({
            "answer":
            "Session error. Please refresh."
        })


    if not GROQ_API_KEY:

        return jsonify({
            "answer":
            "API key not configured."
        })


    ensure_user(user_id)


    conn = (
        get_db()
    )


    # ------------------------------------------------
    # SECURITY CHECK
    # ------------------------------------------------

    chat = (
        conn.execute(
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
    )


    # अगर chat इस user की नहीं है

    if not chat:

        conn.close()

        return jsonify({
            "answer":
            "Session error. Please create a new chat."
        })


    # ------------------------------------------------
    # OLD MESSAGES
    # ------------------------------------------------

    rows = (
        conn.execute(
            """
            SELECT role, content
            FROM messages
            WHERE chat_id = ?
            ORDER BY id ASC
            """,
            (chat_id,)
        ).fetchall()
    )


    messages = [

        {
            "role":
                row["role"],

            "content":
                row["content"]

        }

        for row in rows

    ]


    # ------------------------------------------------
    # USER MESSAGE DATABASE में SAVE
    # ------------------------------------------------

    now = (
        get_current_time()
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
            "user",
            question,
            now
        )
    )


    # ------------------------------------------------
    # CHAT TITLE
    # ------------------------------------------------

    current_title = (
        chat["title"]
    )


    if current_title == "New Chat":

        new_title = (
            question[:42]
        )

        if len(question) > 42:

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


    # ------------------------------------------------
    # GROQ REQUEST
    # ------------------------------------------------

    messages.append({
        "role":
        "user",

        "content":
        question
    })


    headers = {

        "Authorization":
        f"Bearer {GROQ_API_KEY}",

        "Content-Type":
        "application/json"

    }


    payload = {

        "model":
        MODEL,

        "messages":
        messages,

        "temperature":
        0.7,

        "max_tokens":
        2048

    }


    try:

        response = (
            requests.post(
                GROQ_URL,
                headers=headers,
                json=payload,
                timeout=60
            )
        )


        if response.status_code != 200:

            return jsonify({

                "answer":
                "API Error: "
                + response.text

            })


        result = (
            response.json()
        )


        answer = (
            result[
                "choices"
            ][0][
                "message"
            ][
                "content"
            ]
        )


        # ------------------------------------------------
        # AI ANSWER DATABASE में SAVE
        # ------------------------------------------------

        conn = (
            get_db()
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
            "answer":
            answer
        })


    except Exception as e:

        return jsonify({
            "answer":
            "Server error: "
            + str(e)
        })


# ==================================================
# START SERVER
# ==================================================

if __name__ == "__main__":

    port = (
        int(
            os.environ.get(
                "PORT",
                5000
            )
        )
    )


    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
