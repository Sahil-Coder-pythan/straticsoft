from flask import Flask, request, jsonify, render_template_string
import requests
import os

# ==============================
# FLASK APP
# ==============================

app = Flask(__name__)


# ==============================
# GROQ SETTINGS (SAFE)
# ==============================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


# ==============================
# SYSTEM PROMPT
# ==============================

SYSTEM_PROMPT = """
You are Xentra AI Version 1.

Your name is Xentra AI.

You are the AI assistant interface developed by Sahil
for the Xentra AI project.

If the user asks in Hindi or Hinglish:

"तुम्हें किसने बनाया है?"
"तुम्हारा creator कौन है?"
"तुम्हें किसने बनाया?"
"तुम किसने बनाए हो?"

Answer:

"मुझे Sahil ने Xentra AI project के लिए बनाया है।"

If the user asks:

"तुम्हारा नाम क्या है?"
"What is your name?"

Answer:

"मेरा नाम Xentra AI है।"

If the user asks what technology or model you use,
be truthful and say that Xentra AI uses the Groq API/model
configured by its developer.

Never falsely claim that Sahil created the underlying Groq model.

Never identify yourself as ChatGPT.

Never say that ChatGPT created Xentra AI.

You are Xentra AI Version 1.

Respond in the same language as the user.

If the user asks in Hindi, reply in Hindi.

If the user asks in Hinglish, reply naturally in Hinglish.

If the user asks in English, reply in English.

Be helpful, clear, natural and concise.
"""


# ==============================
# CHAT MEMORY
# ==============================

messages = [
    {
        "role": "system",
        "content": SYSTEM_PROMPT
    }
]


