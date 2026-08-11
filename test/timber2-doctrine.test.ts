// TIMBER-2 — doctrine data integrity and the dictionary lockstep (plan §8.6, I-11, I-14).
//
// Three things are checked that reviews miss:
//   1. every magnitude carries a citation, and unverified ones are visibly (PH);
//   2. the LS register is real — the fall/collapse/overload numbers are actually tagged, so
//      the UI badge and the CI ack gate see the same set;
//   3. `doctrine.ts` and the FROZEN legacy modules agree. The legacy generators keep their own
//      literals (editing them is a stop-the-line event, C-10), so the values are mirrored —
//      and mirrors drift unless something watches them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUMBER, PANEL, LAYOUT, FOUNDATION, STAIR, LADDER, RAIL, RAMP, ROOFING, SIDING, LABOR, NAILING,
  allDoctrineEntries, lifeSafetyRegister, citeOf,
} from '../src/timber/doctrine';
import { FULL_FIXTURES, MATRIX_FIXTURES } from './fixtures/frameFixtures';
import { DRESSED, type Member } from '../src/timber/types';
import { BF_PER_LF, classifyNominal, bomSummary } from '../src/timber/bom';
import { generateFrame, specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import { generateStructure } from '../src/timber/families/index';
import { FAMILY_TABLE } from '../src/timber/catalog';
import type { RoofSpec, StructureSpec } from '../src/timber/spec';

test('every doctrine constant carries a citation, and unverified ones are visibly (PH)', () => {
  const entries = allDoctrineEntries();
  assert.ok(entries.length > 40, `expected a real doctrine table, got ${entries.length} entries`);
  for (const e of entries) {
    assert.ok(e.cite.length > 8, `${e.id}: citation too thin ("${e.cite}")`);
    assert.notEqual(e.value, undefined, `${e.id}: no value`);
  }
  // The (PH) discipline: a pending cite must SAY so wherever it renders.
  const pending = entries.filter((e) => e.ph);
  assert.ok(pending.length > 0, 'the placeholder regime is still in force');
  for (const e of pending) {
    assert.ok(citeOf({ value: e.value, cite: e.cite, ph: true }).includes('(PH)'), `${e.id}: (PH) must render`);
  }
});

test('the life-safety register holds every fall / collapse / overload number', () => {
  const ls = lifeSafetyRegister();
  const ids = new Set(ls.map((e) => e.id));
  // Named by the plan (§6.2): rails, ladders, stairs, ramps, and the span/size tables.
  for (const required of [
    'RAIL.topHeightIn', 'RAIL.midHeightIn', 'RAIL.toeBoardHeightIn', 'RAIL.requiredAboveFt',
    'LADDER.rungSpacingIn', 'LADDER.cageThresholdFt', 'LADDER.topExtensionIn',
    'STAIR.maxRiserIn', 'STAIR.minTreadIn', 'STAIR.headroomIn',
    'RAMP.slopes',
    'LUMBER.joistNominal', 'LUMBER.girderNominal', 'LUMBER.headerNominal', 'LUMBER.rafterNominal',
  ]) {
    assert.ok(ids.has(required), `${required} must be life-safety tagged`);
  }
  for (const e of ls) {
    assert.ok(e.cite.length > 8, `${e.id}: an LS constant with a thin cite is the worst case`);
  }
  // While (PH), an LS cite must announce that a review is owed.
  const suffix = citeOf({ value: 42, cite: RAIL.topHeightIn.cite, ph: true, lifeSafety: true });
  assert.ok(suffix.includes('LIFE-SAFETY, review required'), suffix);
});

test('the safety block cites EM 385-1-1 — LS numbers have a doctrinal home (TD27)', () => {
  const safety = [
    RAIL.topHeightIn, RAIL.midHeightIn, RAIL.toeBoardHeightIn, RAIL.requiredAboveFt,
    LADDER.rungSpacingIn, LADDER.topExtensionIn, LADDER.cageThresholdFt,
    STAIR.maxRiserIn, STAIR.minTreadIn, STAIR.headroomIn, RAMP.slopes,
  ];
  for (const d of safety) {
    assert.ok(/EM 385-1-1/.test(d.cite), `safety constant must cite EM 385-1-1: "${d.cite}"`);
  }
});

test('doctrine mirrors the FROZEN legacy modules exactly — the two cannot drift apart', () => {
  // Sizes the legacy generators cut from, asserted against what they actually emitted.
  const model = generateStructure(specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
    letInBracing: true,
  }));
  const nominalOf = (role: string): string | undefined => model.members.find((m) => m.role === role)?.nominal;
  assert.equal(nominalOf('joist'), LUMBER.joistNominal.value);
  assert.equal(nominalOf('girder'), LUMBER.girderNominal.value);
  assert.equal(nominalOf('sill'), LUMBER.sillNominal.value);
  assert.equal(nominalOf('post'), LUMBER.postNominal.value);
  assert.equal(nominalOf('stud'), LUMBER.studNominal.value);
  assert.equal(nominalOf('solePlate'), LUMBER.plateNominal.value);
  assert.equal(nominalOf('rafter'), LUMBER.rafterNominal.value);
  assert.equal(nominalOf('ridge'), LUMBER.ridgeNominal.value);
  assert.equal(nominalOf('collarTie'), LUMBER.collarTieNominal.value);
  assert.equal(nominalOf('brace'), LUMBER.braceNominal.value);
  assert.equal(nominalOf('bridging'), LUMBER.crossBridgingNominal.value);
  // The built-up girder really is 3 plies.
  assert.equal(model.members.filter((m) => m.role === 'girder').length, LUMBER.girderPly.value);
  // Panel thicknesses, read off the emitted members.
  assert.equal(model.members.find((m) => m.role === 'subfloor')!.actual.w, PANEL.subfloorThickIn.value);
  assert.equal(model.members.find((m) => m.role === 'roofPanel')!.actual.w, PANEL.roofDeckThickIn.value);
});

