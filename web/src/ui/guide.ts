import { chordForDegree, romanNumeral, type Key } from '../music/theory';
import { h } from './dom';
import { gelVar } from './gel';
import { handIcon } from './icons';
import { navPill, wordmark } from './instrument-chrome';
import { chordNameEs, keyNameEs, SIGNS } from './labels';

/** Guía de gestos (Read): the seven signs with our own drawings, in the key being played. */
export function guideScreen(key: Key, onClose: () => void): HTMLElement {
  const rows = SIGNS.map((sign) => {
    const chord = chordForDegree(key, sign.degree);
    const li = h('li', {},
      handIcon(sign.degree),
      h('span', {}, `${chord.label} · ${chordNameEs(chord)}`, h('em', {}, `${sign.emoji} ${sign.name}`)),
      h('b', {}, romanNumeral(key, sign.degree)));
    li.style.setProperty('--c', gelVar(sign.degree));
    return li;
  });
  return h('section', { class: 'screen guide', 'aria-label': 'Guía de gestos' },
    h('header', { class: 'appbar' }, wordmark(), navPill('close', 'Cerrar', onClose)),
    h('div', { class: 'page' },
      h('h1', { tabindex: -1 }, 'Guía de gestos'),
      h('p', { class: 'lede' }, `Mano derecha. Cada seña, un acorde y su color. Tono: ${keyNameEs(key)}.`),
      h('ul', { class: 'signs' }, ...rows),
      h('div', { class: 'foot' },
        h('p', {}, 'Mano abajo: silencio.'),
        h('p', {}, 'Mano izquierda: altura = volumen, giro = brillo.'),
        h('p', {}, 'Boca abierta: siguiente sonido.'),
        h('p', {}, 'En modo guiado, para repetir el mismo acorde baja la mano y vuelve a hacer la seña.'))),
  );
}
