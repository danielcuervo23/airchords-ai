import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('spiderman model', () => {
  it('is at most 3 MB', () => {
    const file = resolve(import.meta.dirname, '../../../public/models/spiderman.glb');
    expect(statSync(file).size).toBeLessThanOrEqual(3 * 1024 * 1024);
  });
});
