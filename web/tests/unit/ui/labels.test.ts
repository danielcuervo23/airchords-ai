import { describe, expect, it } from 'vitest';
import { ALL_KEYS, chordForDegree } from '../../../src/music/theory';
import { chordNameEs, keyNameEs, noteNameEs, signFor, SIGNS } from '../../../src/ui/labels';

describe('Spanish labels', () => {
  it('names natural and sharp notes', () => {
    expect(noteNameEs('C')).toBe('Do');
    expect(noteNameEs('F#')).toBe('Fa sostenido');
    expect(noteNameEs('B')).toBe('Si');
  });
  it('names keys', () => {
    expect(keyNameEs({ tonic: 'C', mode: 'major' })).toBe('Do mayor');
    expect(keyNameEs({ tonic: 'D', mode: 'minor' })).toBe('Re menor');
  });
  it('gives the 24 keys 24 distinct names', () => {
    expect(new Set(ALL_KEYS.map(keyNameEs)).size).toBe(24);
  });
  it('names chords by quality', () => {
    const c = { tonic: 'C', mode: 'major' } as const;
    expect(chordNameEs(chordForDegree(c, 1))).toBe('Do mayor');
    expect(chordNameEs(chordForDegree(c, 2))).toBe('Re menor');
    expect(chordNameEs(chordForDegree(c, 7))).toBe('Si disminuido');
  });
  it('has one sign per degree, matching the gesture table order', () => {
    expect(SIGNS.map((s) => s.degree)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(signFor(1)).toMatchObject({ emoji: '☝️', name: 'Índice arriba' });
    expect(signFor(4)).toMatchObject({ emoji: '👍', name: 'Pulgar arriba' });
    expect(signFor(7)).toMatchObject({ emoji: '✊', name: 'Puño cerrado' });
  });
});
