import { ChromaClient, Collection } from 'chromadb';
import { config, type SearchResult } from '../config.js';

let _client: ChromaClient | null = null;
let _collection: Collection | null = null;

function getClient(): ChromaClient {
  if (!_client) {
    _client = new ChromaClient({ path: config.chroma.path });
  }
  return _client;
}

export async function getCollection(reset = false): Promise<Collection> {
  if (_collection && !reset) return _collection;

  const client = getClient();

  if (reset) {
    try {
      await client.deleteCollection({ name: config.chroma.collection });
    } catch {
      // collection might not exist 
      console.error('No existing collection to delete, starting fresh.');
    }
  }

  _collection = await client.getOrCreateCollection({
    name: config.chroma.collection,
    metadata: { 'hnsw:space': 'cosine' },
  });

  return _collection;
}

export async function addDocuments(
  ids: string[],
  embeddings: number[][],
  documents: string[],
  metadatas: Record<string, string>[],
): Promise<void> {
  const col = await getCollection();
  // ChromaDB has a batch limit — add in chunks of 500
  const batchSize = 500;
  for (let i = 0; i < ids.length; i += batchSize) {
    await col.add({
      ids: ids.slice(i, i + batchSize),
      embeddings: embeddings.slice(i, i + batchSize),
      documents: documents.slice(i, i + batchSize),
      metadatas: metadatas.slice(i, i + batchSize),
    });
  }
}

/**
 * Convert a raw GitHub markdown URL into its rendered GitHub "blob" page so it
 * opens as an HTML page instead of plain text. Non-GitHub URLs (e.g. docs-site
 * pages) are returned unchanged.
 *
 *   https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
 *     → https://github.com/{owner}/{repo}/blob/{branch}/{path}
 */
export function toDisplayUrl(url: string): string {
  const m = url.match(
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
  );
  if (m) {
    const [, owner, repo, branch, path] = m;
    return `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
  }
  return url;
}

export async function similaritySearch(
  queryEmbedding: number[],
  topK = 5,
): Promise<SearchResult[]> {
  const col = await getCollection();
  const results = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'] as any,
  });

  const docs = results.documents?.[0] ?? [];
  const metas = results.metadatas?.[0] ?? [];
  const distances = results.distances?.[0] ?? [];

  return docs.map((doc, i) => ({
    text: doc ?? '',
    source: toDisplayUrl((metas[i]?.source as string) ?? ''),
    title: (metas[i]?.title as string) ?? undefined,
    score: 1 - (distances[i] ?? 0), // cosine similarity
  }));
}

export async function collectionStats(): Promise<{ count: number }> {
  const col = await getCollection();
  const count = await col.count();
  return { count };
}
