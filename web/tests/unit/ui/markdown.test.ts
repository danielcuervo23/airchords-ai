import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../../src/ui/markdown';

describe('parseMarkdown (minimal, safe)', () => {
  it('reads headings, list items and paragraphs', () => {
    expect(parseMarkdown('# Créditos\n\n## Piano\n- Autor: A\n- Licencia: B\n\nTexto suelto.')).toEqual([
      { type: 'heading', level: 1, inline: [{ type: 'text', text: 'Créditos' }] },
      { type: 'heading', level: 2, inline: [{ type: 'text', text: 'Piano' }] },
      { type: 'list', items: [[{ type: 'text', text: 'Autor: A' }], [{ type: 'text', text: 'Licencia: B' }]] },
      { type: 'paragraph', inline: [{ type: 'text', text: 'Texto suelto.' }] },
    ]);
  });
  it('turns bare https URLs into links and keeps surrounding text', () => {
    const [b] = parseMarkdown('- Licencia: CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)');
    expect(b).toEqual({
      type: 'list',
      items: [[
        { type: 'text', text: 'Licencia: CC-BY 3.0 (' },
        { type: 'link', text: 'https://creativecommons.org/licenses/by/3.0/', href: 'https://creativecommons.org/licenses/by/3.0/' },
        { type: 'text', text: ')' },
      ]],
    });
  });
  it('never makes links from other schemes and keeps HTML as plain text', () => {
    const [b] = parseMarkdown('<img src=x onerror=alert(1)> javascript:alert(1) http://x.test');
    expect(b).toEqual({
      type: 'paragraph',
      inline: [{ type: 'text', text: '<img src=x onerror=alert(1)> javascript:alert(1) http://x.test' }],
    });
  });
});
