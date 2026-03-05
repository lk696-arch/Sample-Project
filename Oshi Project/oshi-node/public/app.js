const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

// Generate a session ID for this browser tab
const sessionId = "session_" + Math.random().toString(36).slice(2, 10);

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function appendMessage(role, content) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role === "user" ? "user-msg" : "assistant-msg"}`;

  const avatar = document.createElement("span");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "👤" : "🎭";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = content;

  if (role === "user") {
    msgDiv.appendChild(bubble);
    msgDiv.appendChild(avatar);
  } else {
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
  }

  chatBox.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv;
}

function showTyping() {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message assistant-msg";
  msgDiv.id = "typingIndicator";

  const avatar = document.createElement("span");
  avatar.className = "msg-avatar";
  avatar.textContent = "🎭";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = '<span class="typing">● ● ●</span>';

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  chatBox.appendChild(msgDiv);
  scrollToBottom();
}

function removeTyping() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) indicator.remove();
}

function setLoading(loading) {
  messageInput.disabled = loading;
  sendBtn.disabled = loading;
  sendBtn.textContent = loading ? "..." : "Send";
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  messageInput.value = "";
  setLoading(true);
  showTyping();

  try {
    const res = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });

    const data = await res.json();
    removeTyping();

    if (res.ok) {
      appendMessage("assistant", data.reply);
    } else {
      appendMessage("assistant", `Error: ${data.error || "Something went wrong."}`);
    }
  } catch {
    removeTyping();
    appendMessage("assistant", "Sorry, could not reach the server. Please try again.");
  } finally {
    setLoading(false);
    messageInput.focus();
  }
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear conversation history?")) return;

  try {
    await fetch(`/api/chat/history/${sessionId}`, { method: "DELETE" });
  } catch {
    // ignore errors, just clear UI
  }

  // Clear chat UI (keep welcome message)
  chatBox.innerHTML = `
    <div class="message assistant-msg">
      <span class="msg-avatar">🎭</span>
      <div class="bubble">Hi! I'm your Oshi AI VTuber. How can I help you today?</div>
    </div>
  `;
});

// Allow pressing Enter to submit
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event("submit"));
  }
});
