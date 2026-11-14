import type { Degree } from '../music/theory';
import { s } from './dom';

/** Stroke icons from the approved mockup (24 x 24, currentColor). Always paired with a text label. */
const PATHS = {
  book: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z', 'M4 19V5'],
  info: ['M12 11v6M12 7.5v.01'],
  arrow: ['M5 12h14M13 6l6 6-6 6'],
  lock: ['M8 11V8a4 4 0 0 1 8 0v3'],
  close: ['M6 6l12 12M18 6L6 18'],
  chev: ['M6 9l6 6 6-6'],
  retry: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4h4'],
} as const;
export type IconName = keyof typeof PATHS;

export function icon(name: IconName): SVGElement {
  const svg = s('svg', {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': name === 'arrow' || name === 'chev' ? 2.6 : 2,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `icon icon-${name}`,
  });
  if (name === 'info') svg.append(s('circle', { cx: 12, cy: 12, r: 9 }));
  if (name === 'lock') svg.append(s('rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }));
  for (const d of PATHS[name]) svg.append(s('path', { d }));
  return svg;
}

/** The wordmark's three gel sheets (from the mockup). */
export function logo(): SVGElement {
  return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', class: 'logo' },
    s('rect', { x: 3, y: 4, width: 6, height: 16, rx: 1.5, fill: 'var(--g1)', transform: 'rotate(-14 6 20)' }),
    s('rect', { x: 9, y: 4, width: 6, height: 16, rx: 1.5, fill: 'var(--g2)' }),
    s('rect', { x: 15, y: 4, width: 6, height: 16, rx: 1.5, fill: 'var(--g5)', transform: 'rotate(14 18 20)' }),
  );
}

type HandShape = { thumb: 'up' | 'down' } | { fingers: [number, number, number, number]; thumbOut: boolean };
const HANDS: Record<Degree, HandShape> = {
  1: { fingers: [1, 0, 0, 0], thumbOut: false },
  2: { fingers: [1, 1, 0, 0], thumbOut: false },
  3: { fingers: [1, 0, 0, 1], thumbOut: true },
  4: { thumb: 'up' },
  5: { fingers: [1, 1, 1, 1], thumbOut: true },
  6: { thumb: 'down' },
  7: { fingers: [0, 0, 0, 0], thumbOut: false },
};

/** Hand-sign illustration (50 x 50). Filled with the current --c gel, curtain stroke. Decorative. */
export function handIcon(d: Degree): SVGElement {
  const shape = HANDS[d];
  const cap = (x: number, y: number, w: number, hh: number): SVGElement =>
    s('rect', { class: 'f', x, y, width: w, height: hh, rx: w / 2 });
  const parts: SVGElement[] = [];
  if ('thumb' in shape) {
    const g = s('g', shape.thumb === 'down' ? { transform: 'rotate(180 26 26)' } : {});
    g.append(cap(10, 6, 6, 24));
    for (let k = 0; k < 4; k++) g.append(cap(18 + k * 5.4, 19, 5.4, 10));
    g.append(s('rect', { class: 'f', x: 16, y: 24, width: 24, height: 17, rx: 5 }));
    parts.push(g);
  } else {
    const xs = [14.5, 19.8, 25.1, 30.4];
    const tops = [4, 2, 4, 9];
    shape.fingers.forEach((up, k) => parts.push(up ? cap(xs[k]!, tops[k]!, 5, 26) : cap(xs[k]!, 16, 5, 12)));
    if (shape.thumbOut) parts.push(s('rect', { class: 'f', x: 7, y: 22, width: 5.2, height: 15, rx: 2.6, transform: 'rotate(-38 12 36)' }));
    parts.push(s('rect', { class: 'f', x: 13, y: 22, width: 24, height: 20, rx: 6 }));
    if (!shape.thumbOut) parts.push(s('rect', { class: 'f', x: 11, y: 28, width: 15, height: 5.4, rx: 2.7 }));
  }
  return s('svg', { viewBox: '0 0 50 50', class: 'hand', 'aria-hidden': 'true' }, ...parts);
}
