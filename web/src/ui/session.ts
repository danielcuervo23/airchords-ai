/**
 * Runtime wiring for the instrument, loaded with a dynamic import so the Inicio screen paints
 * without Tone.js or MediaPipe. main.ts prefetches it while the visitor reads Inicio, so the
 * "Empezar" click can usually start the audio synchronously (iOS needs a user gesture).
 */
import { InstrumentController, type PlayMode } from '../app/controller';
import { ToneEngine } from '../audio/engine';
import { PRESETS, type PresetId } from '../audio/presets';
import { ALL_KEYS, type Key } from '../music/theory';
import { SONGS, type Song } from '../songs';
import type { VisionFrame } from '../vision/tracker';
import { cameraErrorMessage } from './cameraError';
import { BPM_MAX, BPM_MIN, InstrumentView, type ControlsView } from './instrument';
import { keyNameEs } from './labels';
import { toView, type ModeKind } from './viewState';

export interface AudioHandle { engine: ToneEngine; ready: Promise<void> }
export interface Nav { onGuide(): void; onCredits(): void }
export interface Session { el: HTMLElement; key(): Key; dispose(): void }

interface TrackerLike { start(onFrame: (f: VisionFrame) => void, onError?: (e: unknown) => void): void; stop(): void; close(): void }

/** Call first thing in the "Empezar" click handler. */
export function unlockAudio(): AudioHandle {
  const engine = new ToneEngine();
  return { engine, ready: engine.start() };
}

const keyId = (k: Key): string => `${k.tonic}|${k.mode}`;
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

  const controller = new InstrumentController({ engine: audio.engine, now: () => performance.now(), key });

  const view = new InstrumentView({
    onPreset: (id) => void choosePreset(id as PresetId),
    onKey: (id) => {
      const k = ALL_KEYS.find((x) => keyId(x) === id);
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
      bpm = clampBpm(n);
      if (mode === 'auto') applyMode(); // the controller reads tempo from the song: restart it at the new tempo
    },
    onRestart: () => applyMode(),
    onGuide: nav.onGuide,
    onCredits: nav.onCredits,
    onRetry: () => void boot(),
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

  function onFrame(f: VisionFrame): void {
    controller.onFrame(f);
    view.drawHands(f.hands);
  }

  function loop(): void {
    controller.tick();
    raf = requestAnimationFrame(loop);
  }

  async function boot(): Promise<void> {
    if (disposed) return;
    view.showOverlay('loading', 'Encendiendo la cámara…');
    if (!stream) {
      try {
        stream = await openCamera(view.video);
      } catch (e) {
        view.showOverlay('error', cameraErrorMessage(e));
        return;
      }
    }
    if (!tracker) {
      view.showOverlay('loading', 'Preparando el reconocedor de manos… La primera vez puede tardar unos segundos.');
      try {
        tracker = await createTracker(view.video);
      } catch (e) {
        console.error(e);
        view.showOverlay('error', 'No pudimos preparar el reconocedor de manos. Revisa tu conexión a internet y pulsa Reintentar.');
        return;
      }
      if (disposed) {
        tracker.close();
        return;
      }
      tracker.start(onFrame, (e) => console.error('Error de seguimiento', e));
    }
    view.showOverlay(null);
  }

  const onVisibility = (): void => controller.onVisibilityChange(document.hidden);
  document.addEventListener('visibilitychange', onVisibility);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVisibility);
    tracker?.close();
    stream?.getTracks().forEach((t) => t.stop());
    controller.dispose(); // also disposes the audio engine
  }

  audio.ready.catch((e) => console.error('El audio no pudo arrancar', e));
  void choosePreset(PRESETS[0]!.id);
  render();
  raf = requestAnimationFrame(loop);
  void boot();

  return { el: view.el, key: () => (mode === 'free' ? key : song.key), dispose };
}
