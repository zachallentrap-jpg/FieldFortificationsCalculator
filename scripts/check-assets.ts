// TIMBER-2 T0 item (3) — "no new images" becomes verifiable.
//
// The toolkit ships offline with zero external requests, and its deploy build already
// died once from base64-inlining binary assets. Both plans therefore promise "zero new
// dist asset files" as an acceptance criterion, which was previously unmeasurable
// prose. This is the measurement.
//
// Rule: every file emitted under dist/ must match an allowlisted BASENAME PATTERN.
// Content-hashed names (index-AbC123.js) are matched by their stem, so a rebuild that
// changes a hash passes while a genuinely NEW asset fails and has to be justified by
// editing this file — in the same PR, visible in review.
//
//   node --import tsx scripts/check-assets.ts
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** Allowlisted emitted files. Adding a row is a deliberate, reviewable act. */
const ALLOWED: readonly { pattern: RegExp; why: string }[] = [
  // Pages
  { pattern: /^index\.html$/, why: 'hub, served at /' },
  { pattern: /^hub\.html$/, why: 'hub at its own name (sub-app back links target it)' },
  { pattern: /^woodframe\.html$/, why: 'TIMBER-1' },
  { pattern: /^survivability\/index\.html$/, why: 'SAP-2' },

  // Scripts
  { pattern: /^assets\/woodframe-[\w-]+\.js$/, why: 'TIMBER-1 bundle (content-hashed)' },
  { pattern: /^survivability\/assets\/index-[\w-]+\.js$/, why: 'SAP-2 bundle (content-hashed)' },
  { pattern: /^sw\.js$/, why: "v1 service-worker retirement (cache-killer), written by build-suite" },
  { pattern: /^survivability\/sw\.js$/, why: 'SAP-2 service worker (update button depends on it)' },

  // Static assets carried from public/
  { pattern: /^manifest\.webmanifest$/, why: 'PWA manifest' },
  { pattern: /^icons\/[\w.-]+\.svg$/, why: 'app icon' },
  { pattern: /^SAP-1_drawing_reference\.svg$/, why: 'legacy drawing reference' },
  { pattern: /^assets\/(lumber_2x4|lumber_2x6|lumber_4x4|picket|sandbag)-[\w-]+\.glb$/,
    why: '3D props — emitted as FILES, never base64-inlined (the deploy OOM class)' },
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

let emitted: string[];
try {
  emitted = walk(DIST).map((p) => relative(DIST, p).replaceAll('\\', '/')).sort();
} catch {
  console.error('check-assets: dist/ not found — run `npm run build:suite` first.');
  process.exit(1);
}

const unexpected = emitted.filter((rel) => !ALLOWED.some(({ pattern }) => pattern.test(rel)));

if (unexpected.length > 0) {
  console.error('check-assets: FAIL — dist/ contains files no allowlist row covers:\n');
  for (const rel of unexpected) console.error(`  ${rel}`);
  console.error(
    '\nIf this asset is intended, add a row to scripts/check-assets.ts explaining WHY,\n' +
    'in the same PR. If it is not, the build is shipping something nobody chose.',
  );
  process.exit(1);
}

// A dead allowlist row is also a defect: it hides an asset that silently stopped
// shipping (e.g. a GLB that quietly went back to being inlined).
const unmatched = ALLOWED.filter(({ pattern }) => !emitted.some((rel) => pattern.test(rel)));
if (unmatched.length > 0) {
  console.error('check-assets: FAIL — allowlist rows match nothing in dist/:\n');
  for (const { pattern, why } of unmatched) console.error(`  ${pattern}  (${why})`);
  console.error('\nEither the asset stopped shipping, or the row is stale. Both need a decision.');
  process.exit(1);
}

console.log(`check-assets: PASS — ${emitted.length} emitted file(s), all allowlisted.`);
