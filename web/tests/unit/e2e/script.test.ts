import { describe, expect, it } from 'vitest';
import { assignHands } from '../../../src/gestures/assignHands';
import { degreeFromGesture } from '../../../src/gestures/degree';
import { HANDS_AFTER_MS, scriptedFrame } from '../../../src/e2e/script';

describe('scripted e2e frames', () => {
  it('shows no hands at first', () => {
    expect(scriptedFrame(0).hands).toEqual([]);
    expect(scriptedFrame(HANDS_AFTER_MS - 1).hands).toEqual([]);
  });
  it('then a valid right hand pointing up, which the real pipeline reads as degree I', () => {
    const f = scriptedFrame(HANDS_AFTER_MS + 10);
    const { chordHand } = assignHands(f.hands, { labelsSwapped: false });
    expect(chordHand).not.toBeNull();
    expect(degreeFromGesture(chordHand!.gesture)).toBe(1);
    expect(f.face).toBeNull();
    expect(f.aspect).toBeCloseTo(4 / 3);
  });
});
