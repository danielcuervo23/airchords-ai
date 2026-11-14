/**
 * Runtime wiring for the instrument, loaded with a dynamic import so the Inicio screen paints
 * without Tone.js or MediaPipe. main.ts creates and resumes the AudioContext inside the
 * "Empezar" click (iOS needs a user gesture) and hands it over here, so it does not matter
 * whether this chunk was already prefetched. If the context is still not running (or iOS
 * interrupts it later, e.g. a phone call), the instrument asks for a tap.
 */
import * as Tone from 'tone';
import { InstrumentController, type PlayMode } from '../app/controller';
import { ToneEngine } from '../audio/engine';
import { PRESETS, type PresetId } from '../audio/presets';
import { ALL_KEYS, type Key } from '../music/theory';
import { SONGS, type Song } from '../songs';
import type { VisionFrame } from '../vision/tracker';
import { audioNotice } from './audioNotice';
import { cameraErrorMessage } from './cameraError';
import { keyId, parseKeyId, parsePresetId } from './ids';
import { BPM_MAX, BPM_MIN, InstrumentView, type ControlsView } from './instrument';
import { keyNameEs } from './labels';
import { toView, type ModeKind } from './viewState';

export interface AudioHandle { engine: ToneEngine; context: BaseAudioContext; ready: Promise<void> }
export interface Nav { onGuide(): void; onCredits(): void }
export interface Session { el: HTMLElement; key(): Key; dispose(): void }

interface TrackerLike { start(onFrame: (f: VisionFrame) => void, onError?: (e: unknown) => void): void; stop(): void; close(): void }

/** Same threshold as the controller's watchdog: no frame for this long means the hands are gone. */
const STALE_FRAME_MS = 500;

/**
 * Builds the engine on the AudioContext that was resumed inside the click.
 * Tone must use that context before any node is created, so this runs before `new ToneEngine()`.
 */
export function unlockAudio(context: AudioContext | null): AudioHandle {
  if (context) Tone.setContext(context);
  const engine = new ToneEngine();
  return { engine, context: Tone.getContext().rawContext as BaseAudioContext, ready: engine.start() };
}

const clampBpm = (n: number): number => Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(n)));

async function createTracker(video: HTMLVideoElement): Promise<TrackerLike> {
  // __E2E__ is a build-time constant: production bundles drop the fake tracker entirely.
  if (__E2E__) return (await import('../e2e/fakeTracker')).FakeTracker.create(video);
  return (await import('../vision/tracker')).Tracker.create(video);
}

async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw 'unsupported';
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play().catch(() => undefined); // muted + playsinline: autoplay is allowed; ignore rare aborts
  return stream;
}

