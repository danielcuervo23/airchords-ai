import { h } from './dom';
import { icon } from './icons';
import { wordmark } from './instrument-chrome';

/** Inicio (Persuade): what it is, one action, the privacy promise. */
export function homeScreen(onStart: () => void, onCredits: () => void): { el: HTMLElement; cta: HTMLButtonElement } {
  const fan = h('div', { class: 'fan', 'aria-hidden': 'true' });
  for (let i = 0; i < 7; i++) {
    const strip = h('i', {});
    strip.style.setProperty('--c', `var(--g${i + 1})`);
    strip.style.setProperty('--r', `${(i - 3) * 6}deg`);
    fan.append(strip);
  }
  const cta = h('button', { type: 'button', class: 'cta' }, 'Empezar', icon('arrow'));
  cta.addEventListener('click', onStart);
  const credits = h('button', { type: 'button', class: 'link' }, 'Créditos y licencias');
  credits.addEventListener('click', onCredits);
  const el = h('section', { class: 'screen home', 'aria-labelledby': 'home-title' },
    fan,
    h('header', { class: 'appbar' }, wordmark()),
    h('div', { class: 'home-body' },
      h('h1', { id: 'home-title', tabindex: -1 }, 'Tus manos encienden los acordes.'),
      h('p', { class: 'intro' },
        'Haz una seña con la mano derecha frente a la cámara y suena un acorde, con su propio color de luz. La izquierda maneja volumen y brillo.'),
      h('div', { class: 'home-actions' },
        cta,
        h('p', { class: 'privacy' }, icon('lock'), 'La cámara se procesa solo en tu dispositivo'),
        credits)),
  );
  return { el, cta };
}
