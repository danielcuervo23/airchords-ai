import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8');

describe('no face model in v1 (the mouth switch and the face filter are gone)', () => {
  it('the tracker neither loads nor runs FaceLandmarker', () => {
    expect(read('src/vision/tracker.ts')).not.toMatch(/FaceLandmarker|face_landmarker/);
  });
  it('the fetch script no longer downloads face_landmarker.task', () => {
    expect(read('scripts/fetch-mediapipe.mjs')).not.toMatch(/face_landmarker/);
  });
});
