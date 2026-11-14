import { describe, it, expect } from 'vitest';
import { assignHands, type RawHand } from '../../../src/gestures/assignHands';

function hand(label: 'Left' | 'Right', score: number, overrides: Partial<{ x: number }> = {}): RawHand {
  const landmarks = Array.from({ length: 21 }, (_, i) => ({ x: 0.2 + i * 0.01, y: 0.5, z: 0 }));
  if (overrides.x !== undefined) landmarks[8] = { x: overrides.x, y: 0.5, z: 0 };
  return { label, score, landmarks, gesture: null };
}

// MediaPipe docs (https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker):
// "Left and Right handedness correspond to the subject's hands, not the viewer" and
// "Passing a horizontally mirrored image will invert these outputs."
// `labelsSwapped` means: MediaPipe's Left/Right labels are the OPPOSITE of the user's
// physical hands. The user's physical right hand always plays the chords, so:
//   labelsSwapped = true  -> label 'Left' is the physical right hand (chordHand)
//   labelsSwapped = false -> label 'Right' is the physical right hand (chordHand)
// The real camera needs `false` (verified 2026-11-14; see HANDEDNESS_LABELS_SWAPPED).
describe('assignHands', () => {
  it('labelsSwapped true: label Left is the physical right hand (chordHand)', () => {
    const left = hand('Left', 0.9);
    const right = hand('Right', 0.9);
    const r = assignHands([left, right], { labelsSwapped: true });
    expect(r.chordHand).toBe(left);
    expect(r.expressionHand).toBe(right);
  });

  it('labelsSwapped false: label Right is the physical right hand (chordHand)', () => {
    const left = hand('Left', 0.9);
    const right = hand('Right', 0.9);
    const r = assignHands([left, right], { labelsSwapped: false });
    expect(r.chordHand).toBe(right);
    expect(r.expressionHand).toBe(left);
  });

  it('ignores a hand with score below minScore (default 0.6)', () => {
    const r = assignHands([hand('Left', 0.5)], { labelsSwapped: true });
    expect(r.chordHand).toBeNull();
    expect(assignHands([hand('Left', 0.5)], { labelsSwapped: true, minScore: 0.4 }).chordHand).not.toBeNull();
  });

  it('ignores a hand with any landmark outside [0,1]', () => {
    expect(assignHands([hand('Left', 0.9, { x: 1.08 })], { labelsSwapped: true }).chordHand).toBeNull();
    expect(assignHands([hand('Left', 0.9, { x: -0.01 })], { labelsSwapped: true }).chordHand).toBeNull();
  });

  it('ignores non-finite values and hands with fewer than 21 landmarks', () => {
    expect(assignHands([hand('Left', 0.9, { x: NaN })], { labelsSwapped: true }).chordHand).toBeNull();
    const short = { ...hand('Left', 0.9), landmarks: hand('Left', 0.9).landmarks.slice(0, 20) };
    expect(assignHands([short], { labelsSwapped: true }).chordHand).toBeNull();
    const badScore = hand('Left', NaN);
    expect(assignHands([badScore], { labelsSwapped: true }).chordHand).toBeNull();
  });

  it('keeps the highest score when several hands map to one side', () => {
    const best = hand('Left', 0.9);
    const worse = hand('Left', 0.7);
    const other = hand('Right', 0.8);
    for (const order of [[best, worse, other], [worse, best, other]]) {
      const r = assignHands(order, { labelsSwapped: true });
      expect(r.chordHand).toBe(best);
      expect(r.expressionHand).toBe(other);
    }
  });

  it('returns null on both sides with no hands', () => {
    expect(assignHands([], { labelsSwapped: true })).toEqual({ chordHand: null, expressionHand: null });
  });
});
