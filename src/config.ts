import 'dotenv/config';

/** Chroma JS client talks to the server over HTTP; this is not the Docker host data directory. */
function chromaServerBaseUrl(): string {
  const raw = process.env.CHROMA_PATH ?? 'http://localhost:8000';
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      `CHROMA_PATH must be the Chroma HTTP API URL (e.g. http://localhost:8000). Got "${raw}". ` +
        'The ./gluu_db path in the README is only for docker -v persistence on the host.',
    );
  }
  return raw;
}

export const config = {
  ollama: {
    host: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    embedModel: process.env.EMBED_MODEL ?? 'nomic-embed-text',
    chatModel: process.env.CHAT_MODEL ?? 'llama3',
  },
  chroma: {
    path: chromaServerBaseUrl(),
    collection: process.env.CHROMA_COLLECTION ?? 'gluu_docs',
  },
  ingestion: {
    chunkSize: parseInt(process.env.CHUNK_SIZE ?? '500'),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP ?? '50'),
  },
  server: {
    port: parseInt(process.env.PORT ?? '3000'),
  },
};

export interface DocChunk {
  id: string;
  text: string;
  source: string;
  title?: string;
  type: 'web' | 'github';
}

export interface SearchResult {
  text: string;
  source: string;
  title?: string;
  score: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
