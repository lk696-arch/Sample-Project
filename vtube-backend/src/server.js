/**
 * server.js — AI VTuber POC Entry Point
 *
 * Architecture:
 *   HTTP (Express) ─── serves health check + REST endpoints
 *   WebSocket (ws)  ─── real-time bidirectional audio/event bus
 *
 * WebSocket message protocol (all JSON):
 *   Client → Server:
 *     { type: "audio_chunk",   data: "<base64 PCM>" }
 *     { type: "audio_end" }                             ← signals end of utterance
 *     { type: "text_input",    text: "..." }            ← text-mode fallback
 *     { type: "ping" }
 *
 *   Server → Client:
 *     { type: "transcript",    text: "...", final: true }
 *     { type: "llm_response",  text: "...", emotion: "happy", intensity: 0.8 }
 *     { type: "expression",    params: { ParamEyeSmile: 1.0, ... } }
 *     { type: "audio_chunk",   data: "<base64 MP3>" }
 *     { type: "audio_end" }
 *     { type: "error",         message: "...", code: "SAFETY_BLOCK" }
 *     { type: "pong" }
 */

import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { VTuberAgent } from './agents/vtuberAgent.js';

// ─── Express setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5500').split(','),
  methods: ['GET', 'POST'],
}));

// Health check — used by Vercel / Railway uptime monitors
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── HTTP server (shared with WebSocket) ───────────────────────────────────────
const server = createServer(app);

// ─── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// Active sessions: Map<sessionId, { ws, agent, audioBuffer }>
const sessions = new Map();

wss.on('connection', (ws, req) => {
  const sessionId = uuidv4();
  const agent = new VTuberAgent(sessionId);
  const audioBuffer = [];  // accumulates raw base64 chunks until audio_end

  sessions.set(sessionId, { ws, agent, audioBuffer });

  console.log(`[WS] Session connected: ${sessionId}  (${sessions.size} active)`);

  // Helper: send a typed message safely
  function send(payload) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send({ type: 'error', message: 'Invalid JSON', code: 'PARSE_ERROR' });
    }

    switch (msg.type) {

      // ── Audio chunk accumulation ──────────────────────────────────────────────
      case 'audio_chunk':
        if (msg.data) audioBuffer.push(msg.data);
        break;

      // ── End of user utterance — run full pipeline ─────────────────────────────
      case 'audio_end': {
        const combinedBase64 = audioBuffer.splice(0).join('');
        if (!combinedBase64) break;

        try {
          // Transcribe via ElevenLabs STT
          const transcript = await agent.transcribe(combinedBase64);
          send({ type: 'transcript', text: transcript, final: true });

          // Run LLM + TTS pipeline
          await runPipeline(agent, transcript, send);
        } catch (err) {
          console.error(`[Session ${sessionId}] Pipeline error:`, err.message);
          send({ type: 'error', message: err.message, code: err.code || 'PIPELINE_ERROR' });
        }
        break;
      }

      // ── Text input mode (no mic / testing) ───────────────────────────────────
      case 'text_input': {
        if (!msg.text?.trim()) break;
        send({ type: 'transcript', text: msg.text, final: true });

        try {
          await runPipeline(agent, msg.text.trim(), send);
        } catch (err) {
          console.error(`[Session ${sessionId}] Pipeline error:`, err.message);
          send({ type: 'error', message: err.message, code: err.code || 'PIPELINE_ERROR' });
        }
        break;
      }

      case 'ping':
        send({ type: 'pong' });
        break;

      default:
        send({ type: 'error', message: `Unknown message type: ${msg.type}`, code: 'UNKNOWN_TYPE' });
    }
  });

  ws.on('close', () => {
    agent.cleanup();
    sessions.delete(sessionId);
    console.log(`[WS] Session closed: ${sessionId}  (${sessions.size} active)`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Session ${sessionId} error:`, err.message);
  });

  // Send session ID to client so it can display/debug it
  send({ type: 'connected', sessionId });
});

/**
 * runPipeline — the core per-turn flow:
 *   text → safety check → LLM (with memory + RAG + persona) →
 *   emotion → avatar params → TTS streaming → memory save
 */
async function runPipeline(agent, userText, send) {
  // 1. Safety filter on input
  const inputCheck = await agent.checkInput(userText);
  if (!inputCheck.safe) {
    const err = new Error(inputCheck.reason);
    err.code = 'SAFETY_BLOCK';
    throw err;
  }

  // 2. LLM call — returns { response, emotion, intensity }
  const llmResult = await agent.think(userText);

  // 3. Safety filter on output
  const outputCheck = await agent.checkOutput(llmResult.response);
  if (!outputCheck.safe) {
    const err = new Error('Response blocked by safety filter');
    err.code = 'SAFETY_BLOCK';
    throw err;
  }

  // 4. Parse emotion → Live2D expression parameters
  const expressionParams = agent.emotionToParams(llmResult.emotion, llmResult.intensity);

  // 5. Send LLM response + expression update to client
  send({
    type: 'llm_response',
    text: llmResult.response,
    emotion: llmResult.emotion,
    intensity: llmResult.intensity,
  });
  send({ type: 'expression', params: expressionParams });

  // 6. TTS streaming — audio chunks sent as they arrive
  await agent.speak(llmResult.response, (audioChunk) => {
    send({ type: 'audio_chunk', data: audioChunk });
  });
  send({ type: 'audio_end' });

  // 7. Persist this turn to memory
  agent.saveMemory(userText, llmResult.response);
}

// ─── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
server.listen(PORT, () => {
  console.log(`[Server] AI VTuber backend running on port ${PORT}`);
  console.log(`[Server] WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`[Server] Health check:       http://localhost:${PORT}/health`);
});
