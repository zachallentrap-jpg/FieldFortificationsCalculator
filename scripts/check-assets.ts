// TIMBER-2 T0 — "no new dist assets" made verifiable (plan §7 T0, I-10).
//
// The deploy sandbox is the regime the OOM class lives in, and the plan's answer is that
// picker art is SELF-GENERATED at runtime (TD11) — nothing new ever enters the bundler's
// asset path. That promise was previously only prose. This script turns it into a gate: the
// dist asset basenames are compared against an explicit allowlist, and anything unexpected
// fails the build with the file named.
//
//   npm run check:assets     # after a build; no dist/ yet = pass (nothing to scan)
//
// Adding an asset is legal — but it is a DELIBERATE act: add the basename below in the same
// change, so review sees it. Hashed bundle names are matched by pattern, not literally.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

// Code and markup the bundler always emits — allowed by pattern (content hashes vary).
const CODE_PATTERNS: RegExp[] = [
  /^[\w.-]+-[A-Za-z0-9_-]{8}\.(js|css)$/, // hashed chunks: woodframe-D5giRZC5.js
  /^[\w.-]+\.(js|css|html|map)$/, // unhashed entries: woodframe.js, index.html, sw.js
];

// Non-code files that ship on purpose. Everything here was in dist before TIMBER-2 started.
const ASSET_ALLOWLIST = new Set([
  'manifest.webmanifest',
  'SAP-1_drawing_reference.svg',
  'icon.svg', // public/icons/icon.svg — the toolkit's app icon (pre-TIMBER-2 baseline)
  'favicon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  // Blender-authored lumber props (DECISIONS D28 — the one sanctioned inline exception).
  'lumber_2x4.glb',
  'lumber_2x6.glb',
  'lumber_4x4.glb',
  'plywood.glb',
  'sandbag.glb',
  'picket.glb',
]);

if (!existsSync(DIST)) {
  console.log('check-assets: dist/ not present yet — nothing to scan (pass).');
  process.exit(0);
}

const offenders: string[] = [];
let scanned = 0;

function walk(dir: string, rel: string): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      walk(abs, rel ? `${rel}/${entry}` : entry);
      continue;
    }
    scanned++;
    // Vite content-hashes emitted assets (lumber_2x4-CZ7P8OrR.glb). Compare on the stem so
    // the allowlist names the ASSET, not whatever hash this build happened to produce.
    const unhashed = entry.replace(/-[A-Za-z0-9_-]{8}(\.[^.]+)$/, '$1');
    if (ASSET_ALLOWLIST.has(entry) || ASSET_ALLOWLIST.has(unhashed)) continue;
    if (CODE_PATTERNS.some((re) => re.test(entry))) continue;
    // Anything with no extension (LICENSE, etc.) or an unlisted asset extension is new art.
    const ext = extname(entry).toLowerCase();
    const assetish = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.glb', '.gltf', '.woff', '.woff2', '.ttf', '.mp3', '.mp4', '.wasm'];
    if (assetish.includes(ext) || ext === '') {
      offenders.push(rel ? `${rel}/${entry}` : entry);
    }
  }
}

walk(DIST, '');

if (offenders.length > 0) {
  console.error('check-assets: FAIL — unlisted asset(s) in dist/:');
  for (const f of offenders) console.error(`  ${f}`);
  console.error('\nPicker art is runtime-generated SVG (TIMBER2_PLAN TD11) — no image files should appear.');
  console.error('If an asset is genuinely intended, add its basename to ASSET_ALLOWLIST in scripts/check-assets.ts');
  console.error('in the SAME change, so review sees the addition.');
  process.exit(1);
}

console.log(`check-assets: PASS — scanned ${scanned} file(s), no unlisted assets.`);
