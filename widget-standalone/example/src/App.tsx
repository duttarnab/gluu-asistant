import { useState } from 'react';
// Import the widget straight from source so edits hot-reload here.
import { GluuStandaloneWidget } from '../../src';
import type { BakedIndex } from '../../src';
// The baked index. Replace the sample with your real `npm run export-index` output.
import sampleIndex from '../../data/gluu-index.sample.json';

const index = sampleIndex as BakedIndex;

export default function App() {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [chatModel, setChatModel] = useState('llama3');
  const [accentColor, setAccentColor] = useState('#4f8ef7');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [instance, setInstance] = useState(0);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          Demo · @gluu/chat-widget-standalone
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
          Self-contained Gluu widget
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          No project server and no ChromaDB — the vector index is baked into the bundle, retrieval
          runs in your browser, and answers stream from your local Ollama. The floating launcher in
          the corner is the embeddable widget.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Controls</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Ollama URL</span>
              <input
                type="text"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Chat model</span>
              <input
                type="text"
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Accent color</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Position</span>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="bottom-right">bottom-right</option>
                <option value="bottom-left">bottom-left</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setInstance((n) => n + 1)}
            className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset conversation
          </button>

          <div className="mt-5 space-y-2">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              ⚠ Ollama must allow this page's origin. Start it with{' '}
              <code>OLLAMA_ORIGINS=* ollama serve</code> (or set your extension/site origin), and
              make sure the chat + embed models are pulled.
            </p>
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">
              This demo ships a tiny <strong>placeholder</strong> index ({index.count} chunks with
              random vectors), so retrieval is not meaningful. Run{' '}
              <code>npm run export-index</code> in the project root to generate the real index.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-4 text-slate-400">
          <p>↘ Look for the chat launcher in the {position.replace('-', ' ')} corner.</p>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-dashed border-slate-200" />
          ))}
        </div>
      </div>

      <GluuStandaloneWidget
        key={instance}
        index={index}
        ollamaBaseUrl={ollamaBaseUrl}
        chatModel={chatModel}
        accentColor={accentColor}
        position={position}
        defaultOpen
      />
    </div>
  );
}
