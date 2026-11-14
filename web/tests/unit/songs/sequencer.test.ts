import { describe, expect, it } from 'vitest';
import { GuidedSession, stepAtBeat } from '../../../src/songs/sequencer';
import type { Song, SongStep } from '../../../src/songs/types';

const song: Song = {
  id: 't', title: 'T', artist: 'A', key: { tonic: 'C', mode: 'major' }, bpm: 100,
  steps: [{ degree: 1, beats: 4 }, { degree: 5, beats: 4 }, { degree: 6, beats: 2 }],
};

describe('GuidedSession', () => {
  it('hit on the right degree advances', () => {
    const s = new GuidedSession(song);
    expect(s.current().degree).toBe(1);
    expect(s.submit(1)).toBe('hit');
    expect(s.current().degree).toBe(5);
  });
  it('wait on a wrong degree or null does not advance', () => {
    const s = new GuidedSession(song);
    expect(s.submit(3)).toBe('wait');
    expect(s.submit(null)).toBe('wait');
    expect(s.current().degree).toBe(1);
  });
  it('finishes and ignores further submits', () => {
    const s = new GuidedSession(song);
    s.submit(1); s.submit(5);
    expect(s.isDone()).toBe(false);
    expect(s.submit(6)).toBe('hit');
    expect(s.isDone()).toBe(true);
    expect(s.submit(6)).toBe('wait');
  });
  it('upcoming returns following steps, fewer near the end', () => {
    const s = new GuidedSession(song);
    expect(s.upcoming(2).map((x) => x.degree)).toEqual([5, 6]);
    expect(s.upcoming(5)).toHaveLength(2);
    s.submit(1);
    expect(s.upcoming(3).map((x) => x.degree)).toEqual([6]);
  });
  it('restart goes back to step 0', () => {
    const s = new GuidedSession(song);
    s.submit(1); s.restart();
    expect(s.current().degree).toBe(1);
    expect(s.isDone()).toBe(false);
  });
  it('throws for an empty song', () => {
    expect(() => new GuidedSession({ ...song, steps: [] })).toThrow(/sin pasos|no steps/i);
  });
});

describe('stepAtBeat', () => {
  const steps: SongStep[] = [{ degree: 1, beats: 4 }, { degree: 4, beats: 4 }];
  it('maps beats to steps', () => {
    expect(stepAtBeat(steps, 0, false)?.index).toBe(0);
    expect(stepAtBeat(steps, 3.99, false)?.index).toBe(0);
    expect(stepAtBeat(steps, 5, false)?.index).toBe(1);
    expect(stepAtBeat(steps, 5, false)?.step.degree).toBe(4);
  });
  it('loops or ends', () => {
    expect(stepAtBeat(steps, 9, true)?.index).toBe(0);
    expect(stepAtBeat(steps, 8, false)).toBeNull();
  });
  it('rejects negative and non-finite beats', () => {
    expect(stepAtBeat(steps, -1, true)).toBeNull();
    expect(stepAtBeat(steps, NaN, true)).toBeNull();
    expect(stepAtBeat(steps, Infinity, false)).toBeNull();
  });
  it('handles fractional beats and empty steps', () => {
    const f: SongStep[] = [{ degree: 1, beats: 1.5 }, { degree: 2, beats: 0.5 }];
    expect(stepAtBeat(f, 1.5, false)?.index).toBe(1);
    expect(stepAtBeat(f, 2.2, true)?.index).toBe(0);
    expect(stepAtBeat([], 1, true)).toBeNull();
  });
});
