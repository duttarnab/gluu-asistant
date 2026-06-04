/**
 * REST + SSE API server  —  npm run server
 *
 * Endpoints:
 *   POST /api/chat          — streaming chat via Server-Sent Events
 *   POST /api/chat/once     — one-shot JSON response
 *   GET  /api/stats         — DB stats
 *   DELETE /api/history     — clear conversation history (process-wide; single-user)
 *   GET  /                  — serves the web UI
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GluuAssistant } from '../assistant/assistant.js';
import { collectionStats } from '../ingestion/vectorStore.js';
import { config } from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// One assistant instance per server (stateful conversation)
const assistant = new GluuAssistant();

// ── Streaming chat via SSE ────────────────────────────────────────────────────
app.post('/api/chat', async (req: Request, res: Response) => {
  const { question, topK = 5 } = req.body as { question?: string; topK?: number };

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of assistant.ask(question, topK)) {
      if (chunk.sources) {
        res.write(
          `data: ${JSON.stringify({ type: 'sources', sources: chunk.sources })}\n\n`,
        );
      }
      res.write(`data: ${JSON.stringify({ type: 'token', token: chunk.token })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    res.write(
      `data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`,
    );
  } finally {
    res.end();
  }
});

// ── One-shot JSON chat ────────────────────────────────────────────────────────
app.post('/api/chat/once', async (req: Request, res: Response) => {
  const { question, topK = 5 } = req.body as { question?: string; topK?: number };

  if (!question?.trim()) {
    res.status(400).json({ error: 'question is required' });
    return;
  }

  try {
    const result = await assistant.askOnce(question, topK);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Stats ─────────────────────────────────────────────────────────────────────
app.get('/api/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await collectionStats();
    res.json({ ...stats, model: config.ollama.chatModel, embedModel: config.ollama.embedModel });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Clear history ─────────────────────────────────────────────────────────────
app.delete('/api/history', (_req: Request, res: Response) => {
  assistant.resetHistory();
  res.json({ ok: true });
});

// ── Web UI (served from src/ui/index.html) ────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  const htmlPath = join(__dirname, 'index.html');
  try {
    const html = readFileSync(htmlPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch {
    res.send('<h1>Gluu Assistant API is running.</h1><p>Place index.html in src/ui/ for the web UI.</p>');
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.server.port, () => {
  console.log(`\n🚀 Gluu Assistant server running at http://localhost:${config.server.port}`);
  console.log(`   Model  : ${config.ollama.chatModel}`);
  console.log(`   Embed  : ${config.ollama.embedModel}\n`);
});
