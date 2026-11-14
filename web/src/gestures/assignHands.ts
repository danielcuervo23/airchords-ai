import type { GestureGuess, Landmark } from './types';

export interface RawHand {
  label: 'Left' | 'Right';
  score: number;
  landmarks: Landmark[];
  gesture: GestureGuess | null;
}

export interface AssignedHands {
  chordHand: RawHand | null;
  expressionHand: RawHand | null;
}

const LANDMARK_COUNT = 21;
const DEFAULT_MIN_SCORE = 0.6;

const inUnit = (v: number): boolean => Number.isFinite(v) && v >= 0 && v <= 1;

function isValid(hand: RawHand, minScore: number): boolean {
  return (
    Number.isFinite(hand.score) &&
    hand.score >= minScore &&
    hand.landmarks.length >= LANDMARK_COUNT &&
    hand.landmarks.every((p) => inUnit(p.x) && inUnit(p.y) && Number.isFinite(p.z))
  );
}

function best(hands: RawHand[]): RawHand | null {
  return hands.reduce<RawHand | null>((acc, h) => (acc === null || h.score > acc.score ? h : acc), null);
}

/**
 * The user's physical right hand plays the chords.
 * `labelsSwapped` = MediaPipe's Left/Right labels are the opposite of the user's
 * physical hands. When true, label 'Left' is the physical right hand (chordHand);
 * when false, label 'Right' is.
 */
export function assignHands(
  hands: RawHand[],
  opts: { labelsSwapped: boolean; minScore?: number },
): AssignedHands {
  const valid = hands.filter((h) => isValid(h, opts.minScore ?? DEFAULT_MIN_SCORE));
  const chordLabel = opts.labelsSwapped ? 'Left' : 'Right';
  return {
    chordHand: best(valid.filter((h) => h.label === chordLabel)),
    expressionHand: best(valid.filter((h) => h.label !== chordLabel)),
  };
}
