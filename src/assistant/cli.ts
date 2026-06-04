/**
 * Interactive terminal chat  —  npm run chat
 *
 * A simple REPL over the GluuAssistant. Streams answers token-by-token and
 * prints cited sources after each response.
 *
 * Commands:
 *   /reset   — clear conversation history
 *   /stats   — show ChromaDB collection stats
 *   /exit    — quit (Ctrl+C also works)
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { GluuAssistant } from './assistant.js';
import { collectionStats } from '../ingestion/vectorStore.js';
import { config } from '../config.js';

// ── Tiny ANSI helpers (no dependency needed) ──────────────────────────────────
const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  accent: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

async function main() {
  const assistant = new GluuAssistant();

  console.log(c.bold('\n🔐 Gluu AI Assistant') + c.dim(' — terminal chat'));
  console.log(c.dim(`   Model: ${config.ollama.chatModel}  ·  Embed: ${config.ollama.embedModel}`));

  try {
    const { count } = await collectionStats();
    if (count === 0) {
      console.log(c.red('\n⚠ The document collection is empty. Run `npm run ingest` first.'));
    } else {
      console.log(c.dim(`   ${count.toLocaleString()} chunks indexed`));
    }
  } catch (err) {
    console.log(
      c.red(`\n⚠ Could not reach ChromaDB at ${config.chroma.path} (${(err as Error).message}).`),
    );
    console.log(c.dim('   Start it with the docker command in the README, then retry.'));
  }

  console.log(c.dim('\nType a question, or /reset, /stats, /exit.\n'));

  const rl = createInterface({ input: stdin, output: stdout });

  while (true) {
    const question = (await rl.question(c.accent('› '))).trim();

    if (!question) continue;
    if (question === '/exit' || question === '/quit') break;
    if (question === '/reset') {
      assistant.resetHistory();
      console.log(c.dim('  history cleared\n'));
      continue;
    }
    if (question === '/stats') {
      try {
        const { count } = await collectionStats();
        console.log(c.dim(`  ${count.toLocaleString()} chunks indexed\n`));
      } catch (err) {
        console.log(c.red(`  stats unavailable: ${(err as Error).message}\n`));
      }
      continue;
    }

    process.stdout.write('\n');
    let sources: { source: string; title?: string }[] = [];
    try {
      for await (const chunk of assistant.ask(question)) {
        if (chunk.sources) sources = chunk.sources;
        process.stdout.write(chunk.token);
      }
    } catch (err) {
      console.log(c.red(`\n  ✗ ${(err as Error).message}`));
      console.log(c.dim('  (Is Ollama running? `ollama serve`)\n'));
      continue;
    }

    // Print de-duplicated sources
    const seen = new Set<string>();
    const unique = sources.filter((s) => s.source && !seen.has(s.source) && seen.add(s.source));
    if (unique.length > 0) {
      console.log(c.dim('\n\n  Sources:'));
      for (const s of unique) {
        console.log(c.dim('   • ') + c.accent(s.source) + (s.title ? c.dim(` — ${s.title}`) : ''));
      }
    }
    process.stdout.write('\n\n');
  }

  rl.close();
  console.log(c.dim('\nGoodbye 👋\n'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