export function startSession(audio: AudioHandle, nav: Nav): Session {
  let mode: ModeKind = 'free';
  let key: Key = ALL_KEYS[0]!; // Do mayor
  let song: Song = SONGS[0]!;
  let bpm = clampBpm(song.bpm);
  let presetPending: PresetId | null = null;
  let stream: MediaStream | null = null;
  let tracker: TrackerLike | null = null;
  let raf = 0;
  let disposed = false;
  let lastFrameAt = 0;
  let handsDrawn = false;

  const controller = new InstrumentController({ engine: audio.engine, now: () => performance.now(), key });

  const view = new InstrumentView({
    onPreset: (value) => {
      const id = parsePresetId(value);
      if (id) void choosePreset(id);
    },
    onKey: (value) => {
      const k = parseKeyId(value);
      if (!k) return;
      key = k;
      controller.setKey(k);
      render();
    },
    onMode: (m) => {
      mode = m;
      applyMode();
    },
    onSong: (id) => {
      const s = SONGS.find((x) => x.id === id);
      if (!s) return;
      song = s;
      bpm = clampBpm(s.bpm);
      applyMode();
    },
    onBpm: (n) => {
      if (!Number.isFinite(n)) return;
      bpm = clampBpm(n);
      if (mode === 'auto') applyMode(); // the controller reads tempo from the song: restart it at the new tempo
    },
    onRestart: () => applyMode(),
    onGuide: nav.onGuide,
    onCredits: nav.onCredits,
    onRetry: () => void boot(),
    onUnlockAudio: () => unlock(),
  });

  view.setOptions(
    PRESETS.map((p, i) => ({ value: p.id, label: p.name, prefix: `N.º ${String(i + 1).padStart(2, '0')}` })),
    ALL_KEYS.map((k) => ({ value: keyId(k), label: keyNameEs(k) })),
    SONGS.map((s) => ({ value: s.id, label: s.title, detail: s.artist })),
  );

  function controls(): ControlsView {
    const locked = mode !== 'free';
    return {
      mode,
      keyId: keyId(locked ? song.key : key),
      keyLocked: locked,
      songId: song.id,
      bpm,
      presetId: presetPending ?? controller.getState().preset,
      presetPending: presetPending !== null,
    };
  }

  function render(): void {
    if (disposed) return;
    view.render(toView(controller.getState(), { mode, key, song: mode === 'free' ? null : song }), controls());
  }

  function applyMode(): void {
    const m: PlayMode =
      mode === 'free' ? { kind: 'free' } : mode === 'guided' ? { kind: 'guided', song } : { kind: 'auto', song: { ...song, bpm } };
    controller.setMode(m);
    render();
  }

  async function choosePreset(id: PresetId): Promise<void> {
    presetPending = id;
    render();
    try {
      await controller.setPreset(id);
    } catch (e) {
      console.error('No se pudo cargar el sonido', e);
    } finally {
      if (presetPending === id) presetPending = null;
      render();
    }
  }

  // The mouth gesture changes the preset inside the controller; subscribe keeps the label in sync.
  controller.subscribe(() => render());

  // --- Audio gate: "Toca para activar el sonido" while the context is not running ---
  const ctx = audio.context;
  let armed = false;
  const disarm = (): void => {
    armed = false;
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };
  function unlock(): void {
    disarm();
    // resume() directly: Tone only resumes 'suspended', and iOS can also report 'interrupted'.
    Promise.all([ctx instanceof AudioContext ? ctx.resume() : undefined, audio.engine.start()])
      .catch((e: unknown) => console.error('El audio no pudo arrancar', e))
      .finally(syncGate); // still not running? the gate and the listeners come back
  }
  function syncGate(): void {
    if (disposed) return;
    const notice = audioNotice(ctx.state);
    view.setAudioNotice(notice);
    if (notice && !armed) {
      armed = true;
      // One-shot: the next tap or key anywhere is a user gesture that can resume the context.
      document.addEventListener('pointerdown', unlock, true);
      document.addEventListener('keydown', unlock, true);
    } else if (!notice) {
      disarm();
    }
  }
  ctx.addEventListener('statechange', syncGate);

  // --- Frames and the animation loop ---
  function drawHands(hands: VisionFrame['hands']): void {
    view.drawHands(hands);
    handsDrawn = hands.length > 0;
  }

  function onFrame(f: VisionFrame): void {
    lastFrameAt = performance.now();
    controller.onFrame(f);
    drawHands(f.hands);
  }

  function loop(): void {
    controller.tick();
    // Same rule as the controller's watchdog: frames stopped, so the drawn hands are stale.
    if (handsDrawn && performance.now() - lastFrameAt > STALE_FRAME_MS) drawHands([]);
    raf = requestAnimationFrame(loop);
  }

  async function boot(): Promise<void> {
    if (disposed) return;
    view.showOverlay('loading', 'Encendiendo la cámara…');
    if (!stream) {
      let s: MediaStream;
      try {
        s = await openCamera(view.video);
      } catch (e) {
        if (!disposed) view.showOverlay('error', cameraErrorMessage(e));
        return;
      }
      if (disposed) {
        s.getTracks().forEach((t) => t.stop()); // the page went away while the permission prompt was open
        return;
      }
      stream = s;
    }
    if (!tracker) {
      view.showOverlay('loading', 'Preparando el reconocedor de manos… La primera vez puede tardar unos segundos.');
      let t: TrackerLike;
      try {
        t = await createTracker(view.video);
      } catch (e) {
        console.error(e);
        if (!disposed) view.showOverlay('error', 'No pudimos preparar el reconocedor de manos. Revisa tu conexión a internet y pulsa Reintentar.');
        return;
      }
      if (disposed) {
        t.close();
        return;
      }
      tracker = t;
      tracker.start(onFrame, (e) => console.error('Error de seguimiento', e));
    }
    view.showOverlay(null);
  }

  const onVisibility = (): void => {
    controller.onVisibilityChange(document.hidden);
    if (document.hidden) drawHands([]);
  };
  document.addEventListener('visibilitychange', onVisibility);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    disarm();
    ctx.removeEventListener('statechange', syncGate);
    document.removeEventListener('visibilitychange', onVisibility);
    tracker?.close();
    stream?.getTracks().forEach((t) => t.stop());
    view.dispose();
    controller.dispose(); // also disposes the audio engine
  }

  audio.ready.catch((e: unknown) => console.error('El audio no pudo arrancar', e)).finally(syncGate);
  void choosePreset(PRESETS[0]!.id);
  render(); // the audio gate is first checked when audio.ready settles (no flash while resume is pending)
  raf = requestAnimationFrame(loop);
  void boot();

  return { el: view.el, key: () => (mode === 'free' ? key : song.key), dispose };
}
