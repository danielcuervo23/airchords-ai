import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { parseRecording } from '../../../src/dev/recording';
import { assignHands } from '../../../src/gestures/assignHands';
import { degreeFromGesture } from '../../../src/gestures/degree';
import { HANDEDNESS_LABELS_SWAPPED } from '../../../src/vision/tracker';
import type { Degree } from '../../../src/music/theory';

const SIGNS: Degree[] = [1, 2, 3, 4, 5, 6, 7];
const SETTLE_RUN = 3;
const MAX_SETTLE_FRAMES_AFTER_FIRST_HAND = 8;
const MIN_ACCURACY = 0.95;

function degreesOf(sign: Degree): { target: Degree | 'none'; degrees: (Degree | null)[]; firstHand: number } {
  const url = new URL(`../../fixtures/hands/sign-${sign}.json`, import.meta.url);
  const rec = parseRecording(readFileSync(url, 'utf8'));
  const degrees = rec.frames.map((f) => {
    const { chordHand } = assignHands(f.hands, { labelsSwapped: HANDEDNESS_LABELS_SWAPPED });
    return degreeFromGesture(chordHand?.gesture ?? null);
  });
  const firstHand = rec.frames.findIndex((f) => f.hands.length > 0);
  return { target: rec.gesture, degrees, firstHand };
}

function settleIndex(degrees: (Degree | null)[], target: Degree): number {
  for (let i = 0; i + SETTLE_RUN <= degrees.length; i++) {
    if (degrees.slice(i, i + SETTLE_RUN).every((d) => d === target)) return i;
  }
  return -1;
}

describe('recorded real hand signs (gesture to degree)', () => {
  for (const sign of SIGNS) {
    describe(`sign ${sign}`, () => {
      const { target, degrees, firstHand } = degreesOf(sign);

      it('is labelled with its own degree', () => {
        expect(target).toBe(sign);
      });

      // The count starts at the first frame that contains a hand: leading empty frames
      // are just the recording starting before the user raised their hand.
      it(`settles within ${MAX_SETTLE_FRAMES_AFTER_FIRST_HAND} frames of the first hand frame`, () => {
        const idx = settleIndex(degrees, sign);
        expect(firstHand).toBeGreaterThanOrEqual(0);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx - firstHand).toBeLessThan(MAX_SETTLE_FRAMES_AFTER_FIRST_HAND);
      });

      // Frames before settling are the hand entering the picture: a real transition
      // that the Stabilizer handles, so they are not part of the accuracy criterion.
      // After settling, nulls are allowed but a DIFFERENT degree is never acceptable.
      it('after settling: >= 95% correct and never a different degree', () => {
        const idx = settleIndex(degrees, sign);
        expect(idx).toBeGreaterThanOrEqual(0);
        const settled = degrees.slice(idx);
        const correct = settled.filter((d) => d === sign).length;
        const wrong = settled.filter((d) => d !== null && d !== sign);
        expect(wrong).toEqual([]);
        expect(correct / settled.length).toBeGreaterThanOrEqual(MIN_ACCURACY);
      });
    });
  }
});
