/** Pure per-frame helpers for the face-paint mesh (no WebGL here). */

/** FaceLandmarker returns 478 points; the first 468 are the face mesh, the rest are irises. */
export const MESH_VERTICES = 468;

/**
 * Writes the first 468 landmarks (normalized image coords, y down) into `out` as WebGL clip
 * space (x, y in -1..1, y up), 2 floats per vertex. No allocation: called every frame.
 */
export function toClipSpace(landmarks: ArrayLike<{ x: number; y: number }>, out: Float32Array): void {
  if (landmarks.length < MESH_VERTICES) {
    throw new Error(`Se esperaban al menos ${MESH_VERTICES} puntos de la cara; llegaron ${landmarks.length}.`);
  }
  for (let i = 0; i < MESH_VERTICES; i++) {
    const p = landmarks[i]!;
    out[2 * i] = p.x * 2 - 1;
    out[2 * i + 1] = 1 - p.y * 2;
  }
}

/**
 * Exponential smoothing: state += alpha * (next - state). `alpha` is the weight of the NEW
 * frame (1 = no smoothing). With no usable state it starts from a copy of `next`; otherwise
 * it updates `state` in place and returns it.
 */
export function smoothVertices(state: Float32Array | null, next: Float32Array, alpha: number): Float32Array {
  if (state === null || state.length !== next.length) return Float32Array.from(next);
  for (let i = 0; i < next.length; i++) state[i]! += alpha * (next[i]! - state[i]!);
  return state;
}
