import * as Tone from 'tone';
import type { Chord } from '../music/theory';
import type { Expression } from '../gestures/expression';
import { brightnessToHz, repeatIntervalMs, shiftOctave, strumOffsets, volumeToDb } from './mapping';
import { PRESETS, REGISTER_SHIFT, type Preset, type PresetId } from './presets';

export interface SoundEngine {
  start(): Promise<void>;
  setPreset(id: PresetId): Promise<void>;
  playChord(chord: Chord): void;
  release(fadeMs?: number): void;
  setExpression(e: Expression): void;
  setBpm(bpm: number): void;
}

/** Minimal voice contract: every instrument (sampler, synths, pluck) is wrapped to this. */
interface Voice {
  /** Start `notes` at `time` (seconds), each delayed by the matching offset (ms). */
  play(notes: string[], time: number, offsetsMs: number[]): void;
  stop(time: number): void;
  readonly node: Tone.ToneAudioNode;
}

const STRUM_SPREAD_MS = 60;
const SMOOTH_S = 0.05;
const LOOK_AHEAD_S = 0.02; // low latency: sound starts well under 100 ms after playChord

function synthVoice(options: ConstructorParameters<typeof Tone.Synth>[0], volumeDb = 0): Voice {
  const synth = new Tone.PolySynth(Tone.Synth, options);
  synth.volume.value = volumeDb;
  return {
    node: synth,
    play: (notes, time) => synth.triggerAttack(notes, time),
    stop: (time) => synth.releaseAll(time),
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
      release: sustain ? 0.8 : 1.2,
      onload: () =>
        resolve({
          node: sampler,
          play: (ns, time, offs) => ns.forEach((n, i) => sampler.triggerAttack(n, time + (offs[i] ?? 0) / 1000)),
          stop: (time) => sampler.releaseAll(time),
        }),
      onerror: (e) => reject(e),
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
 * register) live in the pure `mapping` / `presets` modules.
 * Chord roots are anchored at octave 3 for every degree, so the voicing is already even;
 * only per-instrument register shifts (violin +1 octave) are applied.
 */
export class ToneEngine implements SoundEngine {
  private readonly voices = new Map<PresetId, Voice>();
  private readonly voiceGain = new Tone.Gain(1);
  private readonly filter = new Tone.Filter({ type: 'lowpass', frequency: brightnessToHz(0.5), rolloff: -12 });
  private readonly volume = new Tone.Volume(volumeToDb(0.7));
  private preset: Preset = PRESETS[0]!;
  private voice: Voice | null = null;
  private bpm = 90;
  private held: Chord | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;

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
    let voice = this.voices.get(id);
    if (!voice) {
      voice = await buildVoice(preset);
      this.voices.set(id, voice);
    }
    this.hardStop();
    this.preset = preset;
    this.voice = voice;
    voice.node.disconnect();
    voice.node.connect(this.voiceGain);
  }

  playChord(chord: Chord): void {
    if (!this.voice) return;
    this.clearStopTimer();
    this.voiceGain.gain.cancelScheduledValues(Tone.now());
    this.voiceGain.gain.value = 1;
    this.held = chord;
    this.trigger();
    this.restartPulse();
  }

  release(fadeMs = 250): void {
    this.clearPulse();
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
    if (this.held) this.restartPulse();
  }

  private trigger(): void {
    if (!this.voice || !this.held) return;
    const notes = shiftOctave(this.held.notes, REGISTER_SHIFT[this.preset.id] ?? 0);
    const time = Tone.now() + LOOK_AHEAD_S;
    // New notes cross-fade with the old ones through the voices' own attack/release envelopes.
    if (this.preset.behavior === 'strum') {
      this.voice.play(notes, time, strumOffsets(notes.length, STRUM_SPREAD_MS));
    } else {
      this.voice.stop(time);
      this.voice.play(notes, time, notes.map(() => 0));
    }
  }

  private restartPulse(): void {
    this.clearPulse();
    const every = repeatIntervalMs(this.preset.behavior, !!this.preset.samples, this.bpm);
    if (every !== null) this.timer = setInterval(() => this.trigger(), every);
  }

  private hardStop(): void {
    this.clearPulse();
    this.clearStopTimer();
    this.held = null;
    this.voice?.stop(Tone.now());
  }

  private clearPulse(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private clearStopTimer(): void {
    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.stopTimer = null;
  }
}
