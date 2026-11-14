import type { Degree } from '../music/theory';
import type { GestureGuess, GestureName } from './types';

export const GESTURE_TO_DEGREE: Record<Exclude<GestureName, 'None'>, Degree> = {
  Pointing_Up: 1,
  Victory: 2,
  ILoveYou: 3,
  Thumb_Up: 4,
  Open_Palm: 5,
  Thumb_Down: 6,
  Closed_Fist: 7,
};

const DEFAULT_MIN_SCORE = 0.6;

/**
 * Maps a recognized gesture to its scale degree.
 * Returns null when there is no hand, the gesture is 'None', or the score is below minScore (inclusive threshold).
 */
export function degreeFromGesture(g: GestureGuess | null, minScore: number = DEFAULT_MIN_SCORE): Degree | null {
  if (g === null) return null;
  if (g.name === 'None') return null;
  // Written as a negated >= so that NaN fails closed (NaN < minScore is false).
  if (!(g.score >= minScore)) return null;
  // Runtime strings are not trusted: reject unknown names and inherited keys such as 'constructor'.
  if (!Object.hasOwn(GESTURE_TO_DEGREE, g.name)) return null;
  return GESTURE_TO_DEGREE[g.name as Exclude<GestureName, 'None'>];
}
