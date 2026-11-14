import { describe, expect, it } from 'vitest';
import mesh from '../../../src/face/faceMesh.json';
import {
  SPIDERMAN_MASK, maskTexCoords, spidermanAnchors, type AnchorPair,
} from '../../../src/face/maskMapping';

const at = (out: Float32Array, i: number): [number, number] => [out[2 * i]!, out[2 * i + 1]!];

describe('maskTexCoords (thin-plate spline from mesh UV to mask image)', () => {
  const anchors: AnchorPair[] = [
    { uv: [0.1, 0.1], img: [0.2, 0.9] },
    { uv: [0.9, 0.1], img: [0.8, 0.85] },
    { uv: [0.5, 0.9], img: [0.5, 0.05] },
    { uv: [0.3, 0.6], img: [0.25, 0.4] },
    { uv: [0.7, 0.55], img: [0.7, 0.45] },
  ];

  it('maps every anchor exactly onto its image point', () => {
    const out = maskTexCoords(anchors.flatMap((a) => a.uv), anchors);
    anchors.forEach((a, i) => {
      expect(out[2 * i]).toBeCloseTo(a.img[0], 6);
      expect(out[2 * i + 1]).toBeCloseTo(a.img[1], 6);
    });
  });

  it('reproduces an affine map exactly (no bending when none is needed)', () => {
    const affine = (u: number, v: number): [number, number] => [0.3 + 0.5 * u - 0.1 * v, 0.9 - 0.8 * v + 0.05 * u];
    const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [0.4, 0.3]] as const;
    const out = maskTexCoords([0.25, 0.75, 0.6, 0.2], pts.map(([u, v]) => ({ uv: [u, v], img: affine(u, v) })));
    expect(out[0]).toBeCloseTo(affine(0.25, 0.75)[0], 6);
    expect(out[1]).toBeCloseTo(affine(0.25, 0.75)[1], 6);
    expect(out[2]).toBeCloseTo(affine(0.6, 0.2)[0], 6);
    expect(out[3]).toBeCloseTo(affine(0.6, 0.2)[1], 6);
  });

  it('rejects fewer than 3 anchors with a clear error', () => {
    expect(() => maskTexCoords([0, 0], anchors.slice(0, 2))).toThrow(/3 puntos/);
  });
});

describe('Spider-Man anchors on the real face mesh', () => {
  const anchors = spidermanAnchors(mesh.uv);
  const out = maskTexCoords(mesh.uv, anchors);
  const norm = (p: readonly [number, number]): [number, number] =>
    [p[0] / SPIDERMAN_MASK.width, p[1] / SPIDERMAN_MASK.height];

  it('uses 10 to 14 anchors, each landing exactly on its measured pixel', () => {
    expect(anchors.length).toBeGreaterThanOrEqual(10);
    expect(anchors.length).toBeLessThanOrEqual(14);
    const check = maskTexCoords(anchors.flatMap((a) => a.uv), anchors);
    anchors.forEach((a, i) => {
      expect(Math.abs(check[2 * i]! - a.img[0])).toBeLessThan(1e-6);
      expect(Math.abs(check[2 * i + 1]! - a.img[1])).toBeLessThan(1e-6);
    });
  });

  it('gives one finite coordinate pair per vertex, inside the image', () => {
    expect(out).toHaveLength(468 * 2);
    for (const c of out) {
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('maps the point between the eyes (landmark 168) between the two lenses', () => {
    const [x, y] = at(out, 168);
    const [lx] = norm(SPIDERMAN_MASK.rightEyeLens);
    const [rx] = norm(SPIDERMAN_MASK.leftEyeLens);
    expect(x).toBeGreaterThan(lx);
    expect(x).toBeLessThan(rx);
    expect(y).toBeGreaterThan(norm([0, SPIDERMAN_MASK.lensTop])[1]);
    expect(y).toBeLessThan(norm([0, SPIDERMAN_MASK.lensBottom])[1]);
  });

  it('is left/right symmetric (mask and mesh are)', () => {
    for (const [a, b] of [[33, 263], [61, 291], [234, 454], [70, 300]] as const) {
      expect(at(out, a)[0] + at(out, b)[0]).toBeCloseTo(1, 2);
      expect(at(out, a)[1]).toBeCloseTo(at(out, b)[1], 2);
    }
  });

  it('does not fold the mesh: every triangle keeps its orientation in the image', () => {
    const t = mesh.triangles;
    for (let k = 0; k < t.length; k += 3) {
      const [a, b, c] = [at(out, t[k]!), at(out, t[k + 1]!), at(out, t[k + 2]!)];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      expect(area).toBeLessThan(0); // CCW in UV (v up) becomes CW in the image (y down)
    }
  });
});