test('LABOR values equal the legacy rates — a "pure refactor" must not reprice the job', () => {
  const model = generateStructure(specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
  }));
  const bom = bomSummary(model.members, model.stagePlan);
  const expected = bom.stages.reduce((a, s) => {
    const panels = s.panels;
    return a + s.boardFeet * (LABOR.mhPerBoardFoot.value as number) + panels * (LABOR.mhPerPanel.value as number);
  }, 0);
  // Piers-founded demo has concrete pads, so add their run at the concrete rate.
  const concLf = model.members
    .filter((m) => m.nominal.includes('conc'))
    .reduce((a, m) => a + m.cutLength / 12, 0);
  assert.ok(
    Math.abs(bom.totalManHours - (expected + concLf * (LABOR.mhPerConcreteLf.value as number))) < 1e-9,
    `labor drifted: ${bom.totalManHours}`,
  );
});

test('I-14: every nominal any generator emits resolves in BOTH DRESSED and BF_PER_LF', () => {
  // The `{1.5, 3.5}` fallback inside the emitters must be unreachable in real output: a
  // member whose nominal is missing from DRESSED silently renders at 2x4 size, and one
  // missing from BF_PER_LF silently contributes zero board-feet.
  const seen = new Set<string>();
  const inputs: BuildingInput[] = [];
  for (const foundation of [undefined, 'wall', 'basement'] as const) {
    for (const bridging of ['cross', 'solid'] as const) {
      inputs.push({
        lengthFt: 20, widthFt: 16, wallHeightFt: 8,
        studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
        risePer12: 4, overhangFt: 1, crawlFt: 1.5,
        openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
        foundation, bridging, letInBracing: true, atticAccess: true,
      });
    }
  }
  for (const i of inputs) for (const m of generateFrame(i).members) seen.add(m.nominal);

  for (const nominal of seen) {
    const kind = classifyNominal(nominal);
    if (kind === 'lumber') {
      assert.ok(DRESSED[nominal], `${nominal}: missing from DRESSED — would render as a 2x4`);
      assert.ok(BF_PER_LF[nominal] !== undefined, `${nominal}: missing from BF_PER_LF — would bill 0 BF`);
    } else {
      // Panels, concrete and hardware are measured their own way and are meant to miss
      // BF_PER_LF; assert that is a deliberate classification, not an oversight.
      assert.ok(['sheet', 'hardware', 'other'].includes(kind), `${nominal}: unclassified`);
    }
  }
  assert.ok(seen.size >= 8, `expected a broad nominal sample, saw ${seen.size}`);
});

