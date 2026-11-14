import type { Degree } from '../music/theory';
import type { Song, SongStep } from './types';

export class GuidedSession {
  private index = 0;
  private readonly steps: readonly SongStep[];

  constructor(song: Song) {
    if (song.steps.length === 0) throw new Error(`La canción "${song.id}" no tiene pasos (no steps)`);
    this.steps = song.steps;
  }

  current(): SongStep { return this.steps[Math.min(this.index, this.steps.length - 1)]!; }

  upcoming(n: number): SongStep[] {
    return this.steps.slice(this.index + 1, this.index + 1 + Math.max(0, n));
  }

  submit(d: Degree | null): 'hit' | 'wait' {
    if (this.isDone() || d === null || d !== this.steps[this.index]!.degree) return 'wait';
    this.index += 1;
    return 'hit';
  }

  isDone(): boolean { return this.index >= this.steps.length; }

  restart(): void { this.index = 0; }
}

/** Step active at a 0-based beat. Null if out of range (non-loop), negative or non-finite. */
export function stepAtBeat(
  steps: SongStep[], beat: number, loop: boolean,
): { index: number; step: SongStep } | null {
  if (!Number.isFinite(beat) || beat < 0 || steps.length === 0) return null;
  const total = steps.reduce((sum, s) => sum + s.beats, 0);
  if (!(total > 0)) return null;
  if (!loop && beat >= total) return null;
  const b = loop ? beat % total : beat;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    acc += steps[i]!.beats;
    if (b < acc) return { index: i, step: steps[i]! };
  }
  return null;
}
