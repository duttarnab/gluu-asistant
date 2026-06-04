/**
 * Minimal Ollama HTTP client for the browser. Calls Ollama directly — no
 * project server in between. Ollama must allow the page's origin via
 * OLLAMA_ORIGINS (see the package README).
 */

const trim = (url: string) => url.replace(/\/$/, '');

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Embed a single string with an Ollama embed model (e.g. nomic-embed-text). */
export async function embedQuery(
  baseUrl: string,
  model: string,
  prompt: string,
  signal?: AbortSignal,
): Promise<number[]> {
  const res = await fetch(`${trim(baseUrl)}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt }),
    signal,
  });
  if (!res.ok) throw new Error(`Ollama /api/embeddings returned ${res.status}`);
  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding)) throw new Error('Ollama returned no embedding');
  return data.embedding;
}

/**
 * Stream a chat completion from Ollama. Ollama responds with newline-delimited
 * JSON objects; this yields the incremental `message.content` tokens.
 */
export async function* streamChat(
  baseUrl: string,
  model: string,
  messages: OllamaChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${trim(baseUrl)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Ollama /api/chat returned ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const obj = JSON.parse(trimmed) as {
        message?: { content?: string };
        done?: boolean;
        error?: string;
      };
      if (obj.error) throw new Error(obj.error);
      if (obj.message?.content) yield obj.message.content;
      if (obj.done) return;
    }
  }
}
