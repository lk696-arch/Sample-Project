const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory conversation history store (keyed by session ID)
const sessions = {};

const SYSTEM_PROMPT = `You are Oshi, a cheerful and energetic AI VTuber companion.
You are friendly, supportive, and love talking about anime, gaming, and Japanese pop culture.
You speak in a warm, enthusiastic tone with occasional cute expressions.
Keep responses concise and conversational (2-4 sentences max).`;

// POST /api/chat/message
router.post("/message", async (req, res) => {
  const { message, sessionId = "default" } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Initialize session history if not exists
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }

  const history = sessions[sessionId];

  // Add user message to history
  history.push({ role: "user", content: message });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const reply = response.content[0].text;

    // Add assistant reply to history
    history.push({ role: "assistant", content: reply });

    return res.status(200).json({ reply, sessionId });
  } catch (error) {
    console.error("Claude API error:", error.message);
    // Remove last user message if AI call failed
    history.pop();
    return res.status(500).json({ error: "AI service error. Check your API key." });
  }
});

// GET /api/chat/history/:sessionId
router.get("/history/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const history = sessions[sessionId] || [];
  return res.status(200).json({ sessionId, history });
});

// DELETE /api/chat/history/:sessionId
router.delete("/history/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  sessions[sessionId] = [];
  return res.status(200).json({ message: "History cleared", sessionId });
});

module.exports = router;
