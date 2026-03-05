import { useState, useRef, useEffect } from "react";
import styles from "../styles/Home.module.css";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your Oshi AI VTuber. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, history: messages }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.avatar}>🎭</div>
        <div>
          <h1 className={styles.title}>Oshi AI</h1>
          <p className={styles.subtitle}>Your AI VTuber Companion</p>
        </div>
        <span className={styles.badge}>LIVE</span>
      </header>

      <div className={styles.chatBox}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${
              msg.role === "user" ? styles.userMsg : styles.assistantMsg
            }`}
          >
            {msg.role === "assistant" && (
              <span className={styles.msgAvatar}>🎭</span>
            )}
            <div className={styles.bubble}>{msg.content}</div>
            {msg.role === "user" && (
              <span className={styles.msgAvatar}>👤</span>
            )}
          </div>
        ))}
        {loading && (
          <div className={`${styles.message} ${styles.assistantMsg}`}>
            <span className={styles.msgAvatar}>🎭</span>
            <div className={styles.bubble}>
              <span className={styles.typing}>● ● ●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className={styles.inputArea}>
        <input
          className={styles.input}
          type="text"
          placeholder="Say something to your Oshi..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button className={styles.sendBtn} type="submit" disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
