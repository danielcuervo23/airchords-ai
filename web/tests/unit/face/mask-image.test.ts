import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SPIDERMAN_MASK } from '../../../src/face/maskMapping';

const file = resolve(import.meta.dirname, '../../../public/filters/spiderman-mask.webp');

describe('spiderman-mask.webp', () => {
  it('is at most 200 KB', () => {
    expect(statSync(file).size).toBeLessThanOrEqual(200 * 1024);
  });

  it('is a WebP with alpha, at most 768 px wide, same proportions as the measured drawing', async () => {
    const m = await sharp(file).metadata();
    expect(m.format).toBe('webp');
    expect(m.hasAlpha).toBe(true);
    expect(m.width).toBeLessThanOrEqual(768);
    expect(m.width).toBeGreaterThanOrEqual(512);
    const ratio = SPIDERMAN_MASK.width / SPIDERMAN_MASK.height;
    expect(Math.abs(m.width! / m.height! - ratio)).toBeLessThan(0.005);
  });

  it('keeps the background transparent and the lenses opaque white', async () => {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (nx: number, ny: number) => {
      const i = (Math.round(ny * (info.height - 1)) * info.width + Math.round(nx * (info.width - 1))) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    };
    expect(px(0, 0)[3]).toBe(0); // corner: outside the mask
    const [x, y] = SPIDERMAN_MASK.rightEyeLens;
    const lens = px(x / SPIDERMAN_MASK.width, y / SPIDERMAN_MASK.height);
    expect(lens[3]).toBe(255);
    expect(Math.min(lens[0]!, lens[1]!, lens[2]!)).toBeGreaterThan(240);
  });
});
