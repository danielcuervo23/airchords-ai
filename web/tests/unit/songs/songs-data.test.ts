import { describe, expect, it } from 'vitest';
import city from '../../../src/songs/data/city-of-stars.json';
import cant from '../../../src/songs/data/cant-take-my-eyes-off-you.json';
import glimpse from '../../../src/songs/data/glimpse-of-us.json';
import { SONGS, validateSong } from '../../../src/songs';

const raw = [city, cant, glimpse] as Record<string, unknown>[];
const TOP = ['id', 'title', 'artist', 'key', 'bpm', 'steps'];
const STEP = ['degree', 'beats', 'note'];

describe('song data files', () => {
  it('SONGS exposes the three songs', () => {
    expect(SONGS.map((s) => s.id).sort()).toEqual(['cant-take-my-eyes-off-you', 'city-of-stars', 'glimpse-of-us']);
  });
  for (const j of raw) {
    describe(String(j.id), () => {
      it('has only chord-related keys (no melody or lyrics)', () => {
        expect(Object.keys(j).every((k) => TOP.includes(k))).toBe(true);
        for (const st of j.steps as Record<string, unknown>[]) {
          expect(Object.keys(st).every((k) => STEP.includes(k))).toBe(true);
        }
      });
      it('passes the schema', () => {
        const s = validateSong(j);
        expect(s.bpm).toBeGreaterThanOrEqual(50);
        expect(s.bpm).toBeLessThanOrEqual(200);
        expect(s.title.length).toBeGreaterThan(0);
        expect(s.artist.length).toBeGreaterThan(0);
        expect(s.steps.length).toBeGreaterThanOrEqual(8);
        expect(s.steps.length).toBeLessThanOrEqual(32);
      });
    });
  }
});

describe('song metadata', () => {
  const by = (id: string) => SONGS.find((s) => s.id === id)!;
  it('uses the performing artist and original keys', () => {
    expect(by('city-of-stars').artist).toBe('Ryan Gosling & Emma Stone (La La Land)');
    expect(by('cant-take-my-eyes-off-you').artist).toBe('Frankie Valli');
    expect(by('glimpse-of-us').artist).toBe('Joji');
    expect(by('glimpse-of-us').key).toEqual({ tonic: 'G#', mode: 'major' });
    expect(by('cant-take-my-eyes-off-you').key).toEqual({ tonic: 'E', mode: 'major' });
    expect(by('city-of-stars').key).toEqual({ tonic: 'D', mode: 'minor' });
  });
  it('Cant Take chorus follows Hooktheory: ii vi V iii vi', () => {
    expect(by('cant-take-my-eyes-off-you').steps.slice(9).map((s) => s.degree)).toEqual([2, 6, 5, 3, 6]);
  });
});

describe('validateSong', () => {
  const ok = { id: 'x', title: 'X', artist: 'Y', key: { tonic: 'C', mode: 'major' }, bpm: 100, steps: [{ degree: 1, beats: 4 }] };
  it('accepts valid data', () => expect(validateSong(ok).id).toBe('x'));
  it('rejects a note longer than 80 characters', () => {
    const long = 'x'.repeat(81);
    expect(() => validateSong({ ...ok, steps: [{ degree: 1, beats: 4, note: long }] })).toThrow();
    expect(validateSong({ ...ok, steps: [{ degree: 1, beats: 4, note: 'x'.repeat(80) }] }).steps).toHaveLength(1);
  });
  it.each([
    ['null', null],
    ['no artist', { ...ok, artist: '' }],
    ['bad bpm', { ...ok, bpm: 300 }],
    ['bad tonic', { ...ok, key: { tonic: 'H', mode: 'major' } }],
    ['bad mode', { ...ok, key: { tonic: 'C', mode: 'dorian' } }],
    ['no steps', { ...ok, steps: [] }],
    ['degree 8', { ...ok, steps: [{ degree: 8, beats: 4 }] }],
    ['beats 0', { ...ok, steps: [{ degree: 1, beats: 0 }] }],
    ['extra key', { ...ok, melody: [1, 2] }],
    ['extra step key', { ...ok, steps: [{ degree: 1, beats: 4, lyrics: 'la' }] }],
    ['note not string', { ...ok, steps: [{ degree: 1, beats: 4, note: 3 }] }],
  ])('rejects %s', (_n, v) => expect(() => validateSong(v)).toThrow());
});
