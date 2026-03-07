/**
 * vtuberAgent.js — Per-session orchestrator
 *
 * Owns the full pipeline for one connected user:
 *   STT → safety → LLM (with memory + RAG + persona) → TTS → memory write
 *
 * One VTuberAgent is created per WebSocket session and destroyed on disconnect.
 */

import { transcribeAudio } from '../voice/elevenlabs.js';
import { streamTTS } from '../voice/elevenlabs.js';
import { callClaude } from '../llm/claude.js';
import { MemoryEngine } from '../memory/memoryEngine.js';
import { RAGEngine } from '../persona/ragEngine.js';
import { buildSystemPrompt } from '../persona/promptBuilder.js';
import { checkInputSafety, checkOutputSafety } from '../safety/safetyFilter.js';
import { emotionToLive2DParams } from '../emotion/emotionParser.js';

export class VTuberAgent {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.memory = new MemoryEngine(sessionId);
    this.rag = new RAGEngine();
  }

  /**
   * transcribe — converts base64-encoded audio into text via ElevenLabs STT
   * @param {string} base64Audio  — combined base64 audio buffer from client
   * @returns {Promise<string>}   — transcript text
   */
  async transcribe(base64Audio) {
    return transcribeAudio(base64Audio);
  }

  /**
   * checkInput — safety filter for user message before LLM call
   * @param {string} text
   * @returns {Promise<{ safe: boolean, reason?: string }>}
   */
  async checkInput(text) {
    return checkInputSafety(text);
  }

  /**
   * checkOutput — safety filter for LLM response before sending to client
   * @param {string} text
   * @returns {Promise<{ safe: boolean, reason?: string }>}
   */
  async checkOutput(text) {
    return checkOutputSafety(text);
  }

  /**
   * think — core LLM call with full context injection
   *
   * Steps:
   *   1. Retrieve relevant character lore via RAG
   *   2. Get conversation history from memory
   *   3. Assemble system prompt (persona + lore + memory summary)
   *   4. Call Claude — response must be JSON: { response, emotion, intensity }
   *
   * @param {string} userText
   * @returns {Promise<{ response: string, emotion: string, intensity: number }>}
   */
  async think(userText) {
    // 1. RAG: retrieve lore snippets relevant to user's message
    const loreContext = this.rag.retrieve(userText);

    // 2. Memory: get recent conversation turns
    const history = this.memory.getHistory();

    // 3. Build system prompt with full context
    const systemPrompt = buildSystemPrompt({ loreContext, memorySummary: this.memory.getSummary() });

    // 4. Call Claude
    const result = await callClaude({ systemPrompt, history, userText });
    return result;
  }

  /**
   * speak — streams TTS audio chunks via ElevenLabs
   * @param {string} text
   * @param {(chunk: string) => void} onChunk  — called with each base64 MP3 chunk
   */
  async speak(text, onChunk) {
    await streamTTS(text, onChunk);
  }

  /**
   * emotionToParams — maps emotion label to Live2D parameter object
   * @param {string} emotion
   * @param {number} intensity  — 0.0–1.0
   * @returns {Record<string, number>}
   */
  emotionToParams(emotion, intensity) {
    return emotionToLive2DParams(emotion, intensity);
  }

  /**
   * saveMemory — persists one completed turn to session memory
   * @param {string} userText
   * @param {string} assistantText
   */
  saveMemory(userText, assistantText) {
    this.memory.addTurn(userText, assistantText);
  }

  /**
   * cleanup — called on WebSocket close; releases session resources
   */
  cleanup() {
    this.memory.clear();
  }
}
