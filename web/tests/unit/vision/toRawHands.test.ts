import { describe, it, expect } from 'vitest';
import { toRawHands } from '../../../src/vision/toRawHands';

const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i / 100, y: 0.5, z: -0.1, visibility: 1 }));
const cat = (categoryName: string, score: number) => ({ categoryName, score, index: 0, displayName: '' });

describe('toRawHands', () => {
  it('maps handedness, landmarks and top gesture of each hand', () => {
    const hands = toRawHands({
      landmarks: [pts(21), pts(21)],
      handedness: [[cat('Left', 0.95)], [cat('Right', 0.8)]],
      gestures: [[cat('Victory', 0.9)], [cat('Open_Palm', 0.7)]],
    });
    expect(hands).toHaveLength(2);
    expect(hands[0].label).toBe('Left');
    expect(hands[0].score).toBe(0.95);
    expect(hands[0].landmarks[3]).toEqual({ x: 0.03, y: 0.5, z: -0.1 });
    expect(hands[0].gesture).toEqual({ name: 'Victory', score: 0.9 });
    expect(hands[1].label).toBe('Right');
    expect(hands[1].gesture).toEqual({ name: 'Open_Palm', score: 0.7 });
  });

  it('gives gesture null when none or unknown is reported', () => {
    const hands = toRawHands({
      landmarks: [pts(21), pts(21)],
      handedness: [[cat('Left', 0.9)], [cat('Right', 0.9)]],
      gestures: [[], [cat('Banana', 0.9)]],
    });
    expect(hands[0].gesture).toBeNull();
    expect(hands[1].gesture).toBeNull();
  });

  it('skips hands without a Left/Right label', () => {
    const hands = toRawHands({
      landmarks: [pts(21), pts(21)],
      handedness: [[], [cat('Right', 0.9)]],
      gestures: [[], []],
    });
    expect(hands).toHaveLength(1);
    expect(hands[0].label).toBe('Right');
  });

  it('returns an empty list for an empty result', () => {
    expect(toRawHands({ landmarks: [], handedness: [], gestures: [] })).toEqual([]);
  });
});
