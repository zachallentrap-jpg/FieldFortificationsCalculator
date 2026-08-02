// Builds dist/sw.js from src/sw/entry.ts, injecting the precache list and a version
// stamp derived from the built assets themselves (content-addressed: the version
// changes when — and only when — the app actually changes, so a rebuild that changes
// nothing never nags the user with a phantom update).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { sha256Hex } from '../src/schema/sha256';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

// Precache everything the app needs to boot offline, EXCEPT sw.js itself and the
// single-file artifact (which is a separate download, not part of the hosted app).
const assets = walk(DIST)
  .map((p) => relative(DIST, p).replaceAll('\\', '/'))
  .filter((rel) => !rel.startsWith('sw.js') && !rel.startsWith('sap2-standalone'))
  .sort();

const version = sha256Hex(
  assets.map((rel) => `${rel}:${sha256Hex(readFileSync(join(DIST, rel)))}`).join('\n'),
).slice(0, 12);

const precache = ['./', ...assets.map((rel) => `./${rel}`)];

await build({
  root: ROOT,
  configFile: false,
  define: {
    __SW_VERSION__: JSON.stringify(version),
    __SW_PRECACHE__: JSON.stringify(precache),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2022',
    minify: true,
    rollupOptions: {
      input: join(ROOT, 'src/sw/entry.ts'),
      output: { entryFileNames: 'sw.js', format: 'iife', inlineDynamicImports: true },
    },
  },
  logLevel: 'warn',
});

console.log(`sw: version ${version}, ${precache.length} precached entries`);
