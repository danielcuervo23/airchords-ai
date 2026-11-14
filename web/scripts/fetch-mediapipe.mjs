// Copies the MediaPipe WASM files and downloads the models into public/mediapipe/
// so everything is served from the site itself. Generated files, not committed.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'mediapipe');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const TIMEOUT_MS = 60_000;
const MODELS = {
  'gesture_recognizer.task': {
    url: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
  },
  'face_landmarker.task': {
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  },
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function download(name, { url, sha256: expected }, dest) {
  const tmp = `${dest}.tmp`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) fail(`Download failed (${res.status}): ${url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const length = res.headers.get('content-length');
  if (length !== null && bytes.length !== Number(length)) {
    fail(`Incomplete download of ${name}: got ${bytes.length} of ${length} bytes`);
  }
  writeFileSync(tmp, bytes);
  if (sha256(bytes) !== expected) {
    rmSync(tmp, { force: true });
    fail(`SHA-256 mismatch for ${name}; file discarded`);
  }
  renameSync(tmp, dest);
  console.log(`downloaded ${name}`);
}

mkdirSync(join(out, 'wasm'), { recursive: true });
mkdirSync(join(out, 'models'), { recursive: true });
cpSync(wasmSrc, join(out, 'wasm'), { recursive: true });

for (const [name, model] of Object.entries(MODELS)) {
  const dest = join(out, 'models', name);
  if (existsSync(dest) && sha256(readFileSync(dest)) === model.sha256) continue;
  await download(name, model, dest);
}
