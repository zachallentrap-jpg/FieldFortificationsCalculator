// Regenerate the pinned training vectors (TRAINING_AND_PACKETS_PLAN §2.3, FD16/FD18).
//
// The payload is `trainVectors()`, which the test imports from the same module, so the
// generator and the assertion can never describe different things. Run this ONLY when a
// scheduling change is intended, then read the diff: every line that moves is a learner whose
// deck order moved.
//
//   npm run gen:train-vectors

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { trainVectors } from '../test/fixtures/trainVectors';

const out = fileURLToPath(new URL('../test/fixtures/train-vectors.json', import.meta.url));
writeFileSync(out, `${JSON.stringify(trainVectors(), null, 2)}\n`);
console.log(`wrote ${out}`);
