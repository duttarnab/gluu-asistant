import { Ollama } from 'ollama';
import { config, type ChatMessage, type SearchResult } from '../config.js';
import { similaritySearch } from '../ingestion/vectorStore.js';

const SYSTEM_PROMPT = `You are an expert Gluu Identity Platform assistant.
Gluu is an open-source identity and access management (IAM) platform supporting OpenID Connect, OAuth 2.0, SAML, and FIDO.

Rules:
- Answer ONLY based on the provided documentation context below.
- If the context does not contain enough information to answer, say so clearly and suggest the user check docs.gluu.org.
- Always cite the source URL(s) at the end of your answer.
- Be concise but thorough. Use markdown formatting for code blocks and lists.
- Never make up configuration values, commands, or URLs.`;

export class GluuAssistant {
  private ollama: Ollama;
  private conversationHistory: ChatMessage[] = [];

  constructor() {
    this.ollama = new Ollama({ host: config.ollama.host });
  }

  /** Embed a query string using Ollama. */
  private async embedQuery(query: string): Promise<number[]> {
    const res = await this.ollama.embeddings({
      model: config.ollama.embedModel,
      prompt: query,
    });
    return res.embedding;
  }

  /** Retrieve top-K relevant chunks from ChromaDB. */
  async retrieve(query: string, topK = 5): Promise<SearchResult[]> {
    const embedding = await this.embedQuery(query);
    return similaritySearch(embedding, topK);
  }

  /** Format retrieved chunks into a context block for the prompt. */
  private buildContext(results: SearchResult[]): string {
    return results
      .map(
        (r, i) =>
          `[${i + 1}] Source: ${r.source}${r.title ? ` — "${r.title}"` : ''}\n${r.text}`,
      )
      .join('\n\n---\n\n');
  }

  /**
   * Ask a question. Supports multi-turn conversation.
   * Returns an async generator for streaming responses.
   */
  async *ask(
    question: string,
    topK = 5,
  ): AsyncGenerator<{ token: string; sources?: SearchResult[] }> {
    // Retrieve context
    const results = await this.retrieve(question, topK);
    const context = this.buildContext(results);

    // Build messages with conversation history
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.conversationHistory,
      {
        role: 'user',
        content: `Documentation context:\n${context}\n\nQuestion: ${question}`,
      },
    ];

    // Stream the response
    let fullResponse = '';
    const stream = await this.ollama.chat({
      model: config.ollama.chatModel,
      messages,
      stream: true,
    });

    let sourcesYielded = false;
    for await (const part of stream) {
      const token = part.message.content;
      fullResponse += token;

      // Yield sources with the first token
      if (!sourcesYielded) {
        yield { token, sources: results };
        sourcesYielded = true;
      } else {
        yield { token };
      }
    }

    // Update conversation history (keep last 6 turns to avoid context overflow)
    this.conversationHistory.push({ role: 'user', content: question });
    this.conversationHistory.push({ role: 'assistant', content: fullResponse });
    if (this.conversationHistory.length > 12) {
      this.conversationHistory = this.conversationHistory.slice(-12);
    }
  }

  /** One-shot (non-streaming) answer. */
  async askOnce(question: string, topK = 5): Promise<{ answer: string; sources: SearchResult[] }> {
    let answer = '';
    let sources: SearchResult[] = [];
    for await (const chunk of this.ask(question, topK)) {
      answer += chunk.token;
      if (chunk.sources) sources = chunk.sources;
    }
    return { answer, sources };
  }

  /** Clear conversation history. */
  resetHistory(): void {
    this.conversationHistory = [];
  }
}

