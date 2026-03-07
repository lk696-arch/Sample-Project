/**
 * claude.js — LLM integration via Anthropic Claude
 *
 * The LLM is instructed to always return a JSON object with three fields:
 *   {
 *     "response":  string   — the VTuber's spoken reply (plain text, no markdown)
 *     "emotion":   string   — one of the VALID_EMOTIONS enum
 *     "intensity": number   — 0.0 to 1.0, controls expression strength
 *   }
 *
 * This structured output enables the avatar expression system to update
 * synchronously with the spoken response, before audio even starts playing.
 *
 * Latency notes:
 *   - Claude Sonnet 4.6 TTFT is typically 300–600ms
 *   - We parse the full response (non-streaming) so the JSON is always complete
 *   - For sub-500ms targets, swap to streaming + parse partial JSON on close bracket
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 512;  // Keep responses concise for real-time feel

// Allowed emotion values — must match emotionParser.js EMOTION_MAP keys
const VALID_EMOTIONS = ['neutral', 'happy', 'excited', 'shy', 'sad', 'surprised', 'focused', 'playful'];

/**
 * JSON envelope appended to every system prompt.
 * Forces Claude to always return parseable structured output.
 */
const JSON_FORMAT_INSTRUCTION = `
RESPONSE FORMAT — You MUST always reply with valid JSON only. No prose outside the JSON object.
{
  "response": "<your spoken reply as plain text — no markdown, no asterisks>",
  "emotion": "<one of: ${VALID_EMOTIONS.join(', ')}>",
  "intensity": <float 0.0 to 1.0 — how strongly to show the emotion>
}
`.trim();

/**
 * callClaude — sends a single conversation turn to Claude
 *
 * @param {object} params
 * @param {string} params.systemPrompt   — assembled by promptBuilder.js
 * @param {Array}  params.history        — [{ role: 'user'|'assistant', content: string }, ...]
 * @param {string} params.userText       — current user message
 *
 * @returns {Promise<{ response: string, emotion: string, intensity: number }>}
 */
export async function callClaude({ systemPrompt, history, userText }) {
  const fullSystem = `${systemPrompt}\n\n${JSON_FORMAT_INSTRUCTION}`;

  // Build messages array: history turns + current user message
  const messages = [
    ...history.map(turn => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: userText },
  ];

  let rawText;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: fullSystem,
      messages,
    });
    rawText = response.content[0]?.text ?? '';
  } catch (err) {
    console.error('[Claude] API error:', err.message);
    throw new Error(`LLM call failed: ${err.message}`);
  }

  return parseLLMResponse(rawText);
}

/**
 * parseLLMResponse — extracts and validates the JSON envelope from Claude's reply.
 *
 * Claude occasionally wraps JSON in a markdown code fence despite instructions.
 * This function handles that gracefully.
 */
function parseLLMResponse(raw) {
  // Strip optional ```json ... ``` fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: Claude returned prose — wrap it as neutral response
    console.warn('[Claude] Non-JSON response, using fallback wrapper. Raw:', raw.slice(0, 200));
    return { response: raw.trim(), emotion: 'neutral', intensity: 0.5 };
  }

  // Validate fields
  const response = typeof parsed.response === 'string' ? parsed.response.trim() : '';
  const emotion = VALID_EMOTIONS.includes(parsed.emotion) ? parsed.emotion : 'neutral';
  const intensity = typeof parsed.intensity === 'number'
    ? Math.max(0, Math.min(1, parsed.intensity))
    : 0.5;

  if (!response) {
    throw new Error('LLM returned empty response field');
  }

  return { response, emotion, intensity };
}
