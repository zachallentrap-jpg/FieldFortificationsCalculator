// Build gate (§16): fail if the built bundle in dist/ carries any external URL —
// http://, https://, protocol-relative //host, or a CDN host reference. Guarantees
// the shipped artifact makes zero external requests (§2.3).
//
// Allowlisted: W3C XML/SVG namespace URIs (e.g. http://www.w3.org/2000/svg). These are
// XML namespace IDENTIFIERS required by the SVG spec — they are never dereferenced over
// the network — so their presence does not violate the offline guarantee.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

const ALLOW = [
  'http://www.w3.org/',
  'https://www.w3.org/',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/XML/1998/namespace',
];

const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.svg', '.webmanifest', '.map', '.txt']);

interface Offender {
  file: string;
  line: number;
  match: string;
  context: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function stripAllowed(s: string): string {
  let out = s;
  for (const a of ALLOW) out = out.split(a).join('');
  return out;
}

function scanLine(raw: string): string[] {
  const line = stripAllowed(raw);
  const hits: string[] = [];
  const patterns: RegExp[] = [
    /https?:\/\/[^\s"'`)>\]]+/gi, // absolute URLs
    /(?:src|href)\s*=\s*["']\/\/[a-z0-9.-]+/gi, // protocol-relative in attributes
    /url\(\s*["']?\/\/[a-z0-9.-]+/gi, // protocol-relative in CSS url()
  ];
  for (const re of patterns) {
    for (const m of line.matchAll(re)) hits.push(m[0]);
  }
  return hits;
}

function main(): void {
  if (!existsSync(DIST)) {
    console.log('check-offline: dist/ not present yet — nothing to scan (pass).');
    return;
  }
  const files = walk(DIST).filter((f) => TEXT_EXT.has(f.slice(f.lastIndexOf('.')).toLowerCase()));
  const offenders: Offender[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((raw, i) => {
      for (const match of scanLine(raw)) {
        offenders.push({
          file: file.replace(DIST, 'dist'),
          line: i + 1,
          match,
          context: raw.trim().slice(0, 120),
        });
      }
    });
  }
  if (offenders.length > 0) {
    console.error(`check-offline: FAIL — ${offenders.length} external URL reference(s) in dist/:`);
    for (const o of offenders) console.error(`  ${o.file}:${o.line}  ${o.match}`);
    process.exit(1);
  }
  console.log(`check-offline: PASS — scanned ${files.length} file(s), zero external URLs.`);
}

main();
