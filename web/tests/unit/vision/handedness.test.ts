import { describe, it, expect } from 'vitest';
import { HANDEDNESS_LABELS_SWAPPED } from '../../../src/vision/tracker';

// Verified with a real camera on 2026-11-14: raising ONLY the user's LEFT hand
// was labelled as the chord hand ("DERECHA") while HANDEDNESS_LABELS_SWAPPED was true.
// With `false`, MediaPipe's labels already match the physical hands.
describe('HANDEDNESS_LABELS_SWAPPED', () => {
  it('is false (verified with a real camera on 2026-11-14)', () => {
    expect(HANDEDNESS_LABELS_SWAPPED).toBe(false);
  });
});
