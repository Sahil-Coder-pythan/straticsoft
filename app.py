from collections import defaultdict
import os
from datetime import datetime

from flask import Flask, jsonify, render_template_string, request
import requests

app = Flask(__name__)

# ==============================
# GROQ SETTINGS
# ==============================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "openai/gpt-oss-20b"

# ==============================
# SYSTEM PROMPT
# ==============================

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

# ==============================
# HISTORY STORAGE
# ==============================

# Structure:
# histories[user_id][chat_id] = {
#     "title": str,
#     "messages": list,
#     "updated_at": str
# }
histories = defaultdict(dict)

# ==============================
# HTML TEMPLATE
# ==============================

HTML = r"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sahil's ChatXON Mind</title>

<meta name="google-site-verification"
      content="5X4ciFi7nkTdC4nZDAojU05xgldy6vZtUzoEqAfK7VE" />
<meta name="author" content="Sahil" />
<meta name="creator" content="Sahil" />
<meta name="description"
      content="ChatXON Mind is an AI assistant developed by Sahil under StratisSoft." />

<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0b0b0f;color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;height:100vh;overflow:hidden;}
.app{height:100dvh;display:flex;background:#0b0b0f;}

/* Sidebar */
.sidebar{width:280px;background:#111114;border-right:1px solid #24242b;display:flex;flex-direction:column;flex-shrink:0;transition:transform 0.25s ease;}
.sidebar-header{padding:16px;border-bottom:1px solid #24242b;display:flex;align-items:center;justify-content:space-between;}
.sidebar-title{font-size:15px;font-weight:600;}
.new-chat-btn{background:#7c3aed;color:white;border:none;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;}
.new-chat-btn:hover{background:#6d28d9;}
.chat-list{flex:1;overflow-y:auto;padding:10px;}
.chat-item{padding:12px 14px;border-radius:10px;cursor:pointer;font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ccc;transition:background 0.15s;}
.chat-item:hover{background:#1c1c22;}
.chat-item.active{background:#2a2a35;color:white;}
.chat-item .time{font-size:11px;color:#666;margin-top:3px;}

/* Main Area */
.main{flex:1;display:flex;flex-direction:column;min-width:0;}
.topbar{height:64px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #24242b;background:#0b0b0f;}
.brand{display:flex;align-items:center;gap:10px;}
.menu-btn{display:none;background:none;border:none;color:white;font-size:22px;cursor:pointer;padding:6px;}
.logo{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c3aed,#2563eb);font-weight:bold;font-size:16px;}
.brand-text{display:flex;flex-direction:column;gap:2px;}
.brand-name{font-size:16px;font-weight:700;}
.version{font-size:10px;color:#888;letter-spacing:1px;}

.chat{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:24px 14px 150px;scroll-behavior:smooth;}
.message{display:flex;width:100%;margin-bottom:18px;}
.message.user{justify-content:flex-end;}
.message.ai{justify-content:flex-start;}
.bubble{max-width:min(760px,88%);padding:13px 15px;border-radius:18px;line-height:1.55;font-size:15px;white-space:pre-wrap;word-wrap:break-word;}
.user.bubble{background:#2f2f38;border-bottom-right-radius:5px;}
.ai.bubble{background:#15151b;border:1px solid #25252d;border-bottom-left-radius:5px;}
.ai-label{font-size:10px;color:#8b8b96;margin-bottom:5px;letter-spacing:.7px;}
.thinking{display:flex;align-items:center;gap:5px;padding:14px 16px;background:#15151b;border:1px solid #25252d;border-radius:18px;width:max-content;}
.dot{width:6px;height:6px;background:#aaa;border-radius:50%;animation:thinking 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes thinking{0%,100%{opacity:.25;transform:translateY(0);}50%{opacity:1;transform:translateY(-3px);}}

.input-area{position:fixed;left:280px;right:0;bottom:0;padding:12px 14px 16px;background:linear-gradient(transparent,#0b0b0f 25%);transition:left 0.25s ease;}
.input-box{max-width:850px;margin:auto;min-height:58px;display:flex;align-items:center;gap:8px;padding:8px 9px 8px 15px;background:#15151b;border:1px solid #303038;border-radius:18px;box-shadow:0 10px 35px rgba(0,0,0,.35);}
.search-icon{font-size:19px;color:#8c8c95;user-select:none;}
#question{flex:1;border:none;outline:none;background:transparent;color:white;font-size:15px;min-width:0;resize:none;}
#question::placeholder{color:#777780;}
.send{width:42px;height:42px;border:none;border-radius:13px;background:#fff;color:#000;font-size:19px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.send:active{transform:scale(.94);}
.send:disabled{opacity:.45;cursor:not-allowed;}

/* Overlay for mobile */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:20;}

/* Mobile */
@media(max-width:768px){
  .sidebar{position:fixed;left:0;top:0;bottom:0;z-index:30;transform:translateX(-100%);}
  .sidebar.open{transform:translateX(0);}
  .menu-btn{display:block;}
  .input-area{left:0;}
  .overlay.show{display:block;}
}

.chat::-webkit-scrollbar,.chat-list::-webkit-scrollbar{width:6px;}
.chat::-webkit-scrollbar-track,.chat-list::-webkit-scrollbar-track{background:transparent;}
.chat::-webkit-scrollbar-thumb,.chat-list::-webkit-scrollbar-thumb{background:#33333b;border-radius:20px;}
</style>
</head>
<body>
<div class="app">

  <!-- Sidebar -->
  <div class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">History</div>
      <button class="new-chat-btn" onclick="createNewChat()">+ New</button>
    </div>
    <div class="chat-list" id="chatList">
      <!-- Chat items will be added here -->
    </div>
  </div>

  <!-- Overlay -->
  <div class="overlay" id="overlay" onclick="closeSidebar()"></div>

  <!-- Main Content -->
  <div class="main">
    <div class="topbar">
      <div class="brand">
        <button class="menu-btn" onclick="toggleSidebar()">☰</button>
        <div class="logo">X</div>
        <div class="brand-text">
          <div class="brand-name">Sahil's ChatXON Mind</div>
          <div class="version">VERSION 1 • AI ASSISTANT</div>
        </div>
      </div>
    </div>

    <div id="chat" class="chat">
      <div class="message ai">
        <div>
          <div class="ai-label">CHATXON MIND</div>
          <div class="bubble">Namaste! 👋<br><br>
          Main ChatXON Mind Version 1 hoon.<br>
          Main Sahil ke ChatXON Mind project ka AI assistant hoon.<br><br>
          Aap mujhse kuch bhi pooch sakte ho.</div>
        </div>
      </div>
    </div>

    <div class="input-area">
      <div class="input-box">
        <div class="search-icon">⌕</div>
        <input id="question" type="text" autocomplete="off"
               placeholder="Message ChatXON Mind...">
        <button id="send" class="send" onclick="sendMessage()">↑</button>
      </div>
    </div>
  </div>
</div>

<script>
const chat = document.getElementById("chat");
const question = document.getElementById("question");
const send = document.getElementById("send");
const chatList = document.getElementById("chatList");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");

let currentChatId = null;

// ==============================
// USER ID
// ==============================

function getUserId() {
    let userId = localStorage.getItem("chatxon_user_id");
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("chatxon_user_id", userId);
    }
    return userId;
}

// ==============================
// SIDEBAR
// ==============================

function toggleSidebar() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
}

function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
}

// ==============================
// UI HELPERS
// ==============================

function scrollToBottom() {
    setTimeout(() => {
        chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
    }, 50);
}

function clearChatUI() {
    chat.innerHTML = "";
}

function addMessage(text, type) {
    const message = document.createElement("div");
    message.className = "message " + type;

    if (type === "ai") {
        message.innerHTML = `
            <div>
                <div class="ai-label">CHATXON MIND</div>
                <div class="bubble"></div>
            </div>`;
    } else {
        message.innerHTML = `<div class="bubble"></div>`;
    }

    message.querySelector(".bubble").textContent = text;
    chat.appendChild(message);
    scrollToBottom();
}

function showThinking() {
    const thinking = document.createElement("div");
    thinking.id = "thinking";
    thinking.className = "message ai";
    thinking.innerHTML = `
        <div>
            <div class="ai-label">CHATXON MIND</div>
            <div class="thinking">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
            </div>
        </div>`;
    chat.appendChild(thinking);
    scrollToBottom();
}

function removeThinking() {
    const thinking = document.getElementById("thinking");
    if (thinking) thinking.remove();
}

function showWelcome() {
    clearChatUI();
    chat.innerHTML = `
        <div class="message ai">
            <div>
                <div class="ai-label">CHATXON MIND</div>
                <div class="bubble">
                    Namaste! 👋<br><br>
                    Main ChatXON Mind Version 1 hoon.<br>
                    Main Sahil ke ChatXON Mind project ka AI assistant hoon.<br><br>
                    Aap mujhse kuch bhi pooch sakte ho.
                </div>
            </div>
        </div>`;
}

// ==============================
// HISTORY FUNCTIONS
// ==============================

async function loadChatList() {
    try {
        const res = await fetch("/get_chats", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: getUserId() })
        });
        const data = await res.json();
        renderChatList(data.chats || []);
    } catch (e) {
        console.log(e);
    }
}

function renderChatList(chats) {
    chatList.innerHTML = "";

    if (chats.length === 0) {
        chatList.innerHTML = `<div style="padding:20px;color:#666;font-size:13px;text-align:center;">No chats yet</div>`;
        return;
    }

    chats.forEach(c => {
        const item = document.createElement("div");
        item.className = "chat-item" + (c.chat_id === currentChatId ? " active" : "");
        item.innerHTML = `
            <div>${c.title || "New Chat"}</div>
            <div class="time">${c.updated_at || ""}</div>
        `;
        item.onclick = () => loadChat(c.chat_id);
        chatList.appendChild(item);
    });
}

async function loadChat(chatId) {
    currentChatId = chatId;
    localStorage.setItem("chatxon_chat_id", chatId);
    closeSidebar();

    try {
        const res = await fetch("/get_chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: getUserId(),
                chat_id: chatId
            })
        });
        const data = await res.json();

        clearChatUI();

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                if (msg.role === "user") {
                    addMessage(msg.content, "user");
                } else if (msg.role === "assistant") {
                    addMessage(msg.content, "ai");
                }
            });
        } else {
            showWelcome();
        }

        loadChatList();
    } catch (e) {
        console.log(e);
        showWelcome();
    }
}

async function createNewChat() {
    try {
        const res = await fetch("/new_chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: getUserId() })
        });
        const data = await res.json();

        currentChatId = data.chat_id;
        localStorage.setItem("chatxon_chat_id", currentChatId);

        showWelcome();
        loadChatList();
        closeSidebar();
        question.focus();
    } catch (e) {
        console.log(e);
    }
}

// ==============================
// SEND MESSAGE
// ==============================

async function sendMessage() {
    const text = question.value.trim();
    if (!text) return;

    // Agar koi chat selected nahi hai to naya banao
    if (!currentChatId) {
        await createNewChat();
    }

    addMessage(text, "user");
    question.value = "";
    send.disabled = true;
    showThinking();

    try {
        const res = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: text,
                user_id: getUserId(),
                chat_id: currentChatId
            })
        });

        const data = await res.json();
        removeThinking();

        if (data.answer) {
            addMessage(data.answer, "ai");
        } else {
            addMessage("Sorry, mujhe response nahi mila.", "ai");
        }

        // Title update ke liye list refresh
        loadChatList();

    } catch (error) {
        removeThinking();
        addMessage("Server se connection nahi ho paaya.", "ai");
    }

    send.disabled = false;
    question.focus();
    scrollToBottom();
}

// ==============================
// INIT
// ==============================

async function init() {
    const savedChatId = localStorage.getItem("chatxon_chat_id");

    if (savedChatId) {
        currentChatId = savedChatId;
        await loadChat(savedChatId);
    } else {
        await createNewChat();
    }

    loadChatList();
}

question.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

init();
question.focus();
</script>
</body>
</html>
"""

# ==============================
# HELPER
# ==============================


def get_current_time():
    return datetime.now().strftime("%d %b, %I:%M %p")


# ==============================
# ROUTES
# ==============================


@app.route("/")
def home():
    return render_template_string(HTML)


@app.route("/get_chats", methods=["POST"])
def get_chats():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"chats": []})

    user_chats = histories.get(user_id, {})
    chat_list = []

    for chat_id, chat_data in user_chats.items():
        chat_list.append({
            "chat_id": chat_id,
            "title": chat_data.get("title", "New Chat"),
            "updated_at": chat_data.get("updated_at", ""),
        })

    # Latest first
    chat_list.sort(key=lambda x: x["updated_at"], reverse=True)

    return jsonify({"chats": chat_list})


@app.route("/get_chat", methods=["POST"])
def get_chat():
    data = request.get_json()
    user_id = data.get("user_id")
    chat_id = data.get("chat_id")

    if not user_id or not chat_id:
        return jsonify({"messages": []})

    chat_data = histories.get(user_id, {}).get(chat_id)
    if not chat_data:
        return jsonify({"messages": []})

    # System message hata ke bhejo
    messages = [
        msg for msg in chat_data["messages"]
        if msg["role"] != "system"
    ]

    return jsonify({"messages": messages})


@app.route("/new_chat", methods=["POST"])
def new_chat():
    data = request.get_json()
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    chat_id = str(os.urandom(8).hex())

    histories[user_id][chat_id] = {
        "title": "New Chat",
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
        "updated_at": get_current_time(),
    }

    return jsonify({"chat_id": chat_id})


@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    question = data.get("question", "").strip()
    user_id = data.get("user_id")
    chat_id = data.get("chat_id")

    if not question:
        return jsonify({"answer": "Please question likho."})

    if not user_id or not chat_id:
        return jsonify({"answer": "User ID ya Chat ID missing hai."})

    if not GROQ_API_KEY:
        return jsonify({"answer": "GROQ_API_KEY set nahi hai."})

    # Create chat if not exists
    if chat_id not in histories[user_id]:
        histories[user_id][chat_id] = {
            "title": "New Chat",
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}],
            "updated_at": get_current_time(),
        }

    chat_data = histories[user_id][chat_id]
    messages = chat_data["messages"]

    messages.append({"role": "user", "content": question})

    # Auto title from first message
    if chat_data["title"] == "New Chat":
        chat_data["title"] = question[:40] + ("..." if len(question) > 40 else "")

    chat_data["updated_at"] = get_current_time()

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    try:
        response = requests.post(
            GROQ_URL,
            headers=headers,
            json=payload,
            timeout=60,
        )

        if response.status_code != 200:
            print("GROQ ERROR:", response.text)
            return jsonify({"answer": "Groq API error:\n" + response.text})

        result = response.json()
        answer = result["choices"][0]["message"]["content"]

        messages.append({"role": "assistant", "content": answer})

        return jsonify({"answer": answer})

    except Exception as error:
        print("SERVER ERROR:", error)
        return jsonify({"answer": "Server error: " + str(error)})


# ==============================
# START
# ==============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
