// TIMBER-2 — rewrite the committed thumbnail goldens (plan §4.4, TD11/R4).
//
//   npm run update:thumb-goldens
//
// The goldens are FULL SVG FILES, not hashes, so a card-art change shows up in review as a
// visual diff somebody can actually look at. The rule that makes that work: goldens are
// updated in the SAME pull request as the change that moved them, never as a standalone
// "update goldens" commit — otherwise the diff is real but nobody reads it.
//
// The structural assertions in `test/timber2-thumbs.test.ts` (no external refs, no script,
// polygon budget) are independent of this compare, so a rubber-stamped golden update still
// fails if the art picked up something it should not contain.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { thumbnailFor } from '../src/timber/thumbnails';
import { portraitFor } from '../src/timber/portrait';

const OUT = fileURLToPath(new URL('../test/goldens/thumbs/', import.meta.url));
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.svg')) rmSync(join(OUT, f));

// TWO drawings per family, because the toolkit now has two ways of drawing a structure and both
// are shipped art. The line drawing goes on the printed packet cover, where a solid render would
// be a page of toner; the SOLID one is every card on screen. Pinning only one would leave the
// other free to drift, and the solid one is the one people look at.
let count = 0;
for (const family of FAMILY_TABLE) {
  if (!family.shipped) continue;
  writeFileSync(join(OUT, `${family.id}.svg`), thumbnailFor(family.preset) + '\n');
  writeFileSync(join(OUT, `${family.id}.solid.svg`), portraitFor(family.preset, { width: 300, height: 200 }) + '\n');
  count += 2;
}
console.log(`gen-thumb-goldens: wrote ${count} SVG golden(s) → test/goldens/thumbs/`);
