import type { SoundEngine } from '../audio/engine';
import { PRESETS, type PresetId } from '../audio/presets';
import { assignHands } from '../gestures/assignHands';
import { degreeFromGesture } from '../gestures/degree';
import { ExpressionTracker, type Expression } from '../gestures/expression';
import { MouthTrigger, mouthOpenness } from '../gestures/mouth';
import { Stabilizer } from '../gestures/stabilizer';
import type { Landmark } from '../gestures/types';
import { chordForDegree, type Chord, type Degree, type Key } from '../music/theory';
import { GuidedSession, stepAtBeat } from '../songs/sequencer';
import type { Song } from '../songs/types';
import { HANDEDNESS_LABELS_SWAPPED, type VisionFrame } from '../vision/tracker';
import { sameState, type ControllerState, type PlayMode } from './state';

export type { ControllerState, PlayMode } from './state';

const MIN_STABLE_MS = 80;
const ASPECT_TOLERANCE = 0.01;
const WATCHDOG_MS = 500;
const DEFAULT_EXPRESSION: Expression = { volume: 0.7, brightness: 0.5 };

export class InstrumentController {
  private readonly engine: SoundEngine;
  private readonly now: () => number;
  private readonly labelsSwapped: boolean;
  private key: Key;
  private mode: PlayMode = { kind: 'free' };
  private preset: PresetId = PRESETS[0]!.id;
  /** Last preset asked for (may still be loading); the mouth cycles from here. */
  private requested: PresetId = PRESETS[0]!.id;
  private presetToken = 0;
  private disposed = false;
  private lastFrameAt: number | null = null;
  private stalled = false;
  private stabilizer = new Stabilizer<Degree>({ minStableMs: MIN_STABLE_MS });
  private prevStable: Degree | null = null;
  private readonly mouth = new MouthTrigger();
  private tracker: ExpressionTracker | null = null;
  private trackerAspect = 1;
  private expression: Expression = DEFAULT_EXPRESSION;
  private handsVisible = { chord: false, expression: false };
  private sounding: Chord | null = null;
  // guided
  private session: GuidedSession | null = null;
  private guidedIndex = 0;
  private lastResult: 'hit' | 'wait' = 'wait';
  private awaitingRearticulate = false;
  private soundingUntil = 0;
  // auto
  private clockStart = 0;
  private pausedAt: number | null = null;
  private autoIndex = -1;
  private autoDegree: Degree | null = null;
  // subscribers
  private listeners = new Set<(s: ControllerState) => void>();
  private last: ControllerState | null = null;

  constructor(deps: { engine: SoundEngine; now: () => number; key: Key; labelsSwapped?: boolean }) {
    this.engine = deps.engine;
    this.now = deps.now;
    this.key = deps.key;
    this.labelsSwapped = deps.labelsSwapped ?? HANDEDNESS_LABELS_SWAPPED;
  }

  onFrame(f: VisionFrame): void {
    if (this.disposed) return;
    const now = this.now();
    this.lastFrameAt = now;
    this.stalled = false;
    const { chordHand, expressionHand } = assignHands(f.hands, { labelsSwapped: this.labelsSwapped });
    this.handsVisible = { chord: chordHand !== null, expression: expressionHand !== null };
    this.updateExpression(f.aspect, expressionHand?.landmarks ?? null);
    // No face means the mouth is closed as far as we know, so the trigger re-arms.
    if (this.mouth.update(f.face ? mouthOpenness(f.face.landmarks) : 0)) this.cyclePreset();
    if (this.mode.kind !== 'auto') this.handChord(degreeFromGesture(chordHand?.gesture ?? null), now);
    this.advance(now);
    this.emit();
  }

  /** Call from requestAnimationFrame: timing must not depend on the camera frame rate. */
  tick(nowMs: number = this.now()): void {
    if (this.disposed || this.pausedAt !== null) return;
    if (this.lastFrameAt !== null && !this.stalled && nowMs - this.lastFrameAt > WATCHDOG_MS) {
      this.stalled = true;
      this.handsVisible = { chord: false, expression: false };
      // Auto mode does not need the hands, so the song keeps going.
      if (this.mode.kind !== 'auto') this.silence();
    }
    this.advance(nowMs);
    this.emit();
  }

  getState(): ControllerState {
    const degree = this.mode.kind === 'auto' ? this.autoDegree : this.stabilizer.current();
    const state: ControllerState = {
      degree,
      chord: this.sounding,
      expression: { ...this.expression },
      preset: this.preset,
      handsVisible: { ...this.handsVisible },
    };
    if (this.mode.kind === 'guided') {
      const done = this.session?.isDone() ?? false;
      const needsRearticulate =
        this.awaitingRearticulate && !done && degree !== null && this.session?.current().degree === degree;
      state.guided = { index: this.guidedIndex, lastResult: this.lastResult, done, needsRearticulate };
    }
    return state;
  }

  setKey(k: Key): void {
    this.key = k;
    const d = this.stabilizer.current();
    if (this.mode.kind === 'free' && d !== null && this.sounding) this.play(chordForDegree(k, d));
    this.emit();
  }