test('DRESSED and BF_PER_LF stay in lockstep for every dimension-lumber size', () => {
  for (const nominal of Object.keys(DRESSED)) {
    assert.ok(BF_PER_LF[nominal] !== undefined, `${nominal} is dressed but has no board-foot rate`);
  }
  for (const nominal of Object.keys(BF_PER_LF)) {
    assert.ok(DRESSED[nominal], `${nominal} has a board-foot rate but no dressed size`);
    // The rate is the nominal section over 12 — check it against the name itself.
    const [w, d] = nominal.split('x').map(Number) as [number, number];
    assert.ok(Math.abs(BF_PER_LF[nominal]! - (w * d) / 12) < 1e-12, `${nominal}: BF/LF should be ${(w * d) / 12}`);
  }
});

test('classifyNominal sorts the bill into orderable sections', () => {
  assert.equal(classifyNominal('2x4'), 'lumber');
  assert.equal(classifyNominal('6x8'), 'lumber');
  assert.equal(classifyNominal('4x8 panel'), 'sheet');
  assert.equal(classifyNominal('roll roofing'), 'sheet');
  assert.equal(classifyNominal('corrugated 26x8'), 'sheet');
  assert.equal(classifyNominal('16d nails'), 'hardware');
  assert.equal(classifyNominal('T-hinge'), 'hardware');
  assert.equal(classifyNominal('conc wall 8"'), 'other');
  assert.equal(classifyNominal('earth fill'), 'other');
});

test('SIDING/ROOFING/FOUNDATION tables are populated (the coverings phase reads them)', () => {
  assert.equal(ROOFING.rollWidthIn.value, 36);
  assert.equal(ROOFING.squareSf.value, 100);
  assert.equal(ROOFING.squareSf.ph, false, 'a unit definition is not a doctrinal placeholder');
  assert.equal(SIDING.boardNominal.value, '1x10');
  assert.equal(FOUNDATION.concreteWallThickIn.value, 8);
  assert.equal(LAYOUT.studSpacingIn.value, 16);
});

// ── Fastening schedules ──────────────────────────────────────────────────────
// The mirror the NAILING table exists to be. Both directions matter: an unmirrored schedule is
// a value with no cited home (the thing the requirement is about), and a dead mirror is a
// citation for something no crew is ever told to do, which is worse than none.
//
// IT HAS TO WALK WHAT SHIPS. This walked `generateFrame` alone — the frozen compat path, which
// the app reaches only through this suite — and reported the guarantee as though it covered the
// tool. The app generates through `generateStructure` over the family table, and against that
// the register was short 59 schedules on ~1,800 member instances: every shutter, door, screen
// band, tower bolt, crib spike and roll of roofing in the catalog. A test scoped to the wrong
// generator is worse than no test, because the gap it leaves reads as a guarantee.
//
// The corpus below is the CARD PLUS ITS PANEL: each family's preset, then the same preset at
// every roof kind and every covering option that family's own panel offers, because those are
// buildings a user can produce by clicking. The legacy fixtures stay in the walk — the frozen
// branch is still shipped code and its schedules still need homes.

/** Every spec the shipped app can generate from a catalog card by using that card's own panel. */
function shippedSpecs(): { id: string; spec: StructureSpec }[] {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    out.push({ id: fam.id, spec: clone(fam.preset) });
    for (const kind of fam.roofs) {
      const s = clone(fam.preset) as StructureSpec & { roof?: RoofSpec };
      if (!s.roof || s.roof.kind === kind) continue;
      s.roof =
        kind === 'shed' ? { kind, risePer12: 3, overhangFt: 1, highSide: 'N' }
        : kind === 'flat' ? { kind, overhangFt: 1 }
        : kind === 'none' ? { kind }
        : { kind, risePer12: 4, overhangFt: 1 };
      out.push({ id: `${fam.id} roof=${kind}`, spec: s });
    }
    for (const [key, options] of Object.entries(fam.coverings)) {
      for (const option of options as string[]) {
        const s = clone(fam.preset) as StructureSpec & { coverings?: Record<string, string> };
        if (!s.coverings) continue;
        s.coverings[key] = option;
        out.push({ id: `${fam.id} ${key}=${option}`, spec: s });
      }
    }
  }
  return out;
}

