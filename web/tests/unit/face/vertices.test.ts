import { describe, expect, it } from 'vitest';
import mesh from '../../../src/face/faceMesh.json';
import { MESH_VERTICES, smoothVertices, toClipSpace } from '../../../src/face/vertices';

const lm = (x: number, y: number) => ({ x, y, z: 0 });

describe('toClipSpace', () => {
  it('maps normalized image coords (y down) to WebGL clip space (y up)', () => {
    const out = new Float32Array(MESH_VERTICES * 2);
    const points = Array.from({ length: 478 }, () => lm(0.5, 0.5)); // 468 + 10 iris points
    points[0] = lm(0, 0);
    points[1] = lm(1, 1);
    points[2] = lm(0.25, 0.75);
    toClipSpace(points, out);
    expect(Array.from(out.slice(0, 6))).toEqual([-1, 1, 1, -1, -0.5, -0.5]);
    expect(out[2 * 467]).toBe(0);
  });

  it('ignores the iris landmarks (only the first 468 are used)', () => {
    const out = new Float32Array(MESH_VERTICES * 2);
    const points = Array.from({ length: 478 }, () => lm(0.5, 0.5));
    expect(() => toClipSpace(points, out)).not.toThrow();
    expect(out).toHaveLength(936);
  });

  it('throws when there are fewer than 468 landmarks', () => {
    expect(() => toClipSpace([lm(0, 0)], new Float32Array(936))).toThrow(/468/);
  });

  it('keeps triangles front-facing (CCW) for a face seen from the front', () => {
    // A frontal face in the image looks like the UV layout with y flipped.
    const points = Array.from({ length: 468 }, (_, i) => lm(mesh.uv[2 * i]!, 1 - mesh.uv[2 * i + 1]!));
    const p = new Float32Array(936);
    toClipSpace(points, p);
    const t = mesh.triangles;
    for (let k = 0; k < t.length; k += 3) {
      const [a, b, c] = [t[k]!, t[k + 1]!, t[k + 2]!];
      const area = (p[2 * b]! - p[2 * a]!) * (p[2 * c + 1]! - p[2 * a + 1]!)
        - (p[2 * b + 1]! - p[2 * a + 1]!) * (p[2 * c]! - p[2 * a]!);
      expect(area).toBeGreaterThan(0);
    }
  });
});

describe('smoothVertices (exponential smoothing against jitter)', () => {
  it('starts from the first frame unchanged (a copy)', () => {
    const next = new Float32Array([1, 2]);
    const s = smoothVertices(null, next, 0.5);
    expect(Array.from(s)).toEqual([1, 2]);
    expect(s).not.toBe(next);
  });

  it('moves alpha of the way towards the new frame, in place', () => {
    const state = new Float32Array([0, 10]);
    const s = smoothVertices(state, new Float32Array([4, 2]), 0.5);
    expect(s).toBe(state);
    expect(Array.from(s)).toEqual([2, 6]);
  });

  it('alpha = 1 follows the new frame exactly', () => {
    const s = smoothVertices(new Float32Array([0, 0]), new Float32Array([3, -1]), 1);
    expect(Array.from(s)).toEqual([3, -1]);
  });

  it('restarts when the length changes', () => {
    const s = smoothVertices(new Float32Array([0]), new Float32Array([5, 6]), 0.5);
    expect(Array.from(s)).toEqual([5, 6]);
  });
});
