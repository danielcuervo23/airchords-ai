/**
 * Composition root. Inicio ships in the first, small bundle; the instrument (Tone.js, controller,
 * MediaPipe) is a separate chunk that is prefetched while the visitor reads Inicio.
 */
import './ui/styles.css';
import { ALL_KEYS } from './music/theory';
import { creditsScreen } from './ui/credits';
import { guideScreen } from './ui/guide';
import { homeScreen } from './ui/home';

type SessionLib = typeof import('./ui/session');
type Screen = 'home' | 'instrument' | 'guide' | 'credits';

const app = document.querySelector<HTMLDivElement>('#app')!;

let lib: SessionLib | null = null;
let libPromise: Promise<SessionLib> | null = null;
const loadLib = (): Promise<SessionLib> =>
  (libPromise ??= import('./ui/session').then((m) => (lib = m)).catch((e: unknown) => {
    libPromise = null; // let a later click try again
    throw e;
  }));

let session: ReturnType<SessionLib['startSession']> | null = null;
let current: Screen = 'home';
let returnTo: Screen = 'home';
const screens = new Map<Screen, HTMLElement>();

function show(next: Screen): void {
  if (next === 'guide' || next === 'credits') returnTo = current === 'guide' || current === 'credits' ? returnTo : current;
  current = next;
  for (const [name, el] of screens) el.hidden = name !== next;
  window.scrollTo(0, 0);
  // Move focus to the new screen's title so keyboard and screen-reader users land in the right place.
  screens.get(next)?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
}

function mount(name: Screen, el: HTMLElement): void {
  screens.get(name)?.remove();
  screens.set(name, el);
  el.hidden = true;
  app.append(el);
}

const credits = creditsScreen(() => show(returnTo));
mount('credits', credits.el);

function openCredits(): void {
  void credits.load();
  show('credits');
}

function openGuide(): void {
  mount('guide', guideScreen(session?.key() ?? ALL_KEYS[0]!, () => show(returnTo)));
  show('guide');
}

async function start(): Promise<void> {
  if (session) {
    show('instrument');
    return;
  }
  // iOS only lets audio start inside the user gesture. Create and resume a bare AudioContext
  // synchronously here (no Tone needed); the instrument chunk hands it to Tone when it loads.
  const ctx = primeAudio();
  let audio: ReturnType<SessionLib['unlockAudio']> | null = null;
  home.cta.disabled = true;
  home.cta.setAttribute('aria-busy', 'true');
  try {
    const m = lib ?? (await loadLib());
    audio = m.unlockAudio(ctx);
    session = m.startSession(audio, { onGuide: openGuide, onCredits: openCredits });
    mount('instrument', session.el);
    show('instrument');
  } catch (e) {
    console.error(e);
    audio?.engine.dispose(); // do not leak audio nodes if the session could not start
    home.cta.after(errorNote());
  } finally {
    home.cta.disabled = false;
    home.cta.removeAttribute('aria-busy');
  }
}

let audioCtx: AudioContext | null = null;

/** Must run synchronously inside the click handler. Reuses one context across retries. */
function primeAudio(): AudioContext | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null; // Tone will report the problem; the instrument still shows
    audioCtx ??= new Ctor({ latencyHint: 'interactive' });
    void audioCtx.resume().catch(() => undefined); // the instrument shows "Toca para activar el sonido" if this did not count
    return audioCtx;
  } catch {
    return null;
  }
}

function errorNote(): HTMLElement {
  document.getElementById('start-error')?.remove();
  const p = document.createElement('p');
  p.id = 'start-error';
  p.className = 'error-note';
  p.setAttribute('role', 'alert');
  p.textContent = 'No pudimos cargar el instrumento. Revisa tu conexión y vuelve a pulsar Empezar.';
  return p;
}

const home = homeScreen(() => void start(), openCredits);
mount('home', home.el);
home.el.hidden = false;

// Prefetch the instrument while the visitor reads Inicio.
const idle = (fn: () => void): void => {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 1500 });
  else setTimeout(fn, 300);
};
idle(() => void loadLib().catch(() => undefined));

window.addEventListener('pagehide', () => {
  session?.dispose();
  session = null;
});
// A page restored from the back/forward cache lost its camera and audio in pagehide: start clean.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
