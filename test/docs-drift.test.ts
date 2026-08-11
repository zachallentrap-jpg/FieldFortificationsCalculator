// The shipped documents against the code they describe.
//
// WHY THIS EXISTS. PLACEHOLDER_POLICY.md described a `fieldUseBanner()` in `src/render/chrome.ts`
// and a header badge in `src/layout/shell.ts`. Neither had ever existed in this tree; the
// document told a qualified user that a NOT FOR FIELD USE banner rode on the drawings and would
// clear itself when the last placeholder was filled, and the reader had no way to know it was
// reading fiction. It also credited a test file that tests a different file format entirely.
// Nothing under test/ or scripts/ read a single one of these documents, so the claims aged for
// twenty leaves of doctrine growth without anything noticing.
//
// WHAT IT CHECKS, AND WHY IT IS DRIVEN BY THE DOCUMENTS THEMSELVES. A hand-kept list of "things
// to verify" is one more thing that drifts — the checklist this repo already learned that from is
// DOCTRINE_SOURCES.md. So nothing here enumerates what the docs ought to say. It reads what they
// DO say — every file path, every `symbol()`, every dotted registry path, every link — and holds
// each of those to the tree:
//
//   · a repo path in a code span must exist;
//   · a `symbol()` must exist in the source, and when the same line also names a .ts file, it
//     must exist IN THAT FILE — which is exactly the shape of the banner claim ("`fieldUseBanner()`
//     in `src/render/chrome.ts`");
//   · a dotted path whose head is a doctrine table must resolve in the live registry;
//   · a link must point at something that is there, including a heading anchor within the doc;
//   · and a section that lists the safety-critical leaves must list exactly the leaves the
//     registry tags safetyCritical — no more, and none missing.
//
// A doc claim this cannot express is still unguarded. That is a reason to write claims this can
// see — name the file, name the symbol — not a reason to trust the rest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../src/doctrine/index';
import { all } from '../src/doctrine/registry';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const at = (p: string): string => ROOT + p;

/** The shipped documents: every Markdown file at the repo root. */
const DOC_NAMES = readdirSync(ROOT)
  .filter((f) => f.endsWith('.md'))
  .sort();

interface Doc {
  name: string;
  lines: string[];
}
const DOCS: Doc[] = DOC_NAMES.map((name) => ({ name, lines: readFileSync(at(name), 'utf8').split('\n') }));

// ── What a claim looks like in Markdown ──────────────────────────────────────

const codeSpans = (line: string): string[] => [...line.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!);

/** A path into this repository, as the docs write one. */
const REPO_PATH = /^(?:src|test|scripts|docs|public|sap2)(?:\/[\w.@-]+)*\/?$/;
const isRepoPath = (t: string): boolean => REPO_PATH.test(t);

/** `doSomething()` — a named function the doc says the code has. */
const symbolIn = (token: string): string | null => {
  const m = /^([A-Za-z_$][\w$]*)\(\)$/.exec(token);
  return m ? m[1]! : null;
};

/** The doctrine tables, read from the registry rather than listed here. */
const REGISTRY_ROOTS = new Set(all().map((e) => e.path.split(/[.[]/)[0]!));
const REGISTRY_PATH = /^[a-z][\w]*(?:\.[\w-]+|\[\d+\])+$/;
const isRegistryPath = (t: string): boolean =>
  REGISTRY_PATH.test(t) && REGISTRY_ROOTS.has(t.split(/[.[]/)[0]!);

/** Whether any registered leaf IS this path or lives under it. */
const registryMatches = (token: string): string[] =>
  all().map((e) => e.path).filter((p) => p === token || p.startsWith(token + '.') || p.startsWith(token + '['));

// ── The source tree the symbols are checked against ──────────────────────────

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + entry.name;
    if (entry.isDirectory()) tsFiles(p, out);
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) out.push(p);
  }
  return out;
}
const SOURCE_FILES = ['src', 'test', 'scripts'].flatMap((d) => tsFiles(at(d)));
const SOURCE_TEXT = new Map(SOURCE_FILES.map((f) => [f, readFileSync(f, 'utf8')]));
const declares = (text: string, symbol: string): boolean => new RegExp(`\\b${symbol}\\b`).test(text);

// ── The claims ───────────────────────────────────────────────────────────────

/**
 * The one document whose paths are NOT claims about the tree as it stands. A decision log's
 * genre is "we considered X and did Y instead": it names rejected alternatives (`src/sw.ts`),
 * files from branches that never merged (`src/ui/survivability.html`), and modules a later
 * decision removed on purpose (`src/timber/data.ts`). Requiring those to exist would be asking
 * the log to lie about its own history. Every other check below still reads it — a symbol, a
 * doctrine path or a link in a decision entry is a claim about the code, and is held as one.
 */
const PATH_EXEMPT = new Set(['DECISIONS.md']);

test('every repo path the docs name exists', () => {
  const missing: string[] = [];
  for (const doc of DOCS.filter((d) => !PATH_EXEMPT.has(d.name))) {
    doc.lines.forEach((line, i) => {
      for (const token of codeSpans(line)) {
        if (!isRepoPath(token)) continue;
        if (!existsSync(at(token))) missing.push(`${doc.name}:${i + 1} names ${token}, which is not in the tree`);
      }
    });
  }
  assert.deepEqual(missing, [], `documented paths that do not exist:\n  ${missing.join('\n  ')}`);
});

test('every symbol the docs name exists — in the file they name it in, when they name one', () => {
  // The A6 shape exactly: "`fieldUseBanner()` in `src/render/chrome.ts`". Pairing on the line is
  // what makes the check bite, because a symbol that exists SOMEWHERE is a low bar — the claim a
  // reader acts on is that it is in that file, doing that job.
  const wrong: string[] = [];
  for (const doc of DOCS) {
    doc.lines.forEach((line, i) => {
      const tokens = codeSpans(line);
      const named = tokens
        .filter((t) => isRepoPath(t) && t.endsWith('.ts'))
        .map((t) => at(t))
        .filter((f) => SOURCE_TEXT.has(f));
      for (const token of tokens) {
        const symbol = symbolIn(token);
        if (symbol === null) continue;
        const scope = named.length > 0 ? named : [...SOURCE_TEXT.keys()];
        if (scope.some((f) => declares(SOURCE_TEXT.get(f)!, symbol))) continue;
        wrong.push(
          `${doc.name}:${i + 1} names ${token}, which is nowhere in `
          + (named.length > 0 ? named.map((f) => f.slice(ROOT.length)).join(' / ') : 'src/, test/ or scripts/'),
        );
      }
    });
  }
  assert.deepEqual(wrong, [], `documented symbols that are not where the doc says:\n  ${wrong.join('\n  ')}`);
});

test('every doctrine path the docs name resolves in the live registry', () => {
  const dead: string[] = [];
  for (const doc of DOCS) {
    doc.lines.forEach((line, i) => {
      for (const token of codeSpans(line)) {
        if (!isRegistryPath(token)) continue;
        if (registryMatches(token).length === 0) {
          dead.push(`${doc.name}:${i + 1} points at ${token}, which is no longer a doctrine value`);
        }
      }
    });
  }
  assert.deepEqual(dead, [], `documented doctrine paths with no leaf behind them:\n  ${dead.join('\n  ')}`);
});

test('every link in the docs points at something that is there', () => {
  const slug = (heading: string): string =>
    heading
      .replace(/^#+\s*/, '')
      .toLowerCase()
      .replace(/[`*_]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
  const broken: string[] = [];
  for (const doc of DOCS) {
    const anchors = new Set(doc.lines.filter((l) => /^#{1,6}\s/.test(l)).map(slug));
    doc.lines.forEach((line, i) => {
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = m[1]!;
        if (/^(?:https?:|mailto:)/.test(target)) continue;
        if (target.startsWith('#')) {
          if (!anchors.has(target.slice(1))) broken.push(`${doc.name}:${i + 1} links to ${target}, no such heading`);
          continue;
        }
        const path = at(target.split('#')[0]!);
        if (!existsSync(path)) broken.push(`${doc.name}:${i + 1} links to ${target}, which is not in the tree`);
      }
    });
  }
  assert.deepEqual(broken, [], `broken documentation links:\n  ${broken.join('\n  ')}`);
});

// ── The safety-critical list ─────────────────────────────────────────────────
//
// Two documents tell a qualified user which values are the life-safety ones. That list is the
// one thing in them a reader is most likely to work straight from, and it is exactly the kind of
// prose that goes stale when a leaf is tagged or untagged in source. So it is not read as prose:
// a section headed for safety-critical values, listing registry paths as bullets, IS the claim,
// and it is held to the registry in both directions.

interface ScSection {
  where: string;
  tokens: string[];
}

function scSections(): ScSection[] {
  const out: ScSection[] = [];
  for (const doc of DOCS) {
    let heading: string | null = null;
    let line0 = 0;
    let tokens: string[] = [];
    const flush = (): void => {
      if (heading !== null && tokens.length > 0) out.push({ where: `${doc.name}:${line0} (${heading.trim()})`, tokens });
      heading = null;
      tokens = [];
    };
    doc.lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) {
        flush();
        if (/safety[-\s]?critical/i.test(line)) {
          heading = line;
          line0 = i + 1;
        }
        return;
      }
      if (heading === null) return;
      if (!/^\s*[-*]\s/.test(line)) return;
      tokens.push(...codeSpans(line).filter(isRegistryPath));
    });
    flush();
  }
  return out;
}

test('the docs list exactly the leaves the registry tags safety-critical', () => {
  const sections = scSections();
  // A floor, because an empty list satisfies "nothing wrong is claimed" perfectly: deleting the
  // list rather than updating it must not be the quiet way past this test.
  assert.ok(
    sections.length >= 2,
    `only ${sections.length} document section(s) list the safety-critical leaves — `
    + 'PLACEHOLDER_POLICY.md and DOCTRINE_SOURCES.md each carry one',
  );

  const sc = new Set(all().filter((e) => e.safetyCritical).map((e) => e.path));
  const problems: string[] = [];
  for (const section of sections) {
    const claimed = new Set<string>();
    for (const token of section.tokens) {
      const leaves = registryMatches(token);
      if (leaves.length === 0) {
        problems.push(`${section.where} lists ${token}, which is no longer a doctrine value`);
        continue;
      }
      for (const leaf of leaves) {
        claimed.add(leaf);
        if (!sc.has(leaf)) problems.push(`${section.where} lists ${token}, but ${leaf} is not tagged safetyCritical`);
      }
    }
    for (const leaf of sc) {
      if (!claimed.has(leaf)) problems.push(`${section.where} omits ${leaf}, which IS tagged safetyCritical`);
    }
  }
  assert.deepEqual(problems, [], `the documented safety-critical set and the registry disagree:\n  ${problems.join('\n  ')}`);
});

test('the documents this gate reads are the ones that ship', () => {
  // The corpus is a glob, so a new root document is covered the day it lands — but a rename or a
  // deletion that quietly emptied the walk would leave every test above passing over nothing.
  assert.ok(DOCS.length >= 4, `only ${DOCS.length} root documents found`);
  for (const required of ['README.md', 'PLACEHOLDER_POLICY.md', 'USER_GUIDE.md', 'DOCTRINE_SOURCES.md']) {
    assert.ok(DOC_NAMES.includes(required), `${required} is no longer at the repo root`);
    assert.ok(statSync(at(required)).size > 0, `${required} is empty`);
  }
});
