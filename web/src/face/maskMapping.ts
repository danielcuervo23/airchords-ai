/**
 * Pure math that decides which pixel of the 2D mask drawing each face-mesh vertex shows.
 *
 * A 2D thin-plate spline (TPS) bends the canonical face UV layout (faceMesh.json, v up) onto
 * the mask image (normalized 0..1, y DOWN) so that a few anchor points match exactly
 * (eyes -> lens centers, chin -> mask bottom, ...) and everything in between deforms smoothly.
 * Computed once at load; per frame only the vertex positions change.
 */
export interface AnchorPair {
  /** Point in mesh UV space (u right, v up). */
  uv: [number, number];
  /** Matching point in the mask image, normalized 0..1 (x right, y down). */
  img: [number, number];
}

type Px = readonly [number, number];

/**
 * Pixel measurements of Filtros/spiderman.png (1114x1600, transparent background), taken with
 * sharp: alpha edge per row and the centroid / bounding box of the white lens pixels. "right"
 * and "left" are the SUBJECT's sides, as in MediaPipe (the subject's right eye is on the image
 * left). Edge points are inset ~8 px from the alpha edge so the black outline stays visible.
 */
export const SPIDERMAN_MASK = {
  width: 1114,
  height: 1600,
  /** Centroid of the white pixels of each lens. */
  rightEyeLens: [228, 913] as Px,
  leftEyeLens: [886, 913] as Px,
  /** Vertical extent of the white lens pixels. */
  lensTop: 666,
  lensBottom: 1057,
  /** Top and bottom of the mask outline, on the centre line. */
  top: [557, 14] as Px,
  bottom: [557, 1586] as Px,
  /** Nose tip: the web knot just below the lenses, ~30% of the way from the eyes to the chin. */
  noseTip: [557, 1115] as Px,
  /** Mouth corners: same fraction of the mask's row width as on a real face (~27% apart). */
  rightMouth: [451, 1284] as Px,
  leftMouth: [663, 1284] as Px,
  /** Side edges, at the height each face-oval landmark gets on the mask. */
  rightTemple: [75, 298] as Px,
  leftTemple: [1039, 298] as Px,
  rightCheek: [74, 1030] as Px,
  leftCheek: [1040, 1030] as Px,
  rightJaw: [245, 1397] as Px,
  leftJaw: [869, 1397] as Px,
} as const;

/** FaceLandmarker indices used as anchors (canonical face mesh numbering). */
const LM = {
  foreheadTop: 10, chin: 152, noseTip: 1,
  rightEyeOuter: 33, rightEyeInner: 133, leftEyeOuter: 263, leftEyeInner: 362,
  rightMouth: 61, leftMouth: 291,
  rightTemple: 54, leftTemple: 284, rightCheek: 234, leftCheek: 454, rightJaw: 172, leftJaw: 397,
} as const;

/** The 13 anchor pairs for the Spider-Man drawing, read from the mesh's own UVs. */
export function spidermanAnchors(meshUV: ArrayLike<number>): AnchorPair[] {
  const uv = (i: number): [number, number] => [meshUV[2 * i]!, meshUV[2 * i + 1]!];
  const mid = (a: number, b: number): [number, number] => {
    const [p, q] = [uv(a), uv(b)];
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const M = SPIDERMAN_MASK;
  const img = ([x, y]: Px): [number, number] => [x / M.width, y / M.height];
  return [
    { uv: uv(LM.foreheadTop), img: img(M.top) },
    { uv: uv(LM.chin), img: img(M.bottom) },
    { uv: uv(LM.noseTip), img: img(M.noseTip) },
    { uv: mid(LM.rightEyeOuter, LM.rightEyeInner), img: img(M.rightEyeLens) },
    { uv: mid(LM.leftEyeOuter, LM.leftEyeInner), img: img(M.leftEyeLens) },
    { uv: uv(LM.rightMouth), img: img(M.rightMouth) },
    { uv: uv(LM.leftMouth), img: img(M.leftMouth) },
    { uv: uv(LM.rightTemple), img: img(M.rightTemple) },
    { uv: uv(LM.leftTemple), img: img(M.leftTemple) },
    { uv: uv(LM.rightCheek), img: img(M.rightCheek) },
    { uv: uv(LM.leftCheek), img: img(M.leftCheek) },
    { uv: uv(LM.rightJaw), img: img(M.rightJaw) },
    { uv: uv(LM.leftJaw), img: img(M.leftJaw) },
  ];
}

/** TPS radial basis U(r) = r^2 log r, written with r^2 to skip the square root. */
function kernel(dx: number, dy: number): number {
  const r2 = dx * dx + dy * dy;
  return r2 === 0 ? 0 : 0.5 * r2 * Math.log(r2);
}

/**
 * Per-vertex texture coordinates (normalized image coords, 2 per vertex) for `meshUV`
 * (2 per vertex), warped with a thin-plate spline through `anchors`.
 */
export function maskTexCoords(meshUV: ArrayLike<number>, anchors: AnchorPair[]): Float32Array {
  const n = anchors.length;
  if (n < 3) throw new Error('La deformación de la máscara necesita al menos 3 puntos de referencia.');
  // System [K P; Pt 0] [w; a] = [img; 0], solved for x and y at once.
  const size = n + 3;
  const A = Array.from({ length: size }, () => new Float64Array(size + 2));
  for (let i = 0; i < n; i++) {
    const [ui, vi] = anchors[i]!.uv;
    const row = A[i]!;
    for (let j = 0; j < n; j++) {
      const [uj, vj] = anchors[j]!.uv;
      row[j] = kernel(ui - uj, vi - vj);
    }
    row[n] = 1; row[n + 1] = ui; row[n + 2] = vi;
    A[n]![i] = 1; A[n + 1]![i] = ui; A[n + 2]![i] = vi;
    row[size] = anchors[i]!.img[0];
    row[size + 1] = anchors[i]!.img[1];
  }
  const sol = solve(A, size);

  const out = new Float32Array(meshUV.length);
  for (let k = 0; k + 1 < meshUV.length; k += 2) {
    const u = meshUV[k]!;
    const v = meshUV[k + 1]!;
    let x = sol[n]![0] + sol[n + 1]![0] * u + sol[n + 2]![0] * v;
    let y = sol[n]![1] + sol[n + 1]![1] * u + sol[n + 2]![1] * v;
    for (let i = 0; i < n; i++) {
      const [ui, vi] = anchors[i]!.uv;
      const k0 = kernel(u - ui, v - vi);
      x += sol[i]![0] * k0;
      y += sol[i]![1] * k0;
    }
    out[k] = x;
    out[k + 1] = y;
  }
  return out;
}

/** Gauss-Jordan with partial pivoting on an augmented matrix with 2 right-hand sides. */
function solve(A: Float64Array[], size: number): [number, number][] {
  for (let c = 0; c < size; c++) {
    let p = c;
    for (let r = c + 1; r < size; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    if (Math.abs(A[p]![c]!) < 1e-12) {
      throw new Error('Los puntos de referencia de la máscara están repetidos o alineados.');
    }
    [A[c], A[p]] = [A[p]!, A[c]!];
    const pivot = A[c]!;
    for (let r = 0; r < size; r++) {
      if (r === c) continue;
      const row = A[r]!;
      const f = row[c]! / pivot[c]!;
      if (f !== 0) for (let k = c; k < size + 2; k++) row[k]! -= f * pivot[k]!;
    }
  }
  return A.map((row, i) => [row[size]! / row[i]!, row[size + 1]! / row[i]!]);
}
