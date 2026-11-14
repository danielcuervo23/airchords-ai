import type { RawHand } from '../gestures/assignHands';
import { coverRect } from './coverRect';
import { h, setAttr, setText } from './dom';
import { HandsOverlay } from './handsOverlay';
import { handIcon, icon } from './icons';
import { navPill, wordmark } from './instrument-chrome';
import { Picker, type PickerOption } from './picker';
import type { FanSwatch, ModeKind, StepView, View } from './viewState';

export const BPM_MIN = 60;
export const BPM_MAX = 160;

export interface InstrumentActions {
  onPreset(id: string): void;
  onKey(id: string): void;
  onMode(kind: ModeKind): void;
  onSong(id: string): void;
  onBpm(bpm: number): void;
  onRestart(): void;
  onGuide(): void;
  onCredits(): void;
  onRetry(): void;
  onUnlockAudio(): void;
}

export interface ControlsView {
  mode: ModeKind;
  keyId: string;
  keyLocked: boolean;
  songId: string;
  bpm: number;
  presetId: string;
  presetPending: boolean;
}

const MODES: { kind: ModeKind; label: string }[] = [
  { kind: 'free', label: 'Libre' },
  { kind: 'guided', label: 'Guiada' },
  { kind: 'auto', label: 'Automático' },
];

function swatch(sw: FanSwatch): HTMLLIElement {
  const li = h('li', { class: `sw-${sw.state}`, 'aria-current': sw.state === 'now' ? 'step' : false },
    handIcon(sw.degree), h('span', {}, sw.numeral), h('span', { class: 'sr-only' }, ` ${sw.symbol}`));
  li.style.setProperty('--c', sw.gel);
  return li;
}

function stepCard(kind: 'now' | 'next', st: StepView): HTMLElement {
  const card = h('div', { class: `step step-${kind}` },
    h('span', { class: 'step-tag' }, kind === 'now' ? 'Ahora' : 'Después'),
    kind === 'now' ? handIcon(st.degree) : h('span', { class: 'step-sw', 'aria-hidden': 'true' }),
    h('span', { class: 'step-chord' }, h('b', {}, `${st.numeral} · ${st.symbol}`), h('span', {}, st.name)),
    h('span', { class: 'step-sign' }, `${st.emoji} ${st.signName}`),
  );
  card.style.setProperty('--c', st.gel);
  return card;
}

/** The instrument screen. Pure view: it renders a View and reports user intent through actions. */
export class InstrumentView {
  readonly el: HTMLElement;
  readonly video: HTMLVideoElement;
  private readonly media: HTMLDivElement;
  private readonly mediaTop: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly hands: HandsOverlay;
  private readonly handsCanvas: HTMLCanvasElement;
  private readonly sym = h('span', { class: 'sym' });
  private readonly deg = h('span', { class: 'deg' });
  private readonly chordName = h('span', { class: 'name' });
  private readonly statusEl = h('p', { class: 'status' });
  private readonly live = h('p', { role: 'status', class: 'sr-only' });
  private readonly volMeter: HTMLElement;
  private readonly briMeter: HTMLElement;
  private readonly overlay = h('div', { class: 'overlay', hidden: true });
  private readonly audioGate: HTMLButtonElement;
  private readonly resizeObserver: ResizeObserver;
  private readonly cueTitle = h('b', {});
  private readonly cueSub = h('span', { class: 'cue-sub' });
  private readonly cueTag = h('span', { class: 'tag nums' });
  private readonly fan = h('ol', { class: 'book' });
  private readonly guided = h('div', { class: 'guided', 'data-testid': 'guided-cue', hidden: true });
  private readonly feedback = h('p', { class: 'feedback', 'aria-live': 'polite', 'aria-atomic': 'true' });
  private readonly hint = h('p', { class: 'hint', hidden: true });
  private readonly restart: HTMLButtonElement;
  private readonly steps = h('div', { class: 'steps' });
  private readonly auto = h('div', { class: 'auto', hidden: true });
  private readonly autoLabel = h('span', { class: 'label' });
  private readonly autoList = h('ol', { class: 'cues', 'data-testid': 'auto-list' });
  private readonly tempoOut = h('output', { class: 'nums', for: 'tempo' });
  private readonly tempo = h('input', { id: 'tempo', type: 'range', min: BPM_MIN, max: BPM_MAX, step: 1 });
  private readonly modeButtons: Map<ModeKind, HTMLButtonElement>;
  private readonly songWrap: HTMLDivElement;
  readonly soundPicker: Picker;
  readonly keyPicker: Picker;
  readonly songPicker: Picker;
  private sigFan = '';
  private sigAuto = '';
  private sigSteps = '';
  private gel = '';

