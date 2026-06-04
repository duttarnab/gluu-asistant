import type { BakedChunk, BakedIndex } from '../types';

export interface LoadedIndex {
  embedModel: string;
  dim: number;
  chunks: BakedChunk[];
  /** Row-major, L2-normalised embedding matrix. */
  matrix: Float32Array;
}

/** Decode a base64 string into a Float32Array (browser-safe, no Buffer). */
function base64ToFloat32(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

/** Parse a baked index into a form ready for similarity search. */
export function loadIndex(index: BakedIndex): LoadedIndex {
  const matrix = base64ToFloat32(index.vectors);
  const expected = index.count * index.dim;
  if (matrix.length !== expected) {
    throw new Error(
      `Baked index is corrupt: expected ${expected} floats, got ${matrix.length}.`,
    );
  }
  return { embedModel: index.embedModel, dim: index.dim, chunks: index.chunks, matrix };
}

function normalize(vec: number[]): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export interface SearchHit extends BakedChunk {
  score: number;
}

/**
 * Cosine similarity search. Index vectors are pre-normalised at export time,
 * so similarity reduces to a dot product once the query is normalised.
 */
export function search(index: LoadedIndex, queryEmbedding: number[], topK: number): SearchHit[] {
  if (queryEmbedding.length !== index.dim) {
    throw new Error(
      `Query embedding has ${queryEmbedding.length} dims but the index expects ${index.dim}. ` +
        `Make sure the widget's embed model matches the index ("${index.embedModel}").`,
    );
  }
  const q = normalize(queryEmbedding);
  const { dim, matrix, chunks } = index;

  const scored = chunks.map((_, i) => {
    let dot = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) dot += matrix[base + d] * q[d];
    return { i, score: dot };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(({ i, score }) => ({ ...chunks[i], score }));
}
