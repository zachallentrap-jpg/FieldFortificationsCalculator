// Single-file build (§16). Inlines the Vite output (survivability.html + its JS/CSS) into a
// self-contained dist/survivability-standalone.html that runs from file:// with ZERO external
// requests — the true air-gap artifact (service workers don't run from file://, so this is
// the offline fallback). Named *-standalone so it never collides with the suite build's own
// dist/survivability.html page.
// Inline module scripts execute from file:// without CORS issues (CORS only applies to fetched
// module resources, of which we have none — everything is bundled into one chunk).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
// The suite build (vite.config.ts) is multi-page and shares chunks between tools, which an
// HTML-level inliner can't fold into one file. Prefer the dedicated single-chunk build
// (vite.standalone.config.ts → dist-standalone/) when present; fall back to dist/ for the
// legacy single-page pipeline.
const SINGLE = fileURLToPath(new URL('../dist-standalone', import.meta.url));
const SRC = existsSync(join(SINGLE, 'survivability.html')) ? SINGLE : DIST;
const indexPath = join(SRC, 'survivability.html');

if (!existsSync(indexPath)) {
  console.error('build-standalone: survivability.html not found — run `vite build -c vite.standalone.config.ts` first.');
  process.exit(1);
}

const resolve = (ref: string): string => join(SRC, ref.replace(/^\.?\//, ''));
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

writeFileSync(join(DIST, 'survivability-standalone.html'), html);
console.log('build-standalone: wrote dist/survivability-standalone.html (' + Math.round(html.length / 1024) + ' KB)');
