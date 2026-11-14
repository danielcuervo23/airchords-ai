import { describe, it, expect } from 'vitest';
import { mouthOpenness, MouthTrigger } from '../../../src/gestures/mouth';
import type { Landmark } from '../../../src/gestures/types';

function face(opts: { upperY: number; lowerY: number; leftX: number; rightX: number }): Landmark[] {
  const f: Landmark[] = Array.from({ length: 468 }, () => ({ x: 0, y: 0, z: 0 }));
  f[13] = { x: 0.5, y: opts.upperY, z: 0 };
  f[14] = { x: 0.5, y: opts.lowerY, z: 0 };
  f[61] = { x: opts.leftX, y: 0.6, z: 0 };
  f[291] = { x: opts.rightX, y: 0.6, z: 0 };
  return f;
}

describe('mouthOpenness', () => {
  it('is lip gap divided by mouth width', () => {
    expect(mouthOpenness(face({ upperY: 0.6, lowerY: 0.65, leftX: 0.4, rightX: 0.6 }))).toBeCloseTo(0.25, 6);
  });
  it('is 0 when width is 0', () => {
    expect(mouthOpenness(face({ upperY: 0.6, lowerY: 0.65, leftX: 0.5, rightX: 0.5 }))).toBe(0);
  });
  it('is 0 for too-short arrays', () => {
    expect(mouthOpenness([])).toBe(0);
    expect(mouthOpenness(Array.from({ length: 100 }, () => ({ x: 0, y: 0, z: 0 })))).toBe(0);
  });
  it('is 0 for non-finite coordinates', () => {
    expect(mouthOpenness(face({ upperY: NaN, lowerY: 0.65, leftX: 0.4, rightX: 0.6 }))).toBe(0);
    expect(mouthOpenness(face({ upperY: 0.6, lowerY: 0.65, leftX: 0.4, rightX: Infinity }))).toBe(0);
  });
});

describe('MouthTrigger', () => {
  it('fires only on the opening edge and re-arms below close', () => {
    const t = new MouthTrigger();
    const out = [0.1, 0.3, 0.3, 0.25, 0.1, 0.3].map((v) => t.update(v));
    expect(out).toEqual([false, true, false, false, false, true]);
  });
  it('does not re-arm between close and open thresholds', () => {
    const t = new MouthTrigger();
    expect(t.update(0.3)).toBe(true);
    expect(t.update(0.22)).toBe(false);
    expect(t.update(0.3)).toBe(false);
  });
});
