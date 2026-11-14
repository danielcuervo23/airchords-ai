import * as Tone from 'tone';
import type { Chord } from '../music/theory';
import type { Expression } from '../gestures/expression';
import { createLatestWins, createPulse } from './control';
import { brightnessToHz, repeatIntervalMs, shiftOctave, strumOffsets, volumeToDb } from './mapping';
import { PRESETS, REGISTER_SHIFT, type Preset, type PresetId } from './presets';

export interface SoundEngine {
  start(): Promise<void>;
  setPreset(id: PresetId): Promise<void>;
  playChord(chord: Chord): void;
  release(fadeMs?: number): void;
  setExpression(e: Expression): void;
  setBpm(bpm: number): void;
  /** Stops timers and frees every audio node. The engine cannot be used afterwards. */
  dispose(): void;
}

/** Minimal voice contract: every instrument (sampler, synths, pluck) is wrapped to this. */
interface Voice {
  /** Start `notes` at `time` (seconds), each delayed by the matching offset (ms). */
  play(notes: string[], time: number, offsetsMs: number[]): void;
  stop(time: number): void;
  readonly node: Tone.ToneAudioNode;
  dispose(): void;
}

const STRUM_SPREAD_MS = 60;
const SMOOTH_S = 0.05;
const GAIN_RESTORE_S = 0.01; // short ramp back to full gain on a new chord (no click)
const STRUM_RELEASE_S = 0.15; // previous strummed notes fade this fast, so chords do not stack
const LOOK_AHEAD_S = 0.02; // low latency: sound starts well under 100 ms after playChord

function synthVoice(options: ConstructorParameters<typeof Tone.Synth>[0], volumeDb = 0): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, options);
  synth.volume.value = volumeDb;
  return {
    node: synth,
    play: (notes, time) => synth.triggerAttack(notes, time),
    stop: (time) => synth.releaseAll(time),
    dispose: () => synth.dispose(),
  };
}

function samplerVoice(preset: Preset): Promise<Voice> {
  const { baseUrl, notes } = preset.samples!;
  const sustain = preset.behavior === 'sustain';
  return new Promise((resolve, reject) => {
    const sampler: Tone.Sampler = new Tone.Sampler({
      urls: notes,
      baseUrl,
      attack: sustain ? 0.3 : 0.005,
      release: sustain ? 0.8 : STRUM_RELEASE_S,
      onload: () =>
        resolve({
          node: sampler,
          play: (ns, time, offs) => ns.forEach((n, i) => sampler.triggerAttack(n, time + (offs[i] ?? 0) / 1000)),
          stop: (time) => sampler.releaseAll(time),
          dispose: () => sampler.dispose(),
        }),
      onerror: (e) => {
        sampler.dispose(); // do not leak a Sampler whose load failed
        reject(e);
      },
    });
  });
}

function pluckVoice(): Voice {
  const out = new Tone.Gain(1);
  const plucks = Array.from(
    { length: 4 },
    () => new Tone.PluckSynth({ attackNoise: 1.2, dampening: 3500, resonance: 0.96 }).connect(out),
  );
  return {
    node: out,
    play: (notes, time, offs) =>
      notes.forEach((n, i) => plucks[i % plucks.length]!.triggerAttack(n, time + (offs[i] ?? 0) / 1000)),
    stop: () => undefined, // plucks decay on their own
    dispose: () => {
      plucks.forEach((p) => p.dispose());
      out.dispose();
    },
  };
}

async function buildVoice(preset: Preset): Promise<Voice> {
  switch (preset.id) {
    case 'piano':
    case 'violin':
      return samplerVoice(preset);
    case 'guitarra':
      return pluckVoice();
    case 'calido':
      return synthVoice({ oscillator: { type: 'triangle' }, envelope: { attack: 0.25, decay: 0.2, sustain: 0.85, release: 0.6 } });
    case 'cristal':
      return synthVoice({ oscillator: { type: 'sine' }, envelope: { attack: 0.04, decay: 0.4, sustain: 0.6, release: 1.4 } }, -4);
    case '8bit':
      return synthVoice({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.05, sustain: 0.9, release: 0.08 } }, -12);
    case 'nube':
      return synthVoice({ oscillator: { type: 'fatsawtooth', count: 3, spread: 25 }, envelope: { attack: 0.8, decay: 0.3, sustain: 0.9, release: 1.6 } }, -10);
  }
}

