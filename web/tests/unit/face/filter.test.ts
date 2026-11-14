import { describe, expect, it } from 'vitest';
import { FaceFilter } from '../../../src/face/filter';

describe('FaceFilter.load', () => {
  it('rejects with a clear Spanish message when WebGL2 is not available', async () => {
    const canvas = { getContext: () => null, style: {} } as unknown as HTMLCanvasElement;
    await expect(FaceFilter.load(canvas, '/filters/spiderman-mask.webp')).rejects.toThrow(/WebGL2/);
  });
});