/** Every distinct `nailing` string the toolkit emits, mapped to the roles and the build carrying it. */
function emittedNailing(): Map<string, { roles: Set<string>; where: string }> {
  const out = new Map<string, { roles: Set<string>; where: string }>();
  const record = (members: readonly Member[], where: string): void => {
    for (const m of members) {
      const n = (m as { nailing?: string }).nailing;
      if (!n) continue;
      if (!out.has(n)) out.set(n, { roles: new Set(), where });
      out.get(n)!.roles.add(m.role);
    }
  };
  for (const fx of [...FULL_FIXTURES, ...MATRIX_FIXTURES]) record(generateFrame(fx.input).members, `legacy ${fx.name}`);
  for (const { id, spec } of shippedSpecs()) record(generateStructure(spec).members, id);
  return out;
}

test('doctrine mirrors every nailing schedule the SHIPPED generators emit', () => {
  const emitted = emittedNailing();
  // The corpus is the guarantee's reach, so it is asserted rather than assumed: a refactor that
  // quietly narrowed the walk back to one generator would otherwise leave this test green.
  assert.ok(emitted.size > 70, `expected the real schedule set across both paths, got ${emitted.size}`);

  const mirrored = new Map(Object.entries(NAILING).map(([k, d]) => [d.value as string, k]));
  const homeless = [...emitted.entries()]
    .filter(([spec]) => !mirrored.has(spec))
    .map(([spec, { roles, where }]) => `${JSON.stringify(spec)} (roles: ${[...roles].sort().join(', ')}; e.g. ${where})`);
  assert.deepEqual(homeless, [], `emitted nailing schedules with no cited home in NAILING:\n  ${homeless.join('\n  ')}`);

  for (const [key, d] of Object.entries(NAILING)) {
    assert.ok(emitted.has(d.value as string), `NAILING.${key} mirrors nothing any generator emits`);
  }
});

test('the family path really is walked — the frozen fixtures alone cannot carry this test', () => {
  // The guarantee above is only worth what its corpus reaches. If the family walk were dropped,
  // `emitted.size` would fall back to the frozen branch's couple of dozen; this names the
  // schedules that exist ONLY on the shipped side, so the loss is a failure and not a shrug.
  const legacy = new Set<string>();
  for (const fx of [...FULL_FIXTURES, ...MATRIX_FIXTURES]) {
    for (const m of generateFrame(fx.input).members) if (m.nailing) legacy.add(m.nailing);
  }
  const all = emittedNailing();
  const familyOnly = [...all.keys()].filter((s) => !legacy.has(s));
  assert.ok(familyOnly.length > 40, `only ${familyOnly.length} schedules come from the family path`);
});

test('no two schedules are the same joint written two ways', () => {
  // WHAT THE GAP WAS MADE OF. A third of the missing schedules were not missing at all: the
  // frozen branch says "3-16d toenail ea bearing" and the sibling floor said "3-16d toenail each
  // bearing" — one joint, two strings, and the second had no cited home purely because of the
  // word. Collapsed at the source (the generators read the value from NAILING), and pinned here
  // so the next retyped string is a red test rather than a silent second entry.
  const flatten = (s: string): string => s.toLowerCase().replace(/\beach\b/g, 'ea').replace(/\s+/g, ' ').trim();
  const byJoint = new Map<string, string[]>();
  for (const [key, d] of Object.entries(NAILING)) {
    const k = flatten(d.value as string);
    byJoint.set(k, [...(byJoint.get(k) ?? []), key]);
  }
  const twins = [...byJoint.entries()].filter(([, keys]) => keys.length > 1).map(([k, keys]) => `${keys.join(' / ')}: ${k}`);
  assert.deepEqual(twins, [], `one joint, two entries:\n  ${twins.join('\n  ')}`);
});

test('the (PH) a crew reads and the ph the register reports cannot disagree', () => {
  for (const [key, d] of Object.entries(NAILING)) {
    const printsPending = (d.value as string).includes('(PH)');
    assert.equal(
      d.ph,
      printsPending,
      `NAILING.${key}: ph=${d.ph} but the emitted string ${printsPending ? 'does' : 'does not'} print (PH)`,
    );
  }
  // The four corrected on 2026-08-07 are cited, not pending — the whole point of correcting them.
  for (const key of ['capPlateLap', 'collarTie', 'sillAnchor', 'foundationWallAnchor'] as const) {
    assert.equal(NAILING[key].ph, false, `NAILING.${key} should carry a real citation`);
    assert.match(NAILING[key].cite, /^IRC /, `NAILING.${key} should cite the IRC section it was corrected against`);
  }
});
