/** Pure mapping helpers for the audio engine (no Tone.js, fully testable). */

export const MIN_CUTOFF_HZ = 400;
export const MAX_CUTOFF_HZ = 8000;
export const SILENCE_DB = -60;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

/** Brightness 0..1 -> lowpass cutoff, exponential (equal steps feel equal in pitch). */
export function brightnessToHz(brightness: number): number {
  return MIN_CUTOFF_HZ * (MAX_CUTOFF_HZ / MIN_CUTOFF_HZ) ** clamp01(brightness);
}

/** Volume 0..1 -> dB with a gentle curve (1 -> 0 dB, 0.5 -> -12 dB), floored at -60 dB. */
export function volumeToDb(volume: number): number {
  if (!(volume > 0)) return SILENCE_DB;
  return Math.max(SILENCE_DB, 40 * Math.log10(Math.min(1, volume)));
}

/** Start offsets (ms) of each note of a strum, spread evenly over `spreadMs`. */
export function strumOffsets(count: number, spreadMs: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) => (i * spreadMs) / (count - 1));
}

const MIN_BPM = 30;
const MAX_BPM = 240;
const DEFAULT_BPM = 90;

/** One strum per beat; bpm is clamped to 30..240 and NaN falls back to 90. */
export function strumIntervalMs(bpm: number): number {
  const safe = Number.isFinite(bpm) ? Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)) : DEFAULT_BPM;
  return 60000 / safe;
}

/** Moves note names such as 'C#3' by whole octaves. */
export function shiftOctave(notes: string[], octaves: number): string[] {
  return notes.map((n) => n.replace(/-?\d+$/, (o) => String(Number(o) + octaves)));
}

/** Samples last about 3 s, so held sampled pads are re-triggered a bit before they die out. */
const SAMPLE_REFRESH_MS = 2400;

/** How often a held chord is re-played: strum presets at the pulse, sampled pads on refresh, synth pads never. */
export function repeatIntervalMs(behavior: 'sustain' | 'strum', hasSamples: boolean, bpm: number): number | null {
  if (behavior === 'strum') return strumIntervalMs(bpm);
  return hasSamples ? SAMPLE_REFRESH_MS : null;
}
