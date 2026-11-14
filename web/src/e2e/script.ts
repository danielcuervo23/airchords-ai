/** Test-only: the frames the fake tracker plays in Playwright. Pure so it can be unit-tested. */
import type { RawHand } from '../gestures/assignHands';
import type { VisionFrame } from '../vision/tracker';

export const HANDS_AFTER_MS = 800;

/** A plausible open hand shape, all points inside the frame (x 0.35..0.65, y 0.3..0.8). */
const LANDMARKS = Array.from({ length: 21 }, (_, i) => {
  const finger = i === 0 ? -1 : Math.floor((i - 1) / 4);
  const joint = i === 0 ? 0 : ((i - 1) % 4) + 1;
  return { x: 0.4 + Math.max(0, finger) * 0.05, y: 0.8 - joint * 0.1, z: 0 };
});

const RIGHT_POINTING: RawHand = {
  label: 'Right', score: 0.95, landmarks: LANDMARKS, gesture: { name: 'Pointing_Up', score: 0.9 },
};

export function scriptedFrame(elapsedMs: number): VisionFrame {
  return {
    t: elapsedMs,
    aspect: 4 / 3,
    hands: elapsedMs >= HANDS_AFTER_MS ? [RIGHT_POINTING] : [],
    face: null,
  };
}
