'use client';

import { useEffect, useRef, useState } from 'react';
import { useGluuChat } from './useGluuChat';
import { renderMarkdown } from './markdown';
import type { ChatSource } from './types';

export interface GluuChatWidgetProps {
  /** Base URL of the Gluu Assistant server. Default: http://localhost:3000 */
  apiBaseUrl?: string;
  /** Title shown in the header and welcome screen. */
  title?: string;
  /** Small text under the title. */
  subtitle?: string;
  /** Accent / brand color (any CSS color). Used for the launcher, header, and buttons. */
  accentColor?: string;
  /** Intro paragraph on the empty/welcome screen. */
  welcomeMessage?: string;
  /** Example prompts shown as clickable chips on the welcome screen. */
  suggestions?: string[];
  /** Which corner to float in. Default: bottom-right. */
  position?: 'bottom-right' | 'bottom-left';
  /** Number of documentation chunks to retrieve per question. Default: 5 */
  topK?: number;
  /** Open the panel on first render. Default: false */
  defaultOpen?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  'How do I install Gluu Server?',
  'How do I configure OpenID Connect?',
  'What is the difference between Gluu 4 and 5?',
];

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function GluuChatWidget({
  apiBaseUrl = 'http://localhost:3000',
  title = 'Gluu Assistant',
  subtitle = 'Ask about the Gluu Identity Platform',
  accentColor = '#4f8ef7',
  welcomeMessage = 'I can answer questions about the Gluu Identity Platform using the official documentation — installation, OpenID Connect, OAuth 2.0, SAML, FIDO, and more.',
  suggestions = DEFAULT_SUGGESTIONS,
  position = 'bottom-right',
  topK = 5,
  defaultOpen = false,
}: GluuChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');

  const { messages, isStreaming, send, clear } = useGluuChat({ apiBaseUrl, topK });

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slide/fade the panel in when it opens.
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    void send(q);
  };

  const sideClasses =
    position === 'bottom-left' ? 'left-4 sm:left-6 items-start' : 'right-4 sm:right-6 items-end';
  const panelOrigin = position === 'bottom-left' ? 'origin-bottom-left' : 'origin-bottom-right';

  return (
    <div
      className={`gluu-chat-widget fixed bottom-4 z-[2147483000] flex flex-col gap-3 sm:bottom-6 ${sideClasses}`}
      style={{ fontFamily: FONT_STACK }}
    >
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className={`flex h-[600px] max-h-[calc(100dvh-6rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl ring-1 ring-black/5 transition-all duration-200 ease-out ${panelOrigin} ${
            entered ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-95 opacity-0'
          }`}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-base">
                🔐
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold leading-tight">{title}</div>
                {subtitle && (
                  <div className="truncate text-[11px] leading-tight text-white/80">{subtitle}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void clear()}
                title="New chat"
                aria-label="New chat"
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <IconNewChat />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close chat"
                className="rounded-md p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <IconClose />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-2xl text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  🔐
                </div>
                <h3 className="text-base font-semibold text-slate-800">{title}</h3>
                <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  {welcomeMessage}
                </p>
                <div className="flex w-full flex-col gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="flex justify-end">
                    <div
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3.5 py-2 text-sm text-white shadow-sm"
                      style={{ backgroundColor: accentColor }}
                    >
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex flex-col items-start gap-1.5">
                    <div
                      className={`max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm shadow-sm ring-1 ring-slate-200 ${
                        m.error ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {m.text ? renderMarkdown(m.text) : <TypingDots />}
                    </div>
                    {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
                  </div>
                ),
              )
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition focus-within:border-blue-400 focus-within:bg-white">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                placeholder="Ask about Gluu…"
                className="max-h-[120px] flex-1 resize-none bg-transparent py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => submit(input)}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: accentColor }}
              >
                <IconSend />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 active:scale-95"
        style={{ backgroundColor: accentColor }}
      >
        {open ? <IconChevronDown /> : <IconChat />}
      </button>
    </div>
  );
}

function Sources({ sources }: { sources: ChatSource[] }) {
  const seen = new Set<string>();
  const unique = sources.filter((s) => s.source && !seen.has(s.source) && seen.add(s.source));
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pl-1">
      {unique.map((s, i) => (
        <a
          key={i}
          href={s.source}
          target="_blank"
          rel="noopener noreferrer"
          title={s.source}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200 transition hover:text-blue-600 hover:ring-blue-300"
        >
          <IconLink />
          <span className="truncate">{s.title || s.source}</span>
        </a>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 py-0.5" aria-label="Assistant is typing">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

/* ── Icons (inline SVG, no dependency) ───────────────────────────────────── */

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconChat() {
  return (
    <svg {...svgProps} width={24} height={24}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg {...svgProps} width={24} height={24}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg {...svgProps} width={18} height={18}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconNewChat() {
  return (
    <svg {...svgProps} width={18} height={18}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg {...svgProps} width={18} height={18}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg {...svgProps} width={11} height={11}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}
