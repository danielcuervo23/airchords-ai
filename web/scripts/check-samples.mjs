// Quick manual check: lists every sample folder, its size, and whether CREDITS.md mentions it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
const credits = readFileSync(join(pub, 'CREDITS.md'), 'utf8');
let bad = false;
for (const d of readdirSync(join(pub, 'samples'))) {
  const dir = join(pub, 'samples', d);
  const bytes = readdirSync(dir).reduce((s, f) => s + statSync(join(dir, f)).size, 0);
  const credited = credits.includes(`samples/${d}`);
  const ok = credited && bytes <= 1.5 * 1024 * 1024;
  if (!ok) bad = true;
  console.log(`${ok ? 'OK ' : 'BAD'} ${d}: ${(bytes / 1024).toFixed(0)} KB, credited=${credited}`);
}
process.exit(bad ? 1 : 0);
