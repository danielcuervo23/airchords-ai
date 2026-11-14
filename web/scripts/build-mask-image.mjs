// Prepares the face-paint texture: Filtros/spiderman.png -> web/public/filters/spiderman-mask.webp
// (max 768 px wide, WebP with alpha). If the drawing has a white background instead of a
// transparent one, near-white pixels CONNECTED TO THE BORDER become transparent (flood fill),
// so the white eye lenses, enclosed by black outline, stay opaque.
// Usage: node scripts/build-mask-image.mjs [input.png] [output.webp]
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MAX_WIDTH = 768;
const NEAR_WHITE = 235; // every channel above this counts as background white

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(process.argv[2] ?? resolve(webDir, '../Filtros/spiderman.png'));
const output = resolve(process.argv[3] ?? resolve(webDir, 'public/filters/spiderman-mask.webp'));

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const isBackground = (p) =>
  data[p * 4 + 3] === 0 || (data[p * 4] > NEAR_WHITE && data[p * 4 + 1] > NEAR_WHITE && data[p * 4 + 2] > NEAR_WHITE);

const seen = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
let cleared = 0;
while (stack.length > 0) {
  const p = stack.pop();
  if (seen[p] || !isBackground(p)) continue;
  seen[p] = 1;
  if (data[p * 4 + 3] !== 0) cleared++;
  data[p * 4 + 3] = 0;
  const x = p % w;
  if (x > 0) stack.push(p - 1);
  if (x < w - 1) stack.push(p + 1);
  if (p >= w) stack.push(p - w);
  if (p < (h - 1) * w) stack.push(p + w);
}

mkdirSync(dirname(output), { recursive: true });
await sharp(data, { raw: { width: w, height: h, channels: 4 } })
  .resize({ width: Math.min(MAX_WIDTH, w) })
  .webp({ quality: 85, alphaQuality: 100, effort: 6 })
  .toFile(output);
const meta = await sharp(output).metadata();
console.log(`${output}: ${meta.width}x${meta.height}, ${(statSync(output).size / 1024).toFixed(1)} KB` +
  ` (fondo blanco vuelto transparente: ${cleared} px)`);
