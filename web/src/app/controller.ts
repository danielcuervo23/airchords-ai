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
    const now = this.now();
    const { chordHand, expressionHand } = assignHands(f.hands, { labelsSwapped: this.labelsSwapped });
    this.handsVisible = { chord: chordHand !== null, expression: expressionHand !== null };
    this.updateExpression(f.aspect, expressionHand?.landmarks ?? null);
    if (f.face && this.mouth.update(mouthOpenness(f.face.landmarks))) this.cyclePreset();
    if (this.mode.kind === 'auto') this.autoTick(this.mode.song, now);
    else this.handChord(degreeFromGesture(chordHand?.gesture ?? null), now);
    this.emit();
  }

  getState(): ControllerState {
    const degree = this.mode.kind === 'auto' ? this.autoDegree : this.stabilizer.current();
    const state: ControllerState = {
      degree,
      chord: this.sounding,
      expression: this.expression,
      preset: this.preset,
      handsVisible: { ...this.handsVisible },
    };
    if (this.mode.kind === 'guided') {
      state.guided = { index: this.guidedIndex, lastResult: this.lastResult, done: this.session?.isDone() ?? false };
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
    this.requested = id;
    try {
      await this.engine.setPreset(id);
    } catch (e) {
      this.requested = this.preset;
      throw e;
    }
    this.preset = id;
    this.emit();
  }

  setMode(m: PlayMode): void {
    this.silence();
    this.mode = m;
    this.session = m.kind === 'guided' ? new GuidedSession(m.song) : null;
    this.guidedIndex = 0;
    this.lastResult = 'wait';
    this.autoIndex = -1;
    this.autoDegree = null;
    this.pausedAt = null;
    this.clockStart = this.now();
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
    if (this.mode.kind === 'guided' && this.sounding && now >= this.soundingUntil) this.release();
    if (stable === this.prevStable) return;
    this.prevStable = stable;
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
    this.soundingUntil = now + (step.beats * 60000) / song.bpm;
    this.play(chordForDegree(song.key, step.degree));
  }

  private autoTick(song: Song, now: number): void {
    if (this.pausedAt !== null) return;
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
