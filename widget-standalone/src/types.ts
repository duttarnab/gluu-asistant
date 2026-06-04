/** A documentation source cited by the assistant. */
export interface ChatSource {
  source: string;
  title?: string;
  score?: number;
}

/** A single message in the conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
  error?: boolean;
}

/** A chunk of documentation in the baked index. */
export interface BakedChunk {
  text: string;
  source: string;
  title?: string;
}

/**
 * The static index produced by `npm run export-index` in the main project.
 * `vectors` is base64 of a Float32Array (row-major, count*dim, L2-normalised),
 * embedded with `embedModel` so an in-browser query embedded by the same model
 * can be matched with a plain dot product.
 */
export interface BakedIndex {
  embedModel: string;
  dim: number;
  count: number;
  chunks: BakedChunk[];
  vectors: string;
}