  constructor(private readonly actions: InstrumentActions) {
    this.video = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-hidden': 'true' });
    this.video.muted = true;
    this.handsCanvas = h('canvas', { class: 'hands-layer', 'aria-hidden': 'true' });
    this.hands = new HandsOverlay(this.handsCanvas);
    this.media = h('div', { class: 'media' }, this.video);
    // Landmarks sit above the wash (they stay white) but share the video's rect and mirror.
    this.mediaTop = h('div', { class: 'media' }, this.handsCanvas);

    const meter = (label: string): HTMLElement => {
      const bar = h('i', {});
      const m = h('div', { class: 'meter', role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 },
        h('span', { 'aria-hidden': 'true' }, label), h('span', { class: 'bar', 'aria-hidden': 'true' }, bar));
      return m;
    };
    this.volMeter = meter('Volumen');
    this.briMeter = meter('Brillo');

    this.stage = h('div', { class: 'stage' },
      h('div', { class: 'video', role: 'img', 'aria-label': 'Vista de la cámara en espejo' },
        this.media, h('div', { class: 'wash' }), h('div', { class: 'spot' }), h('div', { class: 'fade' }), this.mediaTop),
      h('header', { class: 'appbar' },
        wordmark(),
        h('nav', { class: 'navbtns', 'aria-label': 'Secciones' },
          navPill('book', 'Guía', () => actions.onGuide()),
          navPill('info', 'Créditos', () => actions.onCredits()))),
      h('div', { class: 'meters' }, this.volMeter, this.briMeter),
      h('div', { class: 'chord', 'data-testid': 'chord-display' },
        h('div', { class: 'row1' }, this.sym, this.deg), this.chordName, this.statusEl),
      h('span', { class: 'mirror' }, 'Espejo'),
      this.overlay,
      // After the overlay: CSS hides it while a loading/error plate is up (any tap still unlocks).
      (this.audioGate = h('button', { type: 'button', class: 'audio-gate', hidden: true })),
    );

    this.restart = h('button', { type: 'button', class: 'btn-secondary', hidden: true }, icon('retry'), 'Tocar otra vez');
    this.restart.addEventListener('click', () => actions.onRestart());
    this.guided.append(this.steps, this.feedback, this.hint, this.restart);

    this.modeButtons = new Map(MODES.map((m) => {
      const b = h('button', { type: 'button', 'aria-pressed': 'false' }, m.label);
      b.addEventListener('click', () => actions.onMode(m.kind));
      return [m.kind, b] as const;
    }));
    this.soundPicker = new Picker('Sonido', 'Sonido', (v) => actions.onPreset(v));
    this.keyPicker = new Picker('Tono', 'Tono', (v) => actions.onKey(v), 2);
    this.songPicker = new Picker('Canción', 'Canción', (v) => actions.onSong(v));
    this.songWrap = h('div', { class: 'song', hidden: true }, this.songPicker.el);

    this.tempo.addEventListener('input', () => this.paintTempo(Number(this.tempo.value)));
    this.tempo.addEventListener('change', () => actions.onBpm(Number(this.tempo.value)));
    this.auto.append(
      h('div', {}, this.autoLabel, this.autoList),
      h('div', {}, h('label', { class: 'label', for: 'tempo' }, 'Tempo (BPM, de 60 a 160)'),
        h('div', { class: 'tempo' }, this.tempoOut, this.tempo)),
    );

    const credits = h('button', { type: 'button', class: 'link' }, 'Ver créditos y licencias');
    credits.addEventListener('click', () => actions.onCredits());

    const panel = h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, wordmark()),
      h('div', { class: 'cue' },
        h('div', { class: 'cueline' }, h('span', { class: 'cue-title' }, this.cueTitle, this.cueSub), this.cueTag),
        this.fan, this.guided),
      h('div', { class: 'modes' },
        h('span', { class: 'label', id: 'mode-label' }, 'Modo'),
        h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'mode-label' }, ...this.modeButtons.values())),
      this.songWrap,
      this.auto,
      h('div', { class: 'ctrl' }, this.soundPicker.el, this.keyPicker.el),
      h('footer', { class: 'panel-foot' },
        h('p', { class: 'privacy' }, icon('lock'), 'La cámara se procesa solo en tu dispositivo'), credits),
    );

    this.el = h('section', { class: 'instrument', 'aria-labelledby': 'instrument-title' },
      h('h1', { id: 'instrument-title', class: 'sr-only', tabindex: -1 }, 'Instrumento AirChords'), this.stage, panel, this.live);

    this.audioGate.addEventListener('click', () => actions.onUnlockAudio());
    this.resizeObserver = new ResizeObserver(() => this.layoutMedia());
    this.resizeObserver.observe(this.stage);
    this.video.addEventListener('loadedmetadata', () => this.layoutMedia());
    this.video.addEventListener('resize', () => this.layoutMedia());
  }

  setOptions(sounds: PickerOption[], keys: PickerOption[], songs: PickerOption[]): void {
    this.soundPicker.setOptions(sounds);
    this.keyPicker.setOptions(keys);
    this.songPicker.setOptions(songs);
  }

  /** Loading notice or an error with a "Reintentar" button over the video. null hides it. */
  showOverlay(kind: 'loading' | 'error' | null, message = ''): void {
    if (kind === null) {
      this.overlay.hidden = true;
      this.overlay.replaceChildren();
      return;
    }
    const children: Node[] = [h('p', {}, message)];
    if (kind === 'error') {
      const retry = h('button', { type: 'button', class: 'btn-primary' }, icon('retry'), 'Reintentar');
      retry.addEventListener('click', () => this.actions.onRetry());
      children.push(retry);
    }
    const plate = h('div', { class: `plate plate-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, ...children);
    this.overlay.replaceChildren(plate);
    this.overlay.hidden = false;
    if (kind === 'error') (plate.querySelector('button') as HTMLButtonElement).focus();
  }

  /** "Toca para activar el sonido" over the video while the audio context is not running. */
  setAudioNotice(text: string | null): void {
    this.audioGate.hidden = text === null;
    setText(this.audioGate, text ?? '');
  }

  dispose(): void {
    this.resizeObserver.disconnect();
  }

  drawHands(hands: readonly RawHand[]): void {
    this.hands.draw(hands);
  }

  render(v: View, c: ControlsView): void {
    // The change of light: one custom property drives the wash and the degree badge.
    if (v.chord && v.chord.gel !== this.gel) {
      this.gel = v.chord.gel;
      this.el.style.setProperty('--gel', v.chord.gel);
    }
    setAttr(this.el, 'data-lit', v.chord ? 'true' : null);
    setAttr(this.stage.querySelector('.video')!, 'aria-label', v.washLabel);

    setText(this.sym, v.chord?.symbol ?? '');
    setText(this.deg, v.chord?.numeral ?? '');
    setText(this.chordName, v.chord?.context ?? '');
    setText(this.statusEl, v.status);
    this.statusEl.hidden = v.status === '';
    // Cleared while silent, so the same chord played again is announced again.
    setText(this.live, v.announcement);

    this.meter(this.volMeter, v.meters.volume);
    this.meter(this.briMeter, v.meters.brightness);

    this.renderCue(v, c);
    this.renderFan(v);
    this.renderGuided(v);
    this.renderAuto(v, c);
    this.renderControls(c);
  }

  private meter(el: HTMLElement, value: number): void {
    const s = String(value);
    if (el.getAttribute('aria-valuenow') === s) return;
    el.setAttribute('aria-valuenow', s);
    el.querySelector<HTMLElement>('.bar i')!.style.setProperty('width', `${value}%`);
  }

  private renderCue(v: View, c: ControlsView): void {
    const song = v.guided ?? v.auto;
    setText(this.cueTitle, song ? song.title : 'Señas · mano derecha');
    setText(this.cueSub, song ? song.artist : 'Cada seña, un acorde y su color');
    setText(this.cueTag, v.guided ? v.guided.stepText : c.mode === 'auto' ? 'Avanza solo' : '');
  }

  private renderFan(v: View): void {
    const sig = v.fan.map((s) => `${s.numeral}${s.state}`).join(',');
    if (sig === this.sigFan) return;
    this.sigFan = sig;
    this.fan.replaceChildren(...v.fan.map(swatch));
    this.fan.setAttribute('aria-label', v.fanLabel);
  }

  private renderGuided(v: View): void {
    const g = v.guided;
    this.guided.hidden = !g;
    if (!g) return;
    const sig = `${g.now?.symbol}|${g.now?.degree}|${g.next?.symbol}|${g.next?.degree}`;
    if (sig !== this.sigSteps) {
      this.sigSteps = sig;
      this.steps.replaceChildren(...[g.now && stepCard('now', g.now), g.next && stepCard('next', g.next)].filter((x): x is HTMLElement => !!x));
    }
    setText(this.feedback, g.feedback);
    setAttr(this.feedback, 'data-result', g.done ? 'done' : g.feedback.startsWith('¡Bien') ? 'hit' : null);
    this.hint.hidden = g.hint === null;
    setText(this.hint, g.hint ?? '');
    this.restart.hidden = !g.done;
  }

  private renderAuto(v: View, c: ControlsView): void {
    const a = v.auto;
    this.auto.hidden = !a;
    if (!a) return;
    setText(this.autoLabel, `Hoja de cambios · ${a.summary}`);
    const sig = a.rows.map((r) => `${r.symbol}${r.current}`).join(',');
    if (sig !== this.sigAuto) {
      this.sigAuto = sig;
      this.autoList.replaceChildren(...a.rows.map((r, i) => {
        const li = h('li', { class: r.current ? 'now' : '', 'aria-current': r.current ? 'true' : false },
          h('span', { class: 'n' }, `Acorde ${i + 1}`), h('span', { class: 'sw', 'aria-hidden': 'true' }),
          h('b', {}, `${r.numeral} · ${r.symbol}`), h('span', {}, r.name));
        li.style.setProperty('--c', r.gel);
        return li;
      }));
    }
    if (document.activeElement !== this.tempo && this.tempo.value !== String(c.bpm)) {
      this.tempo.value = String(c.bpm);
      this.paintTempo(c.bpm);
    }
  }

  private renderControls(c: ControlsView): void {
    for (const [kind, b] of this.modeButtons) setAttr(b, 'aria-pressed', String(kind === c.mode));
    this.songWrap.hidden = c.mode === 'free';
    this.soundPicker.setValue(c.presetId, c.presetPending);
    this.keyPicker.setValue(c.keyId);
    this.keyPicker.setDisabled(c.keyLocked);
    this.keyPicker.setCaption(c.keyLocked ? 'Tono · lo fija la canción' : 'Tono');
    this.songPicker.setValue(c.songId);
  }

  private paintTempo(bpm: number): void {
    setText(this.tempoOut, String(bpm));
    this.tempo.style.setProperty('--fill', `${((bpm - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100}%`);
  }

  /** Places video and overlay canvas on the same cover rect so landmarks line up with the picture. */
  private layoutMedia(): void {
    const box = this.stage.getBoundingClientRect();
    const r = coverRect(this.video.videoWidth, this.video.videoHeight, box.width, box.height);
    for (const layer of [this.media, this.mediaTop]) {
      const st = layer.style;
      st.setProperty('width', `${r.width}px`);
      st.setProperty('height', `${r.height}px`);
      st.setProperty('left', `${r.left}px`);
      st.setProperty('top', `${r.top}px`);
    }
    this.hands.resize(r.width, r.height);
  }
}
