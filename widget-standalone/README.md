# @gluu/chat-widget-standalone

A **self-contained** floating chat widget for the Gluu AI Assistant — designed to drop into a
React.js + TypeScript **browser extension** (or any React app). Unlike
[`@gluu/chat-widget`](../widget), it needs **no project server and no ChromaDB**:

- 📦 The documentation **vector index is baked into a static file** and bundled with your app.
- 🔎 **Retrieval runs in the browser** — cosine similarity over the baked vectors.
- 🤖 **Generation uses your existing Ollama** — query embedding *and* chat streaming go straight to
  Ollama's HTTP API. No cloud, no API keys.
- ⚛️ One React component — `<GluuStandaloneWidget index={...} />` — styled with Tailwind (light theme).

```
question ─▶ Ollama /api/embeddings ─▶ in-browser cosine search (baked index)
                                                │ top-K chunks
                                                ▼
                          Ollama /api/chat (stream) ─▶ answer + sources
```

The only thing running is **Ollama** — the same LLM the project already uses.

---

## 1. Build the baked index (one-time, in the project root)

After ingesting docs (`npm run ingest`), export the vectors ChromaDB already holds:

```bash
npm run export-index          # writes widget-standalone/data/gluu-index.json
```

This reads the existing `nomic-embed-text` embeddings and packs them into a single JSON file
(chunks + base64 Float32 vectors). Because the widget embeds the **query** with the same Ollama
model, the vector spaces match. Re-run it whenever you re-ingest.

> A tiny **placeholder** `data/gluu-index.sample.json` (random vectors) ships so the package and
> demo build without ChromaDB — replace it with the real export for meaningful answers.

## 2. Install the widget

```bash
# from your extension/app
npm install /absolute/path/to/gluu-asistant/widget-standalone
# (run `npm run build` in widget-standalone first if installing the built dist)
```

## 3. Use it

```tsx
import { GluuStandaloneWidget } from '@gluu/chat-widget-standalone';
import index from './gluu-index.json'; // the file from step 1, bundled with your app

export function App() {
  return (
    <GluuStandaloneWidget
      index={index}
      ollamaBaseUrl="http://localhost:11434"
      chatModel="llama3"
    />
  );
}
```

For **Next.js**, render it from a client component (the file carries `'use client'`).

## ⚠️ Two setup requirements

### Ollama must allow your origin (CORS)

The browser calls Ollama directly, so Ollama must accept your page/extension origin. Start Ollama with:

```bash
OLLAMA_ORIGINS=* ollama serve        # or set it in the Ollama app's environment
```

For a packed Chrome extension, you can scope it: `OLLAMA_ORIGINS=chrome-extension://<your-id>`.
Also make sure the models are pulled: `ollama pull nomic-embed-text && ollama pull llama3`.

### Tailwind must scan the widget files

Styling uses Tailwind utility classes, so your app's Tailwind build must include this package, or
the classes get purged:

```js
// tailwind.config.js (Tailwind v3)
content: [
  './src/**/*.{js,ts,jsx,tsx}',
  './node_modules/@gluu/chat-widget-standalone/dist/**/*.{js,cjs}',
],
```

Tailwind v4 users: add `@source '../node_modules/@gluu/chat-widget-standalone/dist';` to your CSS.
Not using Tailwind? Tell me and I can ship prebuilt CSS or a scoped-CSS variant.

## Props

| Prop            | Type                              | Default                    | Description                                            |
| --------------- | --------------------------------- | -------------------------- | ------------------------------------------------------ |
| `index`         | `BakedIndex`                      | — (**required**)           | The exported index (import the JSON and pass it).      |
| `ollamaBaseUrl` | `string`                          | `http://localhost:11434`   | Ollama HTTP API base URL.                              |
| `chatModel`     | `string`                          | `llama3`                   | Ollama chat model.                                     |
| `embedModel`    | `string`                          | the index's own model      | Override the query embed model (must match the index). |
| `title`         | `string`                          | `Gluu Assistant`           | Header + welcome title.                                |
| `subtitle`      | `string`                          | `Ask about the Gluu …`     | Small text under the title.                            |
| `accentColor`   | `string` (CSS color)              | `#4f8ef7`                  | Brand color.                                           |
| `welcomeMessage`| `string`                          | _(intro paragraph)_        | Welcome-screen text.                                   |
| `suggestions`   | `string[]`                        | 3 example prompts          | Starter prompt chips.                                  |
| `position`      | `'bottom-right' \| 'bottom-left'` | `bottom-right`             | Corner to float in.                                    |
| `topK`          | `number`                          | `5`                        | Chunks retrieved per question.                         |
| `defaultOpen`   | `boolean`                         | `false`                    | Open the panel on first render.                        |

## Try it in the browser

```bash
# from widget-standalone/
npm run demo            # installs the demo deps + starts Vite on http://localhost:5174
```

The demo renders a host page with the floating widget and live controls. Have Ollama running
(`OLLAMA_ORIGINS=* ollama serve`) to test answers end-to-end. The demo imports the widget from
source, so edits hot-reload.

## How it differs from `@gluu/chat-widget`

| | `@gluu/chat-widget` | `@gluu/chat-widget-standalone` |
|---|---|---|
| Backend | Calls the project's Express server (`/api/chat`) | None — talks to Ollama directly |
| Vector DB | ChromaDB (on the server) | Baked-in static index, searched in-browser |
| Best for | A hosted/shared deployment | Extensions & offline/self-contained apps |

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # bundle to dist/ (ESM + CJS + d.ts)
```
