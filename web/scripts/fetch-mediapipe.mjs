// Copies the MediaPipe WASM files and downloads the models into public/mediapipe/
// so everything is served from the site itself. Generated files, not committed.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'mediapipe');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const MODELS = {
  'gesture_recognizer.task':
    'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

mkdirSync(join(out, 'wasm'), { recursive: true });
mkdirSync(join(out, 'models'), { recursive: true });
cpSync(wasmSrc, join(out, 'wasm'), { recursive: true });

for (const [name, url] of Object.entries(MODELS)) {
  const dest = join(out, 'models', name);
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${name}`);
}
