# @gluu/chat-widget

A modern, floating chat widget for the **Gluu AI Assistant**. Drop it into any
React app and it appears as a launcher button in the bottom-right corner; click it
to open a polished chat panel that streams answers (with cited sources) from your
Gluu Assistant server.

- ⚛️ Single React component — `<GluuChatWidget />`
- 🎨 Styled with **Tailwind CSS** (light/clean theme), themeable via an `accentColor` prop
- ⚡ Streaming responses over Server-Sent Events
- 🔗 Renders markdown + clickable documentation sources
- 📦 Ships ESM, CJS, and TypeScript types — only `react`/`react-dom` as peers

---

## Prerequisites

- A running **Gluu Assistant server** (`npm run server` in the main project). CORS is
  already enabled, so cross-origin requests from your app work out of the box.
- A React 17+ app that uses **Tailwind CSS** (see the styling note below).

## Install

This is a local package. From your React app:

```bash
# option A — file dependency
npm install /absolute/path/to/gluu-asistant/widget

# option B — npm link
cd /path/to/gluu-asistant/widget && npm run build && npm link
cd /path/to/your-app && npm link @gluu/chat-widget
```

> The package builds itself on `npm run build` (output in `dist/`). If you installed
> it as a file/link dependency, run that build once first.

## Usage

```tsx
import { GluuChatWidget } from '@gluu/chat-widget';

export default function App() {
  return (
    <>
      {/* ...your app... */}
      <GluuChatWidget apiBaseUrl="http://localhost:3000" />
    </>
  );
}
```

That's it — a floating button appears at the bottom-right. For **Next.js (App
Router)**, render it inside a client component (the file already carries the
`'use client'` directive, so importing it from a client tree is enough).

## ⚠️ Tailwind setup (important)

Because styling uses Tailwind utility classes, your app's Tailwind build must **scan
this package's files**, or the classes get purged and the widget renders unstyled.
Add it to your `content` globs:

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@gluu/chat-widget/dist/**/*.{js,cjs}', // 👈 add this
  ],
};
```

> If you import the widget's **source** instead of the built `dist/`, point the glob at
> `node_modules/@gluu/chat-widget/src/**/*.{ts,tsx}`.

Not using Tailwind? Tell me and I can ship a prebuilt CSS file or a scoped-CSS variant
instead.

## Props

| Prop             | Type                              | Default                       | Description                                            |
| ---------------- | --------------------------------- | ----------------------------- | ------------------------------------------------------ |
| `apiBaseUrl`     | `string`                          | `http://localhost:3000`       | Base URL of the Gluu Assistant server.                 |
| `title`          | `string`                          | `Gluu Assistant`              | Header + welcome title.                                |
| `subtitle`       | `string`                          | `Ask about the Gluu …`        | Small text under the title.                            |
| `accentColor`    | `string` (CSS color)              | `#4f8ef7`                     | Brand color for launcher, header, buttons, user bubble.|
| `welcomeMessage` | `string`                          | _(intro paragraph)_           | Text on the empty/welcome screen.                      |
| `suggestions`    | `string[]`                        | 3 example prompts             | Clickable starter prompts.                             |
| `position`       | `'bottom-right' \| 'bottom-left'` | `bottom-right`                | Which corner to float in.                              |
| `topK`           | `number`                          | `5`                           | Documentation chunks retrieved per question.           |
| `defaultOpen`    | `boolean`                         | `false`                       | Open the panel on first render.                        |

### Example

```tsx
<GluuChatWidget
  apiBaseUrl="https://assistant.example.com"
  accentColor="#16a34a"
  title="Support Bot"
  subtitle="Powered by Gluu docs"
  position="bottom-right"
  suggestions={[
    'How do I enable FIDO2?',
    'Show me the OAuth token endpoint config',
  ]}
/>
```

## How it works

The widget POSTs to `${apiBaseUrl}/api/chat` and reads the SSE stream
(`sources` → `token`… → `done`), appending tokens live. "New chat" clears the local
thread and calls `DELETE /api/history` to reset server-side context.

> **Note:** the current server keeps a single shared conversation history per process,
> so it's best suited to single-user / internal use. For multi-user deployments, the
> server would need per-session history.

## Try it in the browser

A ready-to-run Vite demo lives in [`example/`](example/). It renders a sample host page
with the floating widget and live controls for the server URL, accent color, and position.

```bash
# from widget/  — installs the demo's deps and starts the dev server
npm run demo
```

Then open <http://localhost:5173> (it opens automatically). Equivalent manual steps:

```bash
cd example
npm install
npm run dev
```

> For real answers, also run the backend: `npm run server` (and `npm run ingest` once) in
> the project root. Without it, the widget will show a connection error — which is itself a
> good way to verify error handling. The demo imports the widget from source, so edits to
> `src/` hot-reload instantly.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run build       # bundle to dist/ (ESM + CJS + d.ts)
```
