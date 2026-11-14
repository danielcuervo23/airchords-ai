// Converts MediaPipe's canonical face model (Apache-2.0) into web/src/face/faceMesh.json:
//   { triangles: number[] /* flat, 3 per triangle, 0-based */, uv: number[] /* 2 per vertex */ }
// Vertex i of the OBJ is FaceLandmarker landmark i (by design of the model). UVs are re-indexed
// per vertex (the OBJ's `f v/vt` pairs map each vertex to exactly one vt). UV convention: OBJ,
// u to the right, v UP, front view as seen by the camera (landmark 33 = subject's right eye at u<0.5).
// Source: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj
// License: Apache-2.0, see web/src/face/faceMesh.LICENSE.txt
// Usage: node scripts/build-face-mesh.mjs [local.obj]   (default: download from the URL below)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj';
const VERTICES = 468;

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(webDir, 'src/face/faceMesh.json');

async function readObj() {
  if (process.argv[2]) return readFileSync(resolve(process.argv[2]), 'utf8');
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Descarga fallida (${res.status}) de ${SOURCE_URL}`);
  return res.text();
}

const vt = [];
const triangles = [];
const uvOf = new Map(); // vertex index -> vt index
let vCount = 0;
for (const line of (await readObj()).split(/\r?\n/)) {
  const p = line.trim().split(/\s+/);
  if (p[0] === 'v') vCount++;
  else if (p[0] === 'vt') vt.push([Number(p[1]), Number(p[2])]);
  else if (p[0] === 'f') {
    if (p.length !== 4) throw new Error(`Cara no triangular: ${line}`);
    for (const ref of p.slice(1)) {
      const [v, t] = ref.split('/').map((s) => Number(s) - 1);
      if (uvOf.has(v) && uvOf.get(v) !== t) throw new Error(`El vértice ${v} tiene dos UV`);
      uvOf.set(v, t);
      triangles.push(v);
    }
  }
}
if (vCount !== VERTICES || uvOf.size !== VERTICES) {
  throw new Error(`Se esperaban ${VERTICES} vértices; hay ${vCount} (con UV: ${uvOf.size})`);
}

const uv = [];
for (let i = 0; i < VERTICES; i++) {
  const [u, v] = vt[uvOf.get(i)];
  uv.push(Number(u.toFixed(6)), Number(v.toFixed(6)));
}
writeFileSync(output, `${JSON.stringify({ triangles, uv })}\n`);
console.log(`faceMesh.json: ${VERTICES} vértices, ${triangles.length / 3} triángulos -> ${output}`);
