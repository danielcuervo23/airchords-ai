/**
 * Pure pose math for the face filter (no three.js). All 4x4 matrices are
 * column-major Float32Arrays, the layout MediaPipe and three.js both use.
 * Ported from PianoVirtual.py (construir_bind_transform, suavizar_matriz_cabeza).
 */

export const BIND = { scale: 22.373248, translation: [0, 2.5, -1.5], rotationDeg: [0, 0, 0] } as const;

type Bind = { readonly scale: number; readonly translation: readonly number[]; readonly rotationDeg: readonly number[] };
type Mat3 = number[]; // row-major 3x3

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Rz * Ry * Rx, same order as matriz_rotacion_grados (row-major). */
function rotationRows([pitch, yaw, roll]: readonly number[]): Mat3 {
  const [rx, ry, rz] = [rad(pitch ?? 0), rad(yaw ?? 0), rad(roll ?? 0)];
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const rxm = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const rym = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const rzm = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul3(rzm, mul3(rym, rxm));
}

function mul3(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = new Array<number>(9).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      for (let k = 0; k < 3; k++) out[r * 3 + c]! += a[r * 3 + k]! * b[k * 3 + c]!;
  return out;
}

function det3(m: Mat3): number {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** Inverse transpose of a 3x3 (cofactor matrix / det). */
function inverseTranspose3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const det = det3(m);
  return [
    (e * i - f * h) / det, (f * g - d * i) / det, (d * h - e * g) / det,
    (c * h - b * i) / det, (a * i - c * g) / det, (b * g - a * h) / det,
    (b * f - c * e) / det, (c * d - a * f) / det, (a * e - b * d) / det,
  ];
}

/**
 * Nearest orthogonal matrix, i.e. U @ Vt of the SVD used by the Python.
 * Computed with the Newton polar iteration R <- (R + R^-T) / 2, which converges
 * to the same orthogonal factor for any non-singular input. A (near-)singular
 * blend cannot happen between two real rotations at alpha ~0.55; if it does we
 * return the identity rather than NaNs.
 */
function nearestRotation(m: Mat3): Mat3 {
  let r = m;
  for (let n = 0; n < 30; n++) {
    if (Math.abs(det3(r)) < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    const it = inverseTranspose3(r);
    const next = r.map((v, idx) => 0.5 * (v + it[idx]!));
    const delta = next.reduce((s, v, idx) => s + Math.abs(v - r[idx]!), 0);
    r = next;
    if (delta < 1e-9) break;
  }
  return r;
}

const rotationOf = (m: Float32Array): Mat3 => [m[0]!, m[4]!, m[8]!, m[1]!, m[5]!, m[9]!, m[2]!, m[6]!, m[10]!];

/** T = [R * scale | translation], as in construir_bind_transform. */
export function bindMatrix(b: Bind = BIND): Float32Array {
  const r = rotationRows(b.rotationDeg);
  const [tx, ty, tz] = b.translation;
  const s = b.scale;
  return new Float32Array([
    r[0]! * s, r[3]! * s, r[6]! * s, 0,
    r[1]! * s, r[4]! * s, r[7]! * s, 0,
    r[2]! * s, r[5]! * s, r[8]! * s, 0,
    tx ?? 0, ty ?? 0, tz ?? 0, 1,
  ]);
}

/**
 * Exact port of suavizar_matriz_cabeza. NOTE the weighting: alpha multiplies the
 * PREVIOUS pose (smoothed = alpha*prev + (1-alpha)*next), so a larger alpha is
 * smoother/laggier. The rotation blend is projected back onto a true rotation
 * (the Python does U @ Vt of the SVD). Scale in the inputs is discarded.
 */
export function smoothPose(prev: Float32Array | null, next: Float32Array, alpha = 0.55): Float32Array {
  if (prev === null) return Float32Array.from(next);
  const rn = rotationOf(next);
  const blended = rotationOf(prev).map((v, i) => alpha * v + (1 - alpha) * rn[i]!);
  const r = nearestRotation(blended);
  const t = (k: number): number => alpha * prev[k]! + (1 - alpha) * next[k]!;
  return new Float32Array([
    r[0]!, r[3]!, r[6]!, 0,
    r[1]!, r[4]!, r[7]!, 0,
    r[2]!, r[5]!, r[8]!, 0,
    t(12), t(13), t(14), 1,
  ]);
}
