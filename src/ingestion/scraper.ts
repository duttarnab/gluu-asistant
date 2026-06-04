import { load } from 'cheerio';
import { cleanText } from './chunker.js';

export interface ScrapedPage {
  url: string;
  title: string;
  text: string;
}

const USER_AGENT =
  'Mozilla/5.0 (compatible; GluuDocsBot/1.0; +https://github.com/your-org/gluu-assistant)';

/** Fetch a single URL and extract readable text. */
export async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = load(html);

    // Remove navigation, scripts, styles, footers
    $('nav, footer, script, style, .sidebar, .toc, .nav, #nav, header').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || url;

    // Prefer main content areas
    const content =
      $('main, article, .content, .md-content, .documentation, #content').first().text() ||
      $('body').text();

    return { url, title, text: cleanText(content) };
  } catch (err) {
    console.warn(`  ⚠ Failed to scrape ${url}: ${(err as Error).message}`);
    return null;
  }
}

/** Crawl a site starting from a root URL, following internal links up to maxPages. */
export async function crawlSite(
  rootUrl: string,
  maxPages = 100,
): Promise<ScrapedPage[]> {
  const base = new URL(rootUrl);
  const visited = new Set<string>();
  const queue: string[] = [rootUrl];
  const results: ScrapedPage[] = [];

  while (queue.length > 0 && results.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    process.stdout.write(`  Scraping [${results.length + 1}/${maxPages}] ${url} … `);
    const page = await scrapePage(url);

    if (page && page.text.length > 200) {
      results.push(page);
      process.stdout.write('✓\n');

      // Discover internal links
      const html = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
        .then((r) => r.text())
        .catch(() => '');
      const $ = load(html);
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') ?? '';
        try {
          const resolved = new URL(href, url);
          if (
            resolved.hostname === base.hostname &&
            !visited.has(resolved.href) &&
            !resolved.href.includes('#') &&
            !resolved.pathname.match(/\.(png|jpg|pdf|zip|svg|gif)$/i)
          ) {
            queue.push(resolved.href);
          }
        } catch {
          // invalid URL, skip
        }
      });
    } else {
      process.stdout.write('skip\n');
    }

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}

/** Fetch a raw GitHub markdown file. */
export async function fetchGithubMarkdown(rawUrl: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Extract title from first H1
    const titleMatch = text.match(/^#\s+(.+)/m);
    return {
      url: rawUrl,
      title: titleMatch?.[1] ?? rawUrl.split('/').pop() ?? rawUrl,
      text: cleanText(text),
    };
  } catch (err) {
    console.warn(`  ⚠ Failed to fetch ${rawUrl}: ${(err as Error).message}`);
    return null;
  }
}

/** Fetch all .md files from a public GitHub repo via the API. */
export async function fetchGithubRepo(
  owner: string,
  repo: string,
  branch = 'main',
  subPath = '',
): Promise<ScrapedPage[]> {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const results: ScrapedPage[] = [];

  try {
    const res = await fetch(apiBase, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = (await res.json()) as { tree: { path: string; type: string }[] };

    const mdFiles = data.tree.filter(
      (f) =>
        f.type === 'blob' &&
        f.path.endsWith('.md') &&
        (!subPath || f.path.startsWith(subPath)),
    );

    console.log(`  Found ${mdFiles.length} markdown files in ${owner}/${repo}`);

    for (const file of mdFiles) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      process.stdout.write(`  Fetching ${file.path} … `);
      const page = await fetchGithubMarkdown(rawUrl);
      if (page) {
        results.push(page);
        process.stdout.write('✓\n');
      } else {
        process.stdout.write('skip\n');
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (err) {
    console.error(`  ✗ GitHub repo fetch failed: ${(err as Error).message}`);
  }

  return results;
}
