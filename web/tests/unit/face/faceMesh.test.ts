import { describe, expect, it } from 'vitest';
import mesh from '../../../src/face/faceMesh.json';

const VERTICES = 468; // FaceLandmarker landmarks without the 10 iris points

describe('faceMesh.json (MediaPipe canonical face model)', () => {
  it('has one UV pair per landmark', () => {
    expect(mesh.uv).toHaveLength(VERTICES * 2);
    expect(mesh.uv.every((c) => Number.isFinite(c) && c >= 0 && c <= 1)).toBe(true);
  });

  it('has a flat list of triangles indexing only the 468 vertices', () => {
    expect(mesh.triangles.length % 3).toBe(0);
    const count = mesh.triangles.length / 3;
    expect(count).toBeGreaterThanOrEqual(850);
    expect(count).toBeLessThanOrEqual(900);
    expect(mesh.triangles.every((i) => Number.isInteger(i) && i >= 0 && i < VERTICES)).toBe(true);
  });

  it('places known landmarks where a front view expects them (v points up)', () => {
    const uv = (i: number): [number, number] => [mesh.uv[2 * i]!, mesh.uv[2 * i + 1]!];
    const [, foreheadV] = uv(10);
    const [, chinV] = uv(152);
    const [rightEyeU] = uv(33); // subject's right eye, image left
    const [leftEyeU] = uv(263);
    expect(foreheadV).toBeGreaterThan(chinV);
    expect(rightEyeU).toBeLessThan(0.5);
    expect(leftEyeU).toBeGreaterThan(0.5);
  });

  it('winds every triangle counter-clockwise in UV space (needed for back-face culling)', () => {
    const t = mesh.triangles;
    const u = mesh.uv;
    for (let k = 0; k < t.length; k += 3) {
      const [a, b, c] = [t[k]!, t[k + 1]!, t[k + 2]!];
      const area = (u[2 * b]! - u[2 * a]!) * (u[2 * c + 1]! - u[2 * a + 1]!)
        - (u[2 * b + 1]! - u[2 * a + 1]!) * (u[2 * c]! - u[2 * a]!);
      expect(area).toBeGreaterThan(0);
    }
  });
});
