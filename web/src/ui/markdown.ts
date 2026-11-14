/**
 * A deliberately tiny Markdown reader for CREDITS.md: headings, "- " list items and paragraphs.
 * It produces data, not HTML. The renderer builds DOM nodes with textContent, so any HTML in the
 * source shows up as plain text. Only bare https:// URLs become links.
 */
export type Inline = { type: 'text'; text: string } | { type: 'link'; text: string; href: string };
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { type: 'list'; items: Inline[][] }
  | { type: 'paragraph'; inline: Inline[] };

const URL_RE = /https:\/\/[^\s)<>"']+/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index;
    if (i > last) out.push({ type: 'text', text: text.slice(last, i) });
    out.push({ type: 'link', text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = (): void => {
    if (para.length) blocks.push({ type: 'paragraph', inline: parseInline(para.join(' ')) });
    para = [];
  };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!line) {
      flush();
    } else if (h) {
      flush();
      blocks.push({ type: 'heading', level: h[1]!.length as 1 | 2 | 3, inline: parseInline(h[2]!) });
    } else if (line.startsWith('- ')) {
      flush();
      const prev = blocks[blocks.length - 1];
      const item = parseInline(line.slice(2));
      if (prev?.type === 'list') prev.items.push(item);
      else blocks.push({ type: 'list', items: [item] });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

const plain = (inline: Inline[]): string => inline.map((i) => i.text).join('');

/** Removes each heading whose text matches, plus everything until the next heading of the same or higher level. */
export function dropSections(blocks: Block[], match: (headingText: string) => boolean): Block[] {
  const out: Block[] = [];
  let dropLevel: number | null = null;
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (dropLevel !== null && b.level <= dropLevel) dropLevel = null;
      if (dropLevel === null && match(plain(b.inline))) {
        dropLevel = b.level;
        continue;
      }
    }
    if (dropLevel === null) out.push(b);
  }
  return out;
}
