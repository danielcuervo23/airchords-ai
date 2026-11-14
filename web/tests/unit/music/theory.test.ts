import { describe, it, expect } from 'vitest';
import { ALL_KEYS, chordForDegree, romanNumeral, type Key } from '../../../src/music/theory';

const C: Key = { tonic: 'C', mode: 'major' };
const Am: Key = { tonic: 'A', mode: 'minor' };
const B: Key = { tonic: 'B', mode: 'major' };

describe('chordForDegree', () => {
  it('C major I is C maj', () => {
    expect(chordForDegree(C, 1)).toEqual({
      degree: 1, root: 'C', quality: 'maj', notes: ['C3', 'E3', 'G3'], label: 'C',
    });
  });
  it('C major degrees 2, 3, 6 are minor', () => {
    for (const d of [2, 3, 6] as const) expect(chordForDegree(C, d).quality).toBe('min');
  });
  it('C major vii is B diminished', () => {
    const c = chordForDegree(C, 7);
    expect(c.quality).toBe('dim');
    expect(c.root).toBe('B');
    expect(c.label).toBe('B°');
  });
  it('A minor degrees', () => {
    expect(chordForDegree(Am, 1)).toMatchObject({ quality: 'min', notes: ['A3', 'C4', 'E4'], label: 'Am' });
    expect(chordForDegree(Am, 3)).toMatchObject({ quality: 'maj', root: 'C' });
    expect(chordForDegree(Am, 5)).toMatchObject({ quality: 'min', root: 'E' });
  });
  it('B major V is F# with octave crossing', () => {
    const c = chordForDegree(B, 5);
    expect(c.root).toBe('F#');
    expect(c.notes).toEqual(['F#3', 'A#3', 'C#4']);
  });
  it('honors custom octave', () => {
    expect(chordForDegree(C, 1, 4).notes).toEqual(['C4', 'E4', 'G4']);
  });
});

describe('ALL_KEYS and romanNumeral', () => {
  it('has 24 unique keys', () => {
    expect(ALL_KEYS.length).toBe(24);
    expect(new Set(ALL_KEYS.map((k) => k.tonic + k.mode)).size).toBe(24);
  });
  it('roman numerals', () => {
    expect(romanNumeral(C, 7)).toBe('vii°');
    expect(romanNumeral(C, 1)).toBe('I');
    expect(romanNumeral(C, 2)).toBe('ii');
    expect(romanNumeral(Am, 3)).toBe('III');
    expect(romanNumeral(Am, 2)).toBe('ii°');
  });
});
