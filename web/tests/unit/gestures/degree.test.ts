import { describe, it, expect } from 'vitest';
import { GESTURE_TO_DEGREE, degreeFromGesture } from '../../../src/gestures/degree';
import type { GestureName } from '../../../src/gestures/types';
import type { Degree } from '../../../src/music/theory';

describe('GESTURE_TO_DEGREE', () => {
  it('maps the seven gestures to their scale degrees', () => {
    expect(GESTURE_TO_DEGREE).toEqual({
      Pointing_Up: 1,
      Victory: 2,
      ILoveYou: 3,
      Thumb_Up: 4,
      Open_Palm: 5,
      Thumb_Down: 6,
      Closed_Fist: 7,
    });
  });

  it('uses each degree 1 to 7 exactly once', () => {
    const degrees = Object.values(GESTURE_TO_DEGREE).sort((a, b) => a - b);
    expect(degrees).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('degreeFromGesture', () => {
  const cases: [Exclude<GestureName, 'None'>, Degree][] = [
    ['Pointing_Up', 1],
    ['Victory', 2],
    ['ILoveYou', 3],
    ['Thumb_Up', 4],
    ['Open_Palm', 5],
    ['Thumb_Down', 6],
    ['Closed_Fist', 7],
  ];

  it.each(cases)('%s with score 0.9 gives its degree', (name, degree) => {
    expect(degreeFromGesture({ name, score: 0.9 })).toBe(degree);
  });

  it('None gives null', () => {
    expect(degreeFromGesture({ name: 'None', score: 0.99 })).toBeNull();
  });

  it('null input (no hand) gives null', () => {
    expect(degreeFromGesture(null)).toBeNull();
  });

  it('score below the default 0.6 gives null', () => {
    expect(degreeFromGesture({ name: 'Victory', score: 0.59 })).toBeNull();
  });

  it('score exactly 0.6 passes (inclusive) and gives the degree', () => {
    expect(degreeFromGesture({ name: 'Victory', score: 0.6 })).toBe(2);
  });

  it('honors a custom minScore', () => {
    expect(degreeFromGesture({ name: 'Victory', score: 0.7 }, 0.8)).toBeNull();
    expect(degreeFromGesture({ name: 'Victory', score: 0.8 }, 0.8)).toBe(2);
  });

  it('unknown gesture name gives null (runtime strings are not trusted)', () => {
    expect(degreeFromGesture({ name: 'Pointing_Down' as GestureName, score: 0.9 })).toBeNull();
    expect(degreeFromGesture({ name: '' as GestureName, score: 0.9 })).toBeNull();
  });

  it('prototype key names give null, not inherited functions', () => {
    expect(degreeFromGesture({ name: 'constructor' as GestureName, score: 0.9 })).toBeNull();
    expect(degreeFromGesture({ name: 'toString' as GestureName, score: 0.9 })).toBeNull();
  });

  it('NaN score gives null (fails closed)', () => {
    expect(degreeFromGesture({ name: 'Victory', score: Number.NaN })).toBeNull();
  });
});
