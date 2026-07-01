// Single-file build (§16). Inlines the Vite output (dist/index.html + its JS/CSS) into a
// self-contained dist/sap1.html that runs from file:// with ZERO external requests — the true
// air-gap artifact (service workers don't run from file://, so this is the offline fallback).
// Inline module scripts execute from file:// without CORS issues (CORS only applies to fetched
// module resources, of which we have none — everything is bundled into one chunk).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const indexPath = join(DIST, 'index.html');

if (!existsSync(indexPath)) {
  console.error('build-standalone: dist/index.html not found — run `vite build` first.');
  process.exit(1);
}

const resolve = (ref: string): string => join(DIST, ref.replace(/^\.?\//, ''));
let html = readFileSync(indexPath, 'utf8');

// Inline every module script by src (there is one bundled chunk; zero dynamic imports).
html = html.replace(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g, (m, src: string) => {
  const p = resolve(src);
  if (!existsSync(p)) return m;
  // Guard against a literal </script> inside the JS breaking the HTML parser.
  const js = readFileSync(p, 'utf8').replace(/<\/script>/gi, '<\\/script>');
  return '<script type="module">\n' + js + '\n</script>';
});

// Inline every stylesheet.
html = html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/g, (m, href: string) => {
  const p = resolve(href);
  if (!existsSync(p)) return m;
  return '<style>\n' + readFileSync(p, 'utf8') + '\n</style>';
});

// Drop now-redundant preload/manifest/SW hints — the standalone needs no external fetch.
html = html.replace(/<link\b[^>]*\brel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link\b[^>]*\brel="manifest"[^>]*>/g, '');

writeFileSync(join(DIST, 'sap1.html'), html);
console.log('build-standalone: wrote dist/sap1.html (' + Math.round(html.length / 1024) + ' KB)');
