import { h } from './dom';
import { navPill, wordmark } from './instrument-chrome';
import { dropSections, parseMarkdown, type Block, type Inline } from './markdown';

/** Sections of CREDITS.md that describe features not shipped in this version (the face filter is deferred). */
const HIDDEN_SECTION = /spider-man/i;

/** Archivo is bundled with the app; its licence travels with the font file (src/ui/fonts). */
const FONT_CREDIT = [
  '## Tipografía',
  '- Archivo, de Omnibus-Type (The Archivo Project Authors).',
  '- Licencia: SIL Open Font License 1.1 (https://openfontlicense.org)',
  '- Se incluye el archivo de la fuente en la app, sin cambios.',
].join('\n');

function inline(parts: Inline[]): Node[] {
  return parts.map((p) =>
    p.type === 'link'
      ? h('a', { href: p.href, rel: 'noopener noreferrer', target: '_blank' }, p.text)
      : document.createTextNode(p.text),
  );
}

function render(blocks: Block[]): Node[] {
  return blocks.map((b) => {
    if (b.type === 'heading') {
      const tag = b.level === 1 ? 'h1' : b.level === 2 ? 'h2' : 'h3';
      return h(tag, b.level === 1 ? { tabindex: -1 } : {}, ...inline(b.inline));
    }
    if (b.type === 'list') return h('ul', {}, ...b.items.map((it) => h('li', {}, ...inline(it))));
    return h('p', {}, ...inline(b.inline));
  });
}

/** Créditos (Read): CREDITS.md rendered as safe DOM (text nodes only, https links only). */
export function creditsScreen(onClose: () => void): { el: HTMLElement; load(): Promise<void> } {
  const body = h('div', { class: 'page prose' }, h('h1', { tabindex: -1 }, 'Créditos'), h('p', { role: 'status' }, 'Cargando…'));
  const el = h('section', { class: 'screen credits', 'aria-label': 'Créditos' },
    h('header', { class: 'appbar' }, wordmark(), navPill('close', 'Cerrar', onClose)), body);

  let loaded = false;
  async function load(): Promise<void> {
    if (loaded) return;
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}CREDITS.md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = `${await res.text()}\n\n${FONT_CREDIT}`;
      const blocks = dropSections(parseMarkdown(text), (t) => HIDDEN_SECTION.test(t));
      body.replaceChildren(...render(blocks));
      loaded = true;
    } catch {
      const retry = h('button', { type: 'button', class: 'btn-primary' }, 'Reintentar');
      retry.addEventListener('click', () => void load());
      body.replaceChildren(
        h('h1', { tabindex: -1 }, 'Créditos'),
        h('p', { role: 'alert' }, 'No pudimos cargar los créditos. Revisa tu conexión y vuelve a intentarlo.'),
        retry,
      );
    }
  }
  return { el, load };
}
