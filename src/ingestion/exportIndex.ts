/**
 * Export the ingested vectors into a single static index file that the
 * self-contained browser widget (@gluu/chat-widget-standalone) can bundle.
 *
 * Run with:  npm run export-index
 *
 * It reads the documents + embeddings already stored in ChromaDB (created by
 * `npm run ingest` with Ollama's embed model) and writes them to a JSON file:
 * chunk texts/metadata plus all embedding vectors packed as a base64 Float32
 * blob (row-major, L2-normalised so cosine similarity == dot product).
 *
 * Because the query is embedded in the browser with the SAME Ollama model, the
 * vector space matches and retrieval works without ChromaDB.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getCollection, toDisplayUrl } from './vectorStore.js';
import { config } from '../config.js';

interface BakedChunk {
  text: string;
  source: string;
  title?: string;
}

interface BakedIndex {
  embedModel: string;
  dim: number;
  count: number;
  chunks: BakedChunk[];
  /** base64 of a Float32Array, row-major, count*dim, L2-normalised. */
  vectors: string;
}

const OUT = process.env.INDEX_OUT ?? 'widget-standalone/data/gluu-index.json';

async function main() {
  console.log('\n📦 Exporting baked index for the standalone widget\n');

  const col = await getCollection();
  const total = await col.count();
  if (total === 0) {
    console.error('✗ The collection is empty. Run `npm run ingest` first.');
    process.exit(1);
  }

  console.log(`  Reading ${total} vectors from ChromaDB …`);
  const res = await col.get({
    limit: total,
    include: ['embeddings', 'documents', 'metadatas'] as any,
  });

  const embeddings = (res.embeddings ?? []) as number[][];
  const documents = (res.documents ?? []) as (string | null)[];
  const metadatas = (res.metadatas ?? []) as (Record<string, unknown> | null)[];

  if (embeddings.length === 0 || !embeddings[0]) {
    console.error('✗ ChromaDB returned no embeddings. Re-run `npm run ingest`.');
    process.exit(1);
  }

  const dim = embeddings[0].length;
  const chunks: BakedChunk[] = [];
  const flat = new Float32Array(embeddings.length * dim);

  for (let i = 0; i < embeddings.length; i++) {
    const emb = embeddings[i];
    // L2-normalise so the browser can use a plain dot product for cosine.
    let norm = 0;
    for (let d = 0; d < dim; d++) norm += emb[d] * emb[d];
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dim; d++) flat[i * dim + d] = emb[d] / norm;

    const meta = metadatas[i] ?? {};
    chunks.push({
      text: documents[i] ?? '',
      source: toDisplayUrl((meta.source as string) ?? ''),
      title: (meta.title as string) || undefined,
    });
  }

  const index: BakedIndex = {
    embedModel: config.ollama.embedModel,
    dim,
    count: chunks.length,
    chunks,
    vectors: Buffer.from(flat.buffer).toString('base64'),
  };

  const json = JSON.stringify(index);
  const outPath = resolve(OUT);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);

  console.log(`\n✓ Exported ${chunks.length} chunks (dim=${dim}, model=${index.embedModel})`);
  console.log(`  → ${OUT}  (${(Buffer.byteLength(json) / 1_048_576).toFixed(2)} MB)\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
