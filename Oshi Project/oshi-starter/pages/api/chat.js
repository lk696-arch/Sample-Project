export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Build conversation history for context
  const conversationHistory = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: `You are Oshi, a cheerful and energetic AI VTuber companion.
You are friendly, supportive, and love talking about anime, gaming, and Japanese pop culture.
You speak in a warm, enthusiastic tone with occasional cute expressions.
Keep responses concise and conversational (2-4 sentences max).`,
        messages: [
          ...conversationHistory,
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Claude API error:", error);
      return res.status(500).json({ error: "AI service error" });
    }

    const data = await response.json();
    const reply = data.content[0].text;

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
