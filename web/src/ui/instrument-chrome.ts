import { h } from './dom';
import { icon, logo } from './icons';

/** Pieces shared by every screen; kept out of instrument.ts so Inicio does not pull that module in. */
export function wordmark(): HTMLElement {
  return h('span', { class: 'wordmark' }, logo(), 'AirChords');
}

export function navPill(name: 'book' | 'info' | 'close', label: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', { type: 'button', class: 'btn-q' }, icon(name), label);
  b.addEventListener('click', onClick);
  return b;
}
