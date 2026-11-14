import { describe, it, expect } from 'vitest';
import { ExpressionTracker } from '../../../src/gestures/expression';
import type { Landmark } from '../../../src/gestures/types';

// Sign convention: positive angle = pinky MCP lower on screen than index MCP
// (image y grows downward) for a hand whose pinky is on the right.
function hand(opts: { wristY: number; dx?: number; dy?: number }): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  lm[0] = { x: 0.5, y: opts.wristY, z: 0 };
  lm[5] = { x: 0.4, y: 0.5, z: 0 };
  lm[17] = { x: 0.4 + (opts.dx ?? 0.2), y: 0.5 + (opts.dy ?? 0), z: 0 };
  return lm;
}
function run(t: ExpressionTracker, lm: Landmark[] | null, n = 100) {
  let e = t.update(lm);
  for (let i = 1; i < n; i++) e = t.update(lm);
  return e;
}

describe('ExpressionTracker', () => {
  it('returns the default on first null update', () => {
    expect(new ExpressionTracker().update(null)).toEqual({ volume: 0.7, brightness: 0.5 });
  });
  it('wrist at y=0.15 converges to volume ~1, y=0.85 to ~0, clamped beyond', () => {
    expect(run(new ExpressionTracker(), hand({ wristY: 0.15 })).volume).toBeCloseTo(1, 3);
    expect(run(new ExpressionTracker(), hand({ wristY: 0.85 })).volume).toBeCloseTo(0, 3);
    expect(run(new ExpressionTracker(), hand({ wristY: -2 })).volume).toBeCloseTo(1, 3);
    expect(run(new ExpressionTracker(), hand({ wristY: 3 })).volume).toBeCloseTo(0, 3);
  });
  it('smooths exponentially with 0.3', () => {
    const t = new ExpressionTracker();
    t.update(null);
    // target volume 1, prev 0.7 -> 0.7 + 0.3*0.3 = 0.79
    expect(t.update(hand({ wristY: 0.15 })).volume).toBeCloseTo(0.79, 6);
  });
  it('level hand gives brightness 0.5', () => {
    expect(run(new ExpressionTracker(), hand({ wristY: 0.5 })).brightness).toBeCloseTo(0.5, 3);
  });
  it('+45 deg (pinky lower) gives 1, -45 deg gives 0', () => {
    expect(run(new ExpressionTracker(), hand({ wristY: 0.5, dx: 0.2, dy: 0.2 })).brightness).toBeCloseTo(1, 3);
    expect(run(new ExpressionTracker(), hand({ wristY: 0.5, dx: 0.2, dy: -0.2 })).brightness).toBeCloseTo(0, 3);
  });
  it('mirrored hand (pinky on the left) is treated as level when level', () => {
    expect(run(new ExpressionTracker(), hand({ wristY: 0.5, dx: -0.2 })).brightness).toBeCloseTo(0.5, 3);
  });
  it('returns gradually to default when hand disappears', () => {
    const t = new ExpressionTracker();
    run(t, hand({ wristY: 0.15 }));
    const e1 = t.update(null);
    expect(e1.volume).toBeLessThan(1);
    expect(e1.volume).toBeGreaterThan(0.7);
    expect(run(t, null).volume).toBeCloseTo(0.7, 3);
  });
  it('treats non-finite or short landmark arrays as null, never NaN', () => {
    const bad = hand({ wristY: NaN });
    const t = new ExpressionTracker();
    const e = t.update(bad);
    expect(e).toEqual({ volume: 0.7, brightness: 0.5 });
    expect(t.update([]).volume).toBe(0.7);
    const inf = hand({ wristY: 0.5, dx: Infinity });
    const e2 = t.update(inf);
    expect(Number.isFinite(e2.volume) && Number.isFinite(e2.brightness)).toBe(true);
  });
});
