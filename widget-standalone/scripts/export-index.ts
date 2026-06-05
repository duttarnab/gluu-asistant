/**
 * Export the ingested Gluu vectors into the static index this widget bundles.
 *
 * Run from the project root:  npm run export-index
 * Or from this package:        npm run export-index
 *
 * It connects to the ChromaDB populated by the main project's `npm run ingest`,
 * reads the documents + their Ollama embeddings, and writes them to
 * widget-standalone/data/gluu-index.json — chunk text/metadata plus all vectors
 * packed as a base64 Float32 blob (row-major, L2-normalised so cosine == dot).
 *
 * This script is self-contained (only chromadb + dotenv) so the package owns
 * its index-generation tooling. Config comes from env vars (or the project
 * root's .env), with sensible defaults.
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChromaClient } from 'chromadb';

const rawChroma = process.env.CHROMA_PATH ?? 'http://localhost:8000';
const CHROMA_PATH = /^https?:\/\//i.test(rawChroma) ? rawChroma : 'http://localhost:8000';
const COLLECTION = process.env.CHROMA_COLLECTION ?? 'gluu_docs';
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'nomic-embed-text';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.INDEX_OUT ?? resolve(__dirname, '../data/gluu-index.json');

interface BakedChunk {
  text: string;
  source: string;
  title?: string;
}

/**
 * Turn a raw GitHub markdown URL into its rendered "blob" page so sources open
 * as HTML. Non-GitHub URLs are returned unchanged. (Kept in sync with the main
 * project's vectorStore.toDisplayUrl.)
 */
function toDisplayUrl(url: string): string {
  const m = url.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
  );
  if (m) {
    const [, owner, repo, branch, path] = m;
    return `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  }
  return url;
}

async function main() {
  console.log('\n📦 Exporting baked index for @gluu/chat-widget-standalone\n');
  console.log(`  ChromaDB   : ${CHROMA_PATH}`);
  console.log(`  Collection : ${COLLECTION}`);
  console.log(`  Embed model: ${EMBED_MODEL}\n`);

  const client = new ChromaClient({ path: CHROMA_PATH });
  const col = await client.getOrCreateCollection({
    name: COLLECTION,
    metadata: { 'hnsw:space': 'cosine' },
  });

  const total = await col.count();
  if (total === 0) {
    console.error('✗ The collection is empty. Run `npm run ingest` in the project root first.');
    process.exit(1);
  }

  console.log(`  Reading ${total} vectors …`);
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

  const index = {
    embedModel: EMBED_MODEL,
    dim,
    count: chunks.length,
    chunks,
    vectors: Buffer.from(flat.buffer).toString('base64'),
  };

  const json = JSON.stringify(index);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);

  console.log(`\n✓ Exported ${chunks.length} chunks (dim=${dim}, model=${EMBED_MODEL})`);
  console.log(`  → ${OUT}  (${(Buffer.byteLength(json) / 1_048_576).toFixed(2)} MB)\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
