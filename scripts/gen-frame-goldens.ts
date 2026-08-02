// TIMBER-2 T0 — snapshot `generateFrame` into committed goldens (plan TD12).
//
// Run BEFORE any extraction touches src/timber. The snapshot is the permanent reference the
// compat suite diffs against forever — never a live-vs-live comparison, which would go
// self-referential the moment frame.ts starts delegating to the new engine.
//
//   npm run gen:frame-goldens          # rewrite test/goldens/frame/
//
// Rewriting these is a stop-the-line event past T0: a changed golden means the frozen legacy
// output moved, which is exactly what the compat lock exists to catch (plan §9 K2).

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFrame } from '../src/timber/frame';
import { FULL_FIXTURES, MATRIX_FIXTURES } from '../test/fixtures/frameFixtures';
import { canonicalJson, frameSnapshot, GOLDEN_FORMAT } from '../test/fixtures/goldenFormat';

const OUT = fileURLToPath(new URL('../test/goldens/frame/', import.meta.url));

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

// One member per line so a regression reads as a per-member diff in review.
function prettySnapshot(snap: ReturnType<typeof frameSnapshot>): string {
  const members = snap.members.map((m) => '    ' + canonicalJson(m)).join(',\n');
  return `{\n  "format": ${JSON.stringify(snap.format)},\n  "levels": ${canonicalJson(snap.levels)},\n  "members": [\n${members}\n  ]\n}\n`;
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.json')) rmSync(join(OUT, f));

const index: { name: string; note: string; members: number; sha256: string }[] = [];
for (const fx of FULL_FIXTURES) {
  const snap = frameSnapshot(generateFrame(fx.input));
  writeFileSync(join(OUT, `${fx.name}.json`), prettySnapshot(snap));
  index.push({
    name: fx.name,
    note: fx.note,
    members: snap.members.length,
    sha256: sha256(canonicalJson(snap)),
  });
}

const matrix: { name: string; members: number; sha256: string }[] = MATRIX_FIXTURES.map((fx) => {
  const snap = frameSnapshot(generateFrame(fx.input));
  return { name: fx.name, members: snap.members.length, sha256: sha256(canonicalJson(snap)) };
});

writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify({ format: GOLDEN_FORMAT, generatedFrom: 'src/timber/frame.ts generateFrame', full: index, matrix }, null, 2) + '\n',
);

const bytes = index.reduce((a, r) => a + r.members, 0);
console.log(`gen-frame-goldens: ${index.length} full goldens (${bytes} members) + ${matrix.length} hashed matrix rows → test/goldens/frame/`);
