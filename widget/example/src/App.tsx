import { useState } from 'react';
// Import the widget straight from source so edits hot-reload here.
import { GluuChatWidget } from '../../src';

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3000');
  const [accentColor, setAccentColor] = useState('#4f8ef7');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [mounted, setMounted] = useState(true);
  // Bump to force a fresh widget instance (clears its conversation).
  const [instance, setInstance] = useState(0);

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 to-slate-100 text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
          Demo · @gluu/chat-widget
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
          Gluu Chat Widget playground
        </h1>
        <p className="mt-3 max-w-xl text-slate-600">
          This is a sample host page. The floating chat launcher in the corner is the embeddable
          widget. Use the controls below to point it at your Gluu Assistant server and tweak its
          appearance live.
        </p>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Controls</h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">Server URL (apiBaseUrl)</span>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                placeholder="http://localhost:3000"
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

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setMounted((v) => !v)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {mounted ? 'Unmount widget' : 'Mount widget'}
              </button>
              <button
                type="button"
                onClick={() => setInstance((n) => n + 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset instance
              </button>
            </div>
          </div>

          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            ⚠ Make sure the Gluu Assistant server is running (<code>npm run server</code> in the
            project root) and that you've ingested docs (<code>npm run ingest</code>), or the widget
            will report a connection error.
          </p>
        </div>

        <div className="mt-10 space-y-4 text-slate-400">
          <p>↘ Look for the chat launcher in the {position.replace('-', ' ')} corner.</p>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-dashed border-slate-200" />
          ))}
        </div>
      </div>

      {mounted && (
        <GluuChatWidget
          key={instance}
          apiBaseUrl={apiBaseUrl}
          accentColor={accentColor}
          position={position}
          defaultOpen
        />
      )}
    </div>
  );
}
