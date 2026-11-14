import { describe, expect, it } from 'vitest';
import { BIND, bindMatrix, smoothPose } from '../../../src/face/pose';

// 4x4 column-major helpers
const identity = (): Float32Array =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const translation = (x: number, y: number, z: number): Float32Array => {
  const m = identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
};
const rotZ = (deg: number): Float32Array => {
  const r = (deg * Math.PI) / 180;
  const m = identity();
  m[0] = Math.cos(r); m[1] = Math.sin(r); m[4] = -Math.sin(r); m[5] = Math.cos(r);
  return m;
};
const apply = (m: Float32Array, p: [number, number, number]): number[] => [
  m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
  m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
  m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
];

describe('smoothPose', () => {
  it('returns a copy of next when there is no previous pose', () => {
    const m = translation(1, 2, 3);
    const out = smoothPose(null, m);
    expect(Array.from(out)).toEqual(Array.from(m));
    expect(out).not.toBe(m);
  });

  // Replicates PianoVirtual.py suavizar_matriz_cabeza (alpha 0.55): the weight
  // alpha goes on the PREVIOUS pose: t = alpha*prev + (1-alpha)*next. So prev = I,
  // next = +10 in x gives 0.45*10 = 4.5 (NOT 5.5 as the brief's example said;
  // the Python wins by controller ruling).
  it('weights the previous pose by alpha (Python semantics): x = 4.5', () => {
    const out = smoothPose(identity(), translation(10, 0, 0), 0.55);
    expect(out[12]).toBeCloseTo(4.5, 5);
    expect(out[13]).toBeCloseTo(0, 5);
  });

  it('uses alpha 0.55 by default and keeps the bottom row 0,0,0,1', () => {
    const out = smoothPose(identity(), translation(10, 0, 0));
    expect(out[12]).toBeCloseTo(4.5, 5);
    expect([out[3], out[7], out[11], out[15]]).toEqual([0, 0, 0, 1]);
  });

  it('re-projects the blended rotation onto a true rotation (SVD/polar step)', () => {
    // Plain averaging of I and rotZ(90) is NOT orthonormal; the result must be.
    const out = smoothPose(identity(), rotZ(90), 0.55);
    const [a, b, c, d] = [out[0]!, out[1]!, out[4]!, out[5]!];
    expect(a * a + b * b).toBeCloseTo(1, 4);
    expect(c * c + d * d).toBeCloseTo(1, 4);
    expect(a * c + b * d).toBeCloseTo(0, 4);
    // 0.55*I + 0.45*Rz(90) rotates by atan2(0.45, 0.55) ~ 39.3 deg
    expect(Math.atan2(out[1]!, out[0]!)).toBeCloseTo(Math.atan2(0.45, 0.55), 4);
  });

  it('discards any scale in the matrices (only rotation + translation survive)', () => {
    const m = translation(0, 0, 0);
    m[0] = 3; m[5] = 3; m[10] = 3;
    const out = smoothPose(identity(), m, 0.55);
    expect(out[0]).toBeCloseTo(1, 4);
    expect(out[5]).toBeCloseTo(1, 4);
  });
});

describe('bindMatrix', () => {
  it('maps the origin to the bind translation', () => {
    const p = apply(bindMatrix(), [0, 0, 0]);
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(2.5, 5);
    expect(p[2]).toBeCloseTo(-1.5, 5);
  });

  it('scales by BIND.scale (identity rotation)', () => {
    const p = apply(bindMatrix(), [1, 0, 0]);
    expect(p[0]).toBeCloseTo(BIND.scale, 4);
    expect(p[1]).toBeCloseTo(2.5, 5);
  });

  it('applies the Python Rz*Ry*Rx rotation order', () => {
    const m = bindMatrix({ scale: 1, translation: [0, 0, 0], rotationDeg: [0, 0, 90] });
    const p = apply(m, [1, 0, 0]);
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(1, 5);
  });
});
