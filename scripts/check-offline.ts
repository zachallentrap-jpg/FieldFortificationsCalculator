// Build gate (§16): fail if the built bundle in dist/ carries any external URL —
// http://, https://, protocol-relative //host, or a CDN host reference. Guarantees
// the shipped artifact makes zero external requests (§2.3).
//
// Allowlisted: W3C XML/SVG namespace URIs (e.g. http://www.w3.org/2000/svg). These are
// XML namespace IDENTIFIERS required by the SVG spec — they are never dereferenced over
// the network — so their presence does not violate the offline guarantee.
//
// --require-dist  Treat "nothing to scan" as a FAILURE. Without it this gate reports a
//                 pass when dist/ is absent, which is exactly how it went quiet in CI:
//                 `verify` ran it on a fresh checkout BEFORE `build:suite`, so it scanned
//                 zero files and printed "(pass)". A gate that measures nothing must never
//                 report success where the guarantee is actually being claimed. CI and
//                 `verify:full` run the strict form AFTER the build; the lenient form
//                 survives only as an early local warning against whatever dist/ you have.
// --dir=<path>    Scan somewhere other than ../dist (used by test/gate-offline.test.ts to
//                 prove both the strict failure and the scanner itself still bite).

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const REQUIRE_DIST = argv.includes('--require-dist');
const dirArg = argv.find((a) => a.startsWith('--dir='));
const DIST = dirArg ? resolve(dirArg.slice('--dir='.length)) : fileURLToPath(new URL('../dist', import.meta.url));

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

/** Nothing was measured. Fatal under --require-dist; an honest SKIP otherwise. */
function nothingToScan(why: string): never | void {
  if (REQUIRE_DIST) {
    console.error(
      `check-offline: FAIL — ${why}, so the offline guarantee was not verified.\n` +
      '  This gate runs AFTER `npm run build:suite`. If the build was skipped or emitted\n' +
      '  nothing, that is the defect — not a reason to pass.',
    );
    process.exit(1);
  }
  console.log(`check-offline: SKIPPED — ${why}. Nothing was checked; this is not a pass.`);
}

function main(): void {
  if (!existsSync(DIST)) return nothingToScan(`${DIST} does not exist`);

  const files = walk(DIST).filter((f) => TEXT_EXT.has(f.slice(f.lastIndexOf('.')).toLowerCase()));

  // An empty (or all-binary) dist/ is the same vacuum wearing a different hat: the scan
  // "passes" having read nothing. Close the whole class, not just the missing-dir case.
  if (files.length === 0) return nothingToScan(`${DIST} holds no scannable text files`);

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
