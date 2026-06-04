# Gluu AI Assistant

A local, privacy-friendly **RAG** (retrieval-augmented generation) assistant for the
[Gluu Identity Platform](https://gluu.org) documentation. It crawls the Gluu docs and
GitHub repos, embeds them into a vector store, and answers questions using a local
[Ollama](https://ollama.com) model — citing its sources.

```
┌──────────┐   scrape    ┌─────────┐   embed    ┌──────────┐
│  docs +  │ ──────────▶ │ chunker │ ─────────▶ │ ChromaDB │
│  GitHub  │             └─────────┘   (Ollama) └────┬─────┘
└──────────┘                                         │ similarity search
                                                      ▼
                          ┌──────────┐   prompt   ┌──────────┐
              question ──▶│ assistant│ ─────────▶ │  Ollama  │──▶ streamed answer + sources
                          └──────────┘            └──────────┘
```

## Prerequisites

- **Node.js 18+** (uses the global `fetch`; developed on Node 24)
- **[Ollama](https://ollama.com)** running locally, with the models pulled:
  ```bash
  ollama pull nomic-embed-text   # embeddings
  ollama pull llama3             # chat
  ```
- **Docker** (for ChromaDB)

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start ChromaDB** (vector store). It persists to `./gluu_db` on the host:
   ```bash
   docker run -d \
     --name chromadb \
     -p 8000:8000 \
     -v $(pwd)/gluu_db:/chroma/chroma \
     chromadb/chroma:latest
   ```

3. **Configure** — copy/adjust `.env` (defaults usually work):
   ```ini
   OLLAMA_HOST=http://localhost:11434
   EMBED_MODEL=nomic-embed-text
   CHAT_MODEL=llama3
   CHROMA_PATH=http://localhost:8000   # the Chroma HTTP API URL, not the ./gluu_db volume path
   CHROMA_COLLECTION=gluu_docs
   CHUNK_SIZE=500
   CHUNK_OVERLAP=50
   PORT=3000
   ```


## Usage

| Command           | What it does                                                    |
| ----------------- | --------------------------------------------------------------- |
| `npm run ingest`  | Crawl docs + GitHub, embed, and store vectors in ChromaDB.      |
| `npm run chat`    | Interactive terminal chat (`/reset`, `/stats`, `/exit`).        |
| `npm run server`  | Start the web UI + REST/SSE API at `http://localhost:3000`.     |
| `npm run dev`     | Same as `server`, with auto-reload on file changes.             |
| `npm run build`   | Type-check and compile to `dist/`.                              |
| `npm run typecheck` | Type-check only, no emit.                                     |

**First run:** start Ollama and ChromaDB, then `npm run ingest` (this can take a while),
then `npm run chat` or `npm run server`.

## API

The server (`npm run server`) exposes:

| Method   | Path              | Description                                   |
| -------- | ----------------- | --------------------------------------------- |
| `POST`   | `/api/chat`       | Streaming chat (Server-Sent Events).          |
| `POST`   | `/api/chat/once`  | One-shot JSON `{ answer, sources }`.          |
| `GET`    | `/api/stats`      | Collection size + active models.              |
| `DELETE` | `/api/history`    | Clear server-side conversation history.       |
| `GET`    | `/`               | Web UI.                                        |

Request body for chat endpoints: `{ "question": string, "topK"?: number }`.

## Project structure

```
src/
  config.ts              # env-driven config + shared types
  ingestion/
    scraper.ts           # web crawler + GitHub markdown fetcher
    chunker.ts           # text cleaning + overlapping chunking
    vectorStore.ts       # ChromaDB client wrapper
    ingest.ts            # pipeline entry point (npm run ingest)
  assistant/
    assistant.ts         # RAG: retrieve → prompt → stream from Ollama
    cli.ts               # terminal REPL (npm run chat)
  ui/
    server.ts            # Express REST/SSE server (npm run server)
    index.html           # single-file web UI

widget/                  # @gluu/chat-widget — embeddable React chat widget (see widget/README.md)
```

## Embeddable widget

[`widget/`](widget/) contains **`@gluu/chat-widget`**, a floating React chat component
you can drop into any React app. It talks to this server's `/api/chat` SSE endpoint
(CORS is already enabled) and renders a launcher in the bottom-right corner:

```tsx
import { GluuChatWidget } from '@gluu/chat-widget';

<GluuChatWidget apiBaseUrl="http://localhost:3000" />
```

See [widget/README.md](widget/README.md) for install, Tailwind setup, and props.

## Notes & limitations

- The web server keeps **one shared conversation history** for the whole process, so it's
  intended for single-user/local use. For multi-user deployments, key history by session.
- Chunks that exceed the embedding model's context window are skipped during ingestion (logged).
- Answers are constrained to retrieved documentation; if context is insufficient the
  assistant says so and points to `docs.gluu.org`.