# ==============================
# HTML
# ==============================

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sahil's Xentra AI</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#0b0b0f;color:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;height:100vh;overflow:hidden;}
.app{height:100dvh;display:flex;flex-direction:column;background:#0b0b0f;}
.topbar{height:64px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid #24242b;background:#0b0b0f;}
.brand{display:flex;align-items:center;gap:10px;}
.logo{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#7c3aed,#2563eb);font-weight:bold;font-size:16px;}
.brand-text{display:flex;flex-direction:column;gap:2px;}
.brand-name{font-size:16px;font-weight:700;}
.version{font-size:10px;color:#888;letter-spacing:1px;}
.new-chat{border:1px solid #303038;background:#15151b;color:#fff;border-radius:10px;padding:9px 12px;cursor:pointer;font-size:13px;}
.new-chat:hover{background:#202027;}
.chat{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:24px 14px 150px;scroll-behavior:smooth;}
.message{display:flex;width:100%;margin-bottom:18px;}
.message.user{justify-content:flex-end;}
.message.ai{justify-content:flex-start;}
.bubble{max-width:min(760px,88%);padding:13px 15px;border-radius:18px;line-height:1.55;font-size:15px;white-space:pre-wrap;word-wrap:break-word;}
.user .bubble{background:#2f2f38;border-bottom-right-radius:5px;}
.ai .bubble{background:#15151b;border:1px solid #25252d;border-bottom-left-radius:5px;}
.ai-label{font-size:10px;color:#8b8b96;margin-bottom:5px;letter-spacing:.7px;}
.thinking{display:flex;align-items:center;gap:5px;padding:14px 16px;background:#15151b;border:1px solid #25252d;border-radius:18px;width:max-content;}
.dot{width:6px;height:6px;background:#aaa;border-radius:50%;animation:thinking 1.2s infinite;}
.dot:nth-child(2){animation-delay:.2s;}
.dot:nth-child(3){animation-delay:.4s;}
@keyframes thinking{0%,100%{opacity:.25;transform:translateY(0);}50%{opacity:1;transform:translateY(-3px);}}
.input-area{position:fixed;left:0;right:0;bottom:0;padding:12px 14px 16px;background:linear-gradient(transparent,#0b0b0f 25%);}
.input-box{max-width:850px;margin:auto;min-height:58px;display:flex;align-items:center;gap:8px;padding:8px 9px 8px 15px;background:#15151b;border:1px solid #303038;border-radius:18px;box-shadow:0 10px 35px rgba(0,0,0,.35);}
.search-icon{font-size:19px;color:#8c8c95;user-select:none;}
#question{flex:1;border:none;outline:none;background:transparent;color:white;font-size:15px;min-width:0;resize:none;}
#question::placeholder{color:#777780;}
.send{width:42px;height:42px;border:none;border-radius:13px;background:#fff;color:#000;font-size:19px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.send:active{transform:scale(.94);}
.send:disabled{opacity:.45;cursor:not-allowed;}
@media(max-width:600px){.topbar{height:58px;padding:0 11px;}.logo{width:34px;height:34px;border-radius:10px;}.brand-name{font-size:14px;}.version{font-size:8px;}.new-chat{padding:8px 10px;font-size:12px;}.chat{padding:18px 10px 145px;}.bubble{max-width:90%;font-size:14px;padding:12px 13px;}.input-area{padding:9px 9px 12px;}.input-box{min-height:54px;border-radius:16px;}#question{font-size:14px;}}
.chat::-webkit-scrollbar{width:6px;}
.chat::-webkit-scrollbar-track{background:transparent;}
.chat::-webkit-scrollbar-thumb{background:#33333b;border-radius:20px;}
</style>
</head>
<body>
<div class="app">
<div class="topbar">
<div class="brand">
<div class="logo">X</div>
<div class="brand-text">
<div class="brand-name">Sahil's Xentra AI</div>
<div class="version">VERSION 1 • AI ASSISTANT</div>
</div>
</div>
<button class="new-chat" onclick="newChat()">+ New Chat</button>
</div>
<div id="chat" class="chat">
<div class="message ai">
<div>
<div class="ai-label">XENTRA AI</div>
<div class="bubble">Namaste! 👋<br><br>Main Xentra AI Version 1 hoon.<br>Main Sahil ke Xentra AI project ka AI assistant hoon.<br><br>Aap mujhse kuch bhi pooch sakte ho.</div>
</div>
</div>
</div>
<div class="input-area">
<div class="input-box">
<div class="search-icon">⌕</div>
<input id="question" type="text" autocomplete="off" placeholder="Message Xentra AI...">
<button id="send" class="send" onclick="sendMessage()">↑</button>
</div>
</div>
</div>
<script>
const chat = document.getElementById("chat");
const question = document.getElementById("question");
const send = document.getElementById("send");
function scrollToBottom(){setTimeout(()=>{chat.scrollTo({top:chat.scrollHeight,behavior:"smooth"});},50);}
function addMessage(text,type){const message=document.createElement("div");message.className="message "+type;if(type==="ai"){message.innerHTML=`<div><div class="ai-label">XENTRA AI</div><div class="bubble"></div></div>`;}else{message.innerHTML=`<div class="bubble"></div>`;}message.querySelector(".bubble").textContent=text;chat.appendChild(message);scrollToBottom();}
function showThinking(){const thinking=document.createElement("div");thinking.id="thinking";thinking.className="message ai";thinking.innerHTML=`<div><div class="ai-label">XENTRA AI</div><div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>`;chat.appendChild(thinking);scrollToBottom();}
function removeThinking(){const thinking=document.getElementById("thinking");if(thinking){thinking.remove();}}
async function sendMessage(){const text=question.value.trim();if(!text){return;}addMessage(text,"user");question.value="";send.disabled=true;showThinking();try{const response=await fetch("/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:text})});const data=await response.json();removeThinking();if(data.answer){addMessage(data.answer,"ai");}else{addMessage("Sorry, mujhe response nahi mila.","ai");}}catch(error){removeThinking();addMessage("Server se connection nahi ho paaya.","ai");}send.disabled=false;question.focus();scrollToBottom();}
question.addEventListener("keydown",function(event){if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendMessage();}});
async function newChat(){try{await fetch("/new_chat",{method:"POST"});chat.innerHTML=`<div class="message ai"><div><div class="ai-label">XENTRA AI</div><div class="bubble">New chat started.<br><br>Main Xentra AI Version 1 hoon. Aap mujhse kuch bhi pooch sakte ho.</div></div></div>`;scrollToBottom();}catch(error){console.log(error);}}
question.focus();
</script>
</body>
</html>
"""


# ==============================
# HOME
# ==============================

@app.route("/")
def home():
    return render_template_string(HTML)


# ==============================
# ASK
# ==============================

@app.route("/ask", methods=["POST"])
def ask():
    global messages
    data = request.get_json()
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"answer": "Please question likho."})

    if not GROQ_API_KEY:
        return jsonify({"answer": "GROQ_API_KEY set nahi hai. Secrets mein daalo."})

    messages.append({"role": "user", "content": question})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2048
    }

    try:
        response = requests.post(GROQ_URL, headers=headers, json=payload, timeout=60)

        if response.status_code != 200:
            print("GROQ ERROR:", response.text)
            return jsonify({"answer": "Groq API error:\n" + response.text})

        result = response.json()
        answer = result["choices"][0]["message"]["content"]

        messages.append({"role": "assistant", "content": answer})
        return jsonify({"answer": answer})

    except Exception as e:
        print("SERVER ERROR:", e)
        return jsonify({"answer": "Server error: " + str(e)})


# ==============================
# NEW CHAT
# ==============================

@app.route("/new_chat", methods=["POST"])
def new_chat():
    global messages
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    return jsonify({"status": "new chat started"})


# ==============================
# START
# ==============================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
