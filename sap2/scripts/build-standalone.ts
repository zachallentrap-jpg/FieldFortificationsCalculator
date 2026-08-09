// Single-file build (blueprint B32): inlines the vite output into ONE self-contained
// HTML that boots from file:// on a clean, air-gapped machine — the fill vehicle
// exists before the fill does. Ports v1's proven inliner (the one export path that
// never rendered black). Emits dist/sap2-standalone.html + a .sha256 sidecar; the
// release script records the hash in RELEASES.md.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../src/schema/sha256';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const indexPath = join(DIST, 'index.html');
if (!existsSync(indexPath)) {
  console.error('build-standalone: dist/index.html not found — run `vite build` first.');
  process.exit(1);
}

const resolve = (ref: string): string => join(DIST, ref.replace(/^\.?\//, ''));
let html = readFileSync(indexPath, 'utf8');

// Inline every module script by src (single-chunk build; zero dynamic imports).
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (m, src: string) => {
  const p = resolve(src);
  if (!existsSync(p)) return m;
  const js = readFileSync(p, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  return '<script type="module">\n' + js + '\n</script>';
});

// Inline every stylesheet.
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (m, href: string) => {
  const p = resolve(href);
  if (!existsSync(p)) return m;
  return '<style>\n' + readFileSync(p, 'utf8') + '\n</style>';
});

// Drop modulepreload hints (nothing left to preload; they 404 from file://).
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');

// Remove the back-to-hub link outright. The single-file copy is a standalone
// distribution with no toolkit around it, so the link has nowhere to go — the
// runtime also hides it on file://, but a dead href must not survive into the
// artifact at all (the self-containment check below would fail on it, correctly).
html = html.replace(/<a\b[^>]*\bid="back-to-hub"[^>]*>[\s\S]*?<\/a>/g, '');

const remaining = [...html.matchAll(/\b(?:src|href)="([^"#][^"]*)"/g)]
  .map((m) => m[1]!)
  .filter((u) => !u.startsWith('data:'));
if (remaining.length > 0) {
  console.error(`build-standalone: artifact still references external files: ${remaining.join(', ')}`);
  process.exit(1);
}

const outPath = join(DIST, 'sap2-standalone.html');
writeFileSync(outPath, html);
const hash = sha256Hex(html);
writeFileSync(outPath + '.sha256', `${hash}  sap2-standalone.html\n`);
console.log(`standalone: ${(html.length / 1024).toFixed(0)} KiB, sha256 ${hash}`);
