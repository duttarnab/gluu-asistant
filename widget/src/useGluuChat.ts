import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, ChatSource } from './types';

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

export interface UseGluuChatOptions {
  apiBaseUrl: string;
  topK: number;
}

export interface UseGluuChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (question: string) => Promise<void>;
  stop: () => void;
  clear: () => Promise<void>;
}

/**
 * Streams answers from the Gluu Assistant server's `/api/chat` Server-Sent
 * Events endpoint, appending tokens to the latest assistant message as they
 * arrive. Mirrors the protocol used by the standalone web UI.
 */
export function useGluuChat({ apiBaseUrl, topK }: UseGluuChatOptions): UseGluuChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patchLast = useCallback((patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = prev.slice();
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...patch };
      return copy;
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || isStreaming) return;

      const userMsg: ChatMessage = { id: nextId(), role: 'user', text: question };
      const aiMsg: ChatMessage = { id: nextId(), role: 'assistant', text: '' };
      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';

      try {
        const res = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, topK }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Server responded with ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const segments = buffer.split('\n');
          buffer = segments.pop() ?? '';

          for (const segment of segments) {
            const line = segment.trim();
            if (!line.startsWith('data:')) continue;
            const payload = JSON.parse(line.slice(5).trim()) as {
              type: string;
              token?: string;
              sources?: ChatSource[];
              message?: string;
            };

            if (payload.type === 'sources') {
              patchLast({ sources: payload.sources });
            } else if (payload.type === 'token') {
              acc += payload.token ?? '';
              patchLast({ text: acc });
            } else if (payload.type === 'error') {
              throw new Error(payload.message || 'Stream error');
            }
          }
        }

        if (!acc) patchLast({ text: 'No response was returned.' });
      } catch (err) {
        const e = err as Error;
        if (e.name === 'AbortError') {
          patchLast({ text: acc || '_(stopped)_' });
        } else {
          patchLast({
            text: `Sorry — I couldn't reach the assistant (${e.message}). Is the server running?`,
            error: true,
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [apiBaseUrl, topK, isStreaming, patchLast],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(async () => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/history`, { method: 'DELETE' });
    } catch {
      /* best-effort: clearing the local view is what matters */
    }
  }, [apiBaseUrl]);

  return { messages, isStreaming, send, stop, clear };
}
