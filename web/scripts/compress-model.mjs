// Compresses the (gitignored, large) source model into web/public/models/spiderman.glb:
// textures resized to max 1024 px + WebP, geometry compressed with meshopt.
// Usage: node scripts/compress-model.mjs [input.glb] [output.glb]
// Default input: ../Filtros/source/spiderman.glb (relative to web/).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(process.argv[2] ?? resolve(webDir, '../Filtros/source/spiderman.glb'));
const output = resolve(process.argv[3] ?? resolve(webDir, 'public/models/spiderman.glb'));

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(input);
await doc.transform(
  dedup(),
  weld(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 80 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);

mkdirSync(dirname(output), { recursive: true });
await io.write(output, doc);

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2);
console.log(`${input} (${mb(input)} MB) -> ${output} (${mb(output)} MB)`);