  async setPreset(id: PresetId): Promise<void> {
    const token = ++this.presetToken;
    this.requested = id;
    try {
      await this.engine.setPreset(id);
    } catch (e) {
      if (token === this.presetToken) this.requested = this.preset;
      throw e;
    }
    if (token !== this.presetToken || this.disposed) return; // a newer request won
    this.preset = id;
    this.emit();
  }

  setMode(m: PlayMode): void {
    // Validate and build everything first: on bad input the previous mode stays intact.
    if (m.kind !== 'free' && !(Number.isFinite(m.song.bpm) && m.song.bpm > 0)) {
      throw new Error(`Invalid bpm: ${m.song.bpm}`);
    }
    const session = m.kind === 'guided' ? new GuidedSession(m.song) : null;
    this.silence();
    this.mode = m;
    this.session = session;
    this.guidedIndex = 0;
    this.lastResult = 'wait';
    this.awaitingRearticulate = false;
    this.autoIndex = -1;
    this.autoDegree = null;
    this.clockStart = this.now();
    if (this.pausedAt !== null) this.pausedAt = this.clockStart; // stay paused, beat 0 on resume
    if (m.kind === 'auto') this.engine.setBpm(m.song.bpm);
    this.emit();
  }

  onVisibilityChange(hidden: boolean): void {
    if (hidden) {
      if (this.pausedAt !== null) return;
      this.silence();
      this.pausedAt = this.now();
    } else if (this.pausedAt !== null) {
      this.clockStart += this.now() - this.pausedAt; // the beat stood still while hidden
      this.pausedAt = null;
      this.autoIndex = -1; // the chord was released, so sound the current step again
    }
    this.emit();
  }

  subscribe(fn: (s: ControllerState) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  dispose(): void {
    this.disposed = true;
    this.engine.dispose();
    this.listeners.clear();
  }

  // --- internals ---

  private play(chord: Chord): void {
    this.sounding = chord;
    this.engine.playChord(chord);
  }

  private release(): void {
    this.sounding = null;
    this.engine.release();
  }

  /** Release, and forget what the hands were doing so a held gesture is read again on return. */
  private silence(): void {
    this.release();
    this.stabilizer = new Stabilizer<Degree>({ minStableMs: MIN_STABLE_MS });
    this.prevStable = null;
  }

  private handChord(raw: Degree | null, now: number): void {
    if (this.pausedAt !== null) return;
    const stable = this.stabilizer.update(raw, now);
    if (stable === this.prevStable) return;
    this.prevStable = stable;
    this.awaitingRearticulate = false; // any change of the stable gesture counts as re-articulating
    if (this.mode.kind === 'free') {
      if (stable === null) this.release();
      else this.play(chordForDegree(this.key, stable));
    } else if (this.mode.kind === 'guided') {
      this.guidedSubmit(this.mode.song, stable, now);
    }
  }

  private guidedSubmit(song: Song, stable: Degree | null, now: number): void {
    const session = this.session!;
    const step = session.current();
    const result = session.submit(stable);
    this.lastResult = result;
    if (result !== 'hit') return;
    this.guidedIndex += 1;
    this.awaitingRearticulate = true;
    this.soundingUntil = now + (step.beats * 60000) / song.bpm;
    this.play(chordForDegree(song.key, step.degree));
  }

  /** Time-driven work: guided chord expiry and the auto beat clock. */
  private advance(now: number): void {
    if (this.pausedAt !== null) return;
    if (this.mode.kind === 'guided' && this.sounding && now >= this.soundingUntil) this.release();
    if (this.mode.kind === 'auto') this.autoStep(this.mode.song, now);
  }

  private autoStep(song: Song, now: number): void {
    const beat = ((now - this.clockStart) * song.bpm) / 60000;
    const hit = stepAtBeat(song.steps, beat, true);
    if (!hit || hit.index === this.autoIndex) return;
    this.autoIndex = hit.index;
    this.autoDegree = hit.step.degree;
    this.play(chordForDegree(song.key, hit.step.degree));
  }

  private updateExpression(aspect: number, lm: Landmark[] | null): void {
    const valid = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    if (!this.tracker || Math.abs(valid - this.trackerAspect) / this.trackerAspect > ASPECT_TOLERANCE) {
      this.tracker = new ExpressionTracker({ aspect: valid });
      this.trackerAspect = valid;
    }
    this.expression = this.tracker.update(lm);
    this.engine.setExpression(this.expression);
  }

  private cyclePreset(): void {
    const i = PRESETS.findIndex((p) => p.id === this.requested);
    const next = PRESETS[(i + 1) % PRESETS.length]!.id;
    this.setPreset(next).catch(() => {
      /* keep the old preset */
    });
  }

  private emit(): void {
    const s = this.getState();
    if (this.last && sameState(this.last, s)) return;
    this.last = s;
    this.listeners.forEach((fn) => fn(s));
  }
}
