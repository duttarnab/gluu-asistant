import { useCallback, useMemo, useRef, useState } from 'react';
import type { BakedIndex, ChatMessage, ChatSource } from './types';
import { loadIndex, search } from './retrieval/vectorIndex';
import { embedQuery, streamChat, type OllamaChatMessage } from './ollama/client';

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

const SYSTEM_PROMPT = `You are an expert Gluu Identity Platform assistant.
Gluu is an open-source identity and access management (IAM) platform supporting OpenID Connect, OAuth 2.0, SAML, and FIDO.

Rules:
- Answer ONLY based on the provided documentation context below.
- If the context does not contain enough information to answer, say so clearly and suggest the user check docs.gluu.org.
- Always cite the source URL(s) at the end of your answer.
- Be concise but thorough. Use markdown formatting for code blocks and lists.
- Never make up configuration values, commands, or URLs.`;

export interface UseStandaloneChatOptions {
  index: BakedIndex;
  ollamaBaseUrl: string;
  /** Embed model — defaults to the index's own model (must match for retrieval). */
  embedModel?: string;
  chatModel: string;
  topK: number;
}

export interface UseStandaloneChatResult {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (question: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

/**
 * Fully client-side RAG: embed the query with Ollama → cosine-search the baked
 * index in-browser → stream the answer from Ollama's chat endpoint. No server.
 */
export function useStandaloneChat({
  index,
  ollamaBaseUrl,
  embedModel,
  chatModel,
  topK,
}: UseStandaloneChatOptions): UseStandaloneChatResult {
  const loaded = useMemo(() => loadIndex(index), [index]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<OllamaChatMessage[]>([]);

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

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text: question },
        { id: nextId(), role: 'assistant', text: '' },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';

      try {
        // 1. Embed the query with the same model the index was built with.
        const queryEmbedding = await embedQuery(
          ollamaBaseUrl,
          embedModel ?? loaded.embedModel,
          question,
          controller.signal,
        );

        // 2. Retrieve top-K chunks in-browser.
        const hits = search(loaded, queryEmbedding, topK);
        const sources: ChatSource[] = hits.map((h) => ({
          source: h.source,
          title: h.title,
          score: h.score,
        }));
        patchLast({ sources });

        const context = hits
          .map(
            (h, i) =>
              `[${i + 1}] Source: ${h.source}${h.title ? ` — "${h.title}"` : ''}\n${h.text}`,
          )
          .join('\n\n---\n\n');

        // 3. Stream the answer from Ollama.
        const chatMessages: OllamaChatMessage[] = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...historyRef.current,
          { role: 'user', content: `Documentation context:\n${context}\n\nQuestion: ${question}` },
        ];

        for await (const token of streamChat(
          ollamaBaseUrl,
          chatModel,
          chatMessages,
          controller.signal,
        )) {
          acc += token;
          patchLast({ text: acc });
        }

        if (!acc) patchLast({ text: 'No response was returned.' });

        historyRef.current.push(
          { role: 'user', content: question },
          { role: 'assistant', content: acc },
        );
        if (historyRef.current.length > 12) {
          historyRef.current = historyRef.current.slice(-12);
        }
      } catch (err) {
        const e = err as Error;
        if (e.name === 'AbortError') {
          patchLast({ text: acc || '_(stopped)_' });
        } else {
          patchLast({
            text: `Sorry — ${e.message}. Is Ollama running and is this origin allowed via OLLAMA_ORIGINS?`,
            error: true,
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, loaded, ollamaBaseUrl, embedModel, chatModel, topK, patchLast],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    historyRef.current = [];
    setMessages([]);
  }, []);

  return { messages, isStreaming, send, stop, clear };
}
