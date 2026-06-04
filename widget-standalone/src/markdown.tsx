import { Fragment, type ReactNode } from 'react';

// Matches inline code, bold, italic, markdown links, and bare URLs.
// Order matters: bold (**) is listed before italic (*) so it wins.
const INLINE_RE =
  /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)]+)/g;

/** Render a single line of inline markdown to React nodes. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE_RE)
    .map((part, i): ReactNode => {
      if (!part) return null;
      const key = `${keyPrefix}-${i}`;

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={key}
            className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-pink-600"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={key} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }

      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        return (
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            {link[1]}
          </a>
        );
      }
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={key}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            {part}
          </a>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    })
    .filter(Boolean);
}

const isCodeFence = (line: string) => /^```/.test(line.trim());
const headingMatch = (line: string) => line.match(/^(#{1,6})\s+(.+)$/);
const isUl = (line: string) => /^\s*[-*]\s+/.test(line);
const isOl = (line: string) => /^\s*\d+\.\s+/.test(line);

/**
 * Render a markdown string (as produced by the assistant) into React nodes.
 * Supports headings, fenced + inline code, bold/italic, links, and lists.
 */
export function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (isCodeFence(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !isCodeFence(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[0.78rem] leading-relaxed"
        >
          <code className="font-mono text-slate-100">{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = headingMatch(line);
    if (h) {
      blocks.push(
        <p key={key++} className="mb-1 mt-2 text-[0.95rem] font-semibold text-slate-900">
          {renderInline(h[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (isUl(line)) {
      const items: string[] = [];
      while (i < lines.length && isUl(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (isOl(line)) {
      const items: string[] = [];
      while (i < lines.length && isOl(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph: gather consecutive plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isCodeFence(lines[i]) &&
      !headingMatch(lines[i]) &&
      !isUl(lines[i]) &&
      !isOl(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed">
        {renderInline(para.join(' '), `p${key}`)}
      </p>,
    );
  }

  return <>{blocks}</>;
}
