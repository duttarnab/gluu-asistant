import { config } from '../config.js';

// nomic-embed-text supports ~8192 tokens (~4 chars/token = ~32 000 chars max).
// We use a 6 000-char hard ceiling to stay comfortably under even with dense text.
const MAX_CHARS = 6_000;

/**
 * Split a single long string into fixed-size character slices with overlap.
 * Used as a fallback when a paragraph exceeds the effective chunk size.
 */
function splitByChars(text: string, size: number, overlap: number): string[] {
  const result: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    result.push(text.slice(start, end));
    if (end === text.length) break;
    start += size - overlap;
  }
  return result;
}

/** Hard-truncate any chunk that still exceeds MAX_CHARS. */
function truncateChunks(chunks: string[]): string[] {
  return chunks.map((c) => (c.length > MAX_CHARS ? c.slice(0, MAX_CHARS) : c));
}

/**
 * Split text into overlapping chunks suitable for embedding.
 * Guarantees no chunk exceeds MAX_CHARS characters.
 */
export function chunkText(
  text: string,
  chunkSize = config.ingestion.chunkSize,
  overlap = config.ingestion.chunkOverlap,
): string[] {
  const effectiveSize = Math.min(chunkSize, MAX_CHARS);
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // A single paragraph longer than the limit: flush current, split paragraph directly
    if (trimmed.length > effectiveSize) {
      if (current.trim()) {
        chunks.push(...truncateChunks(splitByChars(current.trim(), effectiveSize, overlap)));
        current = '';
      }
      chunks.push(...truncateChunks(splitByChars(trimmed, effectiveSize, overlap)));
      continue;
    }

    if ((current + '\n\n' + trimmed).length > effectiveSize && current.length > 0) {
      chunks.push(current.trim());
      // Carry overlap from previous chunk into next
      current = current.slice(-overlap) + '\n\n' + trimmed;
    } else {
      current = current ? current + '\n\n' + trimmed : trimmed;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return truncateChunks(chunks.filter((c) => c.length > 50));
}

/**
 * Sanitise raw HTML/markdown text for storage.
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}