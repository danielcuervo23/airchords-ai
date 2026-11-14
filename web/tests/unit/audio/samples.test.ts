import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../../src/audio/presets';

const PUBLIC = join(__dirname, '../../../public');
const SAMPLES = join(PUBLIC, 'samples');
const MAX_BYTES = 1.5 * 1024 * 1024;
const credits = readFileSync(join(PUBLIC, 'CREDITS.md'), 'utf8');
const folders = existsSync(SAMPLES) ? readdirSync(SAMPLES).filter((d) => statSync(join(SAMPLES, d)).isDirectory()) : [];

/** Body of the `## <title>` section whose title is exactly `title` (not a prefix match). */
function section(title: string): string | undefined {
  return credits.split(/^## /m).find((s) => s.split(/\r?\n/)[0]!.trim() === title);
}

describe('samples', () => {
  it('every file a preset references exists', () => {
    for (const p of PRESETS.filter((x) => x.samples)) {
      for (const file of Object.values(p.samples!.notes)) {
        const rel = p.samples!.baseUrl.replace(/^\//, '') + file;
        expect(existsSync(join(PUBLIC, rel)), rel).toBe(true);
      }
    }
  });
  it('has sample folders', () => {
    expect(folders.length).toBeGreaterThan(0);
  });
  it('every sample folder is credited (exact heading) with author, license, source and modifications', () => {
    for (const f of folders) {
      const s = section(`samples/${f}`);
      expect(s, `CREDITS.md section for samples/${f}`).toBeTruthy();
      expect(s).toMatch(/Autor:/);
      expect(s).toMatch(/Licencia:/);
      expect(s).toMatch(/Modificaciones:/);
      expect(s).toMatch(/Fuente: https?:\/\//);
    }
  });
  it('credits the Spider-Man model', () => {
    expect(credits).toContain('Modelo 3D de uso libre, autor desconocido. Demo de fan sin fines comerciales.');
  });
  it('each instrument weighs at most 1.5 MB', () => {
    for (const f of folders) {
      const dir = join(SAMPLES, f);
      const total = readdirSync(dir).reduce((s, n) => s + statSync(join(dir, n)).size, 0);
      expect(total, f).toBeLessThanOrEqual(MAX_BYTES);
    }
  });
});