/**
 * Thin Tone.js adapter. Signal chain: voice -> voiceGain (release fade) -> lowpass
 * (brightness) -> Volume (expression) -> destination. Decisions (timings, mapping,
 * register, race handling) live in the pure `mapping` / `presets` / `control` modules.
 * Chord roots are anchored at octave 3 for every degree, so the voicing is already even;
 * only per-instrument register shifts (violin +1 octave) are applied.
 */
export class ToneEngine implements SoundEngine {
  private readonly loader = createLatestWins((id: PresetId) => buildVoice(PRESETS.find((p) => p.id === id)!));
  private readonly pulse = createPulse<ReturnType<typeof setInterval>>({
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h),
  });
  private readonly voiceGain = new Tone.Gain(1);
  private readonly filter = new Tone.Filter({ type: 'lowpass', frequency: brightnessToHz(0.5), rolloff: -12 });
  private readonly volume = new Tone.Volume(volumeToDb(0.7));
  private preset: Preset = PRESETS[0]!;
  private voice: Voice | null = null;
  private bpm = 90;
  private held: Chord | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor() {
    Tone.getContext().lookAhead = LOOK_AHEAD_S;
    this.voiceGain.chain(this.filter, this.volume, Tone.getDestination());
  }

  async start(): Promise<void> {
    await Tone.start();
  }

  async setPreset(id: PresetId): Promise<void> {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) throw new Error(`Unknown preset: ${id}`);
    const { value: voice, stale } = await this.loader.request(id);
    if (stale || this.disposed) return; // a newer setPreset call (or dispose) won while this one loaded
    this.hardStop();
    this.voice?.node.disconnect();
    this.preset = preset;
    this.voice = voice;
    voice.node.connect(this.voiceGain);
  }

  playChord(chord: Chord): void {
    if (!this.voice || this.disposed) return;
    this.clearStopTimer();
    const gain = this.voiceGain.gain;
    gain.cancelScheduledValues(Tone.now());
    gain.rampTo(1, GAIN_RESTORE_S);
    this.held = chord;
    this.trigger();
    this.pulse.stop(); // a new chord restarts the beat
    this.syncPulse();
  }

  release(fadeMs = 250): void {
    this.pulse.stop();
    this.held = null;
    if (!this.voice) return;
    const fade = Math.max(0, fadeMs) / 1000;
    this.voiceGain.gain.cancelScheduledValues(Tone.now());
    this.voiceGain.gain.rampTo(0, fade);
    this.clearStopTimer();
    const voice = this.voice;
    this.stopTimer = setTimeout(() => voice.stop(Tone.now()), fadeMs + 20);
  }

  setExpression(e: Expression): void {
    this.volume.volume.rampTo(volumeToDb(e.volume), SMOOTH_S);
    this.filter.frequency.rampTo(brightnessToHz(e.brightness), SMOOTH_S);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.held) this.syncPulse(); // restarts only if the beat length really changed
  }

  dispose(): void {
    this.disposed = true;
    this.hardStop();
    this.voice?.node.disconnect();
    this.voice = null;
    this.loader.values().forEach((v) => v.dispose());
    this.voiceGain.dispose();
    this.filter.dispose();
    this.volume.dispose();
  }

  private trigger(): void {
    if (!this.voice || !this.held) return;
    const notes = shiftOctave(this.held.notes, REGISTER_SHIFT[this.preset.id] ?? 0);
    const time = Tone.now() + LOOK_AHEAD_S;
    // Release the previous notes first. Sustain pads cross-fade through their own envelopes;
    // strum voices fade in STRUM_RELEASE_S so chords do not stack.
    this.voice.stop(time);
    const offsets = this.preset.behavior === 'strum' ? strumOffsets(notes.length, STRUM_SPREAD_MS) : notes.map(() => 0);
    this.voice.play(notes, time, offsets);
  }

  private syncPulse(): void {
    this.pulse.set(repeatIntervalMs(this.preset.behavior, !!this.preset.samples, this.bpm), () => this.trigger());
  }

  private hardStop(): void {
    this.pulse.stop();
    this.clearStopTimer();
    this.held = null;
    this.voice?.stop(Tone.now());
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.stopTimer = null;
  }
}
