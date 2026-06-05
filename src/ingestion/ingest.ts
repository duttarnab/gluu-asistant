/**
 * Gluu Documentation Ingestion Pipeline
 *
 * Run with:  npm run ingest
 *
 * What it does:
 *  1. Crawls docs.gluu.org (web scraping)
 *  2. Fetches markdown files from GluuFederation GitHub repos
 *  3. Splits text into overlapping chunks
 *  4. Embeds each chunk with Ollama (nomic-embed-text)
 *  5. Stores vectors in ChromaDB for later retrieval
 */

import { createHash } from 'node:crypto';
import { Ollama } from 'ollama';
import { config, type DocChunk } from '../config.js';
import { chunkText } from './chunker.js';
import { crawlSite, fetchGithubRepo } from './scraper.js';
import { addDocuments, collectionStats, getCollection } from './vectorStore.js';

// ─── Sources configuration ────────────────────────────────────────────────────

const WEB_SOURCES = [
  { url: 'https://gluu.org/docs/', maxPages: 1000 },
];

const GITHUB_SOURCES = [
  { owner: 'GluuFederation', repo: 'flex', branch: 'main', subPath: 'docs' },
  { owner: 'JanssenProject', repo: 'jans', branch: 'main', subPath: 'docs' }
];

// ─── Main ─────────────────────────────────────────────────────────────────────

/** Stable, collision-resistant ID: prefix + SHA-256(url) truncated to 16 hex chars + chunk index. */
function makeId(prefix: 'web' | 'gh', url: string, index: number): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return `${prefix}-${hash}-${index}`;
}

async function main() {
  console.log('\n🚀 Gluu Documentation Ingestion Pipeline\n');
  console.log(`  Embed model : ${config.ollama.embedModel}`);
  console.log(`  ChromaDB    : ${config.chroma.path}`);
  console.log(`  Collection  : ${config.chroma.collection}\n`);

  const ollama = new Ollama({ host: config.ollama.host });

  // Verify Ollama is running
  try {
    await ollama.list();
    console.log('✓ Ollama is reachable\n');
  } catch {
    console.error('✗ Cannot connect to Ollama. Is it running? (ollama serve)');
    process.exit(1);
  }

  // Reset collection for a fresh ingest
  await getCollection(true);
  console.log('✓ ChromaDB collection ready (reset)\n');

  const allChunks: DocChunk[] = [];

  // ── Web scraping ─────────────────────────────────────────────────────────
  for (const source of WEB_SOURCES) {
    console.log(`📄 Crawling: ${source.url}`);
    const pages = await crawlSite(source.url, source.maxPages);
    console.log(`   → ${pages.length} pages scraped\n`);

    for (const page of pages) {
      const chunks = chunkText(page.text);
      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          id: makeId('web', page.url, i),
          text: chunks[i],
          source: page.url,
          title: page.title,
          type: 'web',
        });
      }
    }
  }

  // ── GitHub repos ──────────────────────────────────────────────────────────
  for (const source of GITHUB_SOURCES) {
    console.log(`\n📂 GitHub: ${source.owner}/${source.repo}`);
    const pages = await fetchGithubRepo(source.owner, source.repo, source.branch, source.subPath);
    console.log(`   → ${pages.length} files fetched\n`);

    for (const page of pages) {
      const chunks = chunkText(page.text);
      for (let i = 0; i < chunks.length; i++) {
        allChunks.push({
          id: makeId('gh', page.url, i),
          text: chunks[i],
          source: page.url,
          title: page.title,
          type: 'github',
        });
      }
    }
  }

  console.log(`\n✓ Total chunks to embed: ${allChunks.length}\n`);

  // ── Embedding ─────────────────────────────────────────────────────────────
  // Embed one chunk at a time so a single oversized chunk never kills the run.
  const embeddings: number[][] = [];
  const skipped: number[] = [];

  for (let i = 0; i < allChunks.length; i++) {
    const pct = Math.round(((i + 1) / allChunks.length) * 100);
    process.stdout.write(`\r  Embedding … ${i + 1}/${allChunks.length} (${pct}%)`);

    try {
      const res = await ollama.embeddings({
        model: config.ollama.embedModel,
        prompt: allChunks[i].text,
      });
      embeddings.push(res.embedding);
    } catch (err) {
      // Log and skip chunks that exceed the model context window
      skipped.push(i);
      process.stdout.write(` ⚠ skipped chunk ${i} (${(err as Error).message.slice(0, 60)})`);
      embeddings.push([]); // placeholder so indices stay aligned
    }
  }

  // Remove skipped chunks (placeholder empty embeddings) from both arrays
  const validIndices = allChunks.map((_, i) => i).filter((i) => !skipped.includes(i));
  const validChunks = validIndices.map((i) => allChunks[i]);
  const validEmbeddings = validIndices.map((i) => embeddings[i]);

  if (skipped.length > 0) {
    console.log(`\n\n⚠ Skipped ${skipped.length} chunks due to context length errors`);
  }
  console.log(`\n\n✓ Embeddings complete (${validChunks.length} embedded, ${skipped.length} skipped)\n`);

  // ── Store in ChromaDB ─────────────────────────────────────────────────────
  await addDocuments(
    validChunks.map((c) => c.id),
    validEmbeddings,
    validChunks.map((c) => c.text),
    validChunks.map((c) => ({ source: c.source, title: c.title ?? '', type: c.type })),
  );

  const stats = await collectionStats();
  console.log(`✓ Stored ${stats.count} vectors in ChromaDB`);
  console.log('\n🎉 Ingestion complete! Run `npm run chat` or `npm run server` to start.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});