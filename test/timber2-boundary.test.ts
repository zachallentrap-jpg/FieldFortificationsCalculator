// TIMBER-2 §6.4 — the boundary gates, made real.
//
// Plan §2.7 draws a line between two tools: the survivability tool owns how much earth defeats
// what, and every output a reader could take as "you are protected". This tool owns the wood.
// The line is only worth drawing if crossing it fails a build, so:
//
//   1. A word-boundary lexicon over STRING LITERALS in src/timber and src/ui. Word boundaries,
//      not substrings — a naive scan trips on `Math.round` and misses `blast`.
//   2. A publication denylist: nothing may cite the survivability publications except the
//      bunker's dead-load entries, which is what makes "configuration reference only" testable.
//   3. Positive assertions that the boundary sentence actually renders where it must, so the
//      gate can be tightened without anyone quietly deleting the copy it protects.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COVER_DEPTH_NOTE, allDoctrineEntries } from '../src/timber/doctrine';
import { familyById } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import { configSchemaFor } from '../src/ui/woodframe/config';
import { encodeSpec, decodeSpec, isShareSafe } from '../src/ui/woodframe/router';
import { specToJson } from '../src/timber/normalize';
import { bomSummary } from '../src/timber/bom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|html|css)$/.test(name)) out.push(full);
  }
  return out;
}

// Extensible on purpose — the plan says so. Add a word here, not a special case at a call site.
const LEXICON = /\b(frag(mentation)?|caliber|blast|artillery|mortar|shrapnel|threat|standoff|protection level|shielding|\d+\s*mm)\b/i;

// The exact sentences the boundary itself needs. Allowlisted by VALUE, so the lexicon can be
// strengthened without the copy having to be re-approved.
const ALLOWED = [COVER_DEPTH_NOTE];

test('§6.4.1: no protection vocabulary in any shipped string', () => {
  const offenders: string[] = [];
  // Scoped to what SHIPS in the suite: the engine, and the wood-frame UI that consumes it.
  // `src/ui/main.ts` and its siblings are SAP-1's retired app — excluded from the suite build by
  // vite.suite.config.ts — and they legitimately carry survivability vocabulary because that is
  // the tool that owns it. Gating them would be gating the wrong side of the boundary.
  const files = [
    ...sources(`${ROOT}src/timber`),
    ...sources(`${ROOT}src/ui/woodframe`),
    `${ROOT}src/ui/woodframe-scene.ts`,
    `${ROOT}src/ui/woodframe.css`,
    `${ROOT}src/ui/woodframe-plan.html`,
    `${ROOT}src/ui/woodframe-learn.html`,
    `${ROOT}src/ui/hub.html`,
  ];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      // Comments are prose ABOUT the boundary and must be able to name what they exclude —
      // this gate is over what SHIPS, and a comment does not ship into the UI.
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
      if (ALLOWED.some((a) => code.includes(a))) return;
      const m = LEXICON.exec(code);
      if (m) offenders.push(`${file.slice(ROOT.length)}:${i + 1}  ${m[0]}  — ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(offenders, [], `protection vocabulary reached shipped strings:\n  ${offenders.join('\n  ')}`);
});

test('§6.4.2: only the bunker dead-load entries may cite the survivability publications', () => {
  const denied = /ATP 3-37\.34|FM 5-103/;
  for (const entry of allDoctrineEntries()) {
    if (!denied.test(entry.cite)) continue;
    assert.ok(entry.id.startsWith('BUNKER.'), `${entry.id} cites a survivability publication but is not a BUNKER dead-load entry`);
    assert.ok(
      /dead[- ]load|configuration/i.test(entry.cite),
      `${entry.id} cites a survivability publication without naming the admitted table — "configuration reference only" has to be visible in the cite`,
    );
  }
});

test('§6.4.3: the boundary sentence renders on the card, the panel and the ghost', () => {
  const family = familyById('crib-bunker')!;
  assert.ok(family.oneLiner.includes(COVER_DEPTH_NOTE), 'the card blurb carries it');

  const schema = configSchemaFor('crib-bunker');
  const depthRow = schema.groups.flatMap((g) => g.rows).find((r) => r.path === 'designCoverDepthFt');
  assert.equal(depthRow?.help, COVER_DEPTH_NOTE, 'the input that takes the number explains what it is');

  const model = generateStructure(JSON.parse(JSON.stringify(family.preset)));
  const ghost = model.members.find((m) => m.role === 'soilGhost');
  assert.ok(ghost, 'the massing is generated');
  assert.equal(ghost!.doctrineRef, COVER_DEPTH_NOTE, 'the ghost label IS the boundary sentence');
  const stage = model.stagePlan.find((s) => s.key === 'soil-ghost');
  assert.equal(stage?.detail, COVER_DEPTH_NOTE, 'and so is its stage note');
});

test('§2.7: the cover-depth massing is never material', () => {
  const model = generateStructure(JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset)));
  const ghost = model.members.find((m) => m.role === 'soilGhost')!;
  // classifyNominal routes anything unrecognised to 'other', which bomSummary bills at zero
  // board-feet. Assert the OUTCOME rather than the routing, because the outcome is the promise.
  const bom = bomSummary(model.members, model.stagePlan);
  const ghostStage = bom.stages.find((s) => s.stage === ghost.stage);
  assert.equal(ghostStage?.boardFeet ?? 0, 0, 'the massing contributes no board-feet');
});

test('§2.7: a shared spec carries no cover depth, but a stored one does', () => {
  const spec = JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset));
  spec.designCoverDepthFt = 3;

  const link = encodeSpec(spec);
  const roundTripped = decodeSpec(link)!;
  assert.equal((roundTripped as unknown as Record<string, unknown>).designCoverDepthFt, undefined,
    'a share link must not carry a survivability number off the device');
  assert.ok(isShareSafe(JSON.stringify(roundTripped)));

  // The on-device form keeps it, so a crash-resume regenerates without re-prompting.
  assert.ok(specToJson(spec).includes('designCoverDepthFt'), 'the stored session keeps the value');
});
