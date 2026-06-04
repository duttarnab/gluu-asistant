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
