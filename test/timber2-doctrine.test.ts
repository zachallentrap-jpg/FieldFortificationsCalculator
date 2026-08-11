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
import { configSchemaFor, type PanelRow } from '../src/ui/woodframe/config';
import { HUT } from '../src/timber/doctrine';
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
// IT HAS TO WALK WHAT SHIPS, AND WHAT SHIPS IS THE CARD PLUS ITS PANEL. The corpus is every
// build reachable by opening a catalog card and moving ONE OR TWO controls on the panel that
// comes with it: every option of every select, both states of every toggle, each number row at
// its clamp ends and its middle.
//
// TWO, BECAUSE ONE MISSED A MEMBER A USER CAN REACH IN TWO CLICKS. A one-control walk finds a
// schedule only where a single choice reaches it, and some members exist only where two choices
// AGREE. The purlin is the case: every family whose deck offers purlins presets to a gable, and
// the frozen gable branch lays a solid deck (C-9), so roof-kind variation and covering variation
// are each individually inert — it takes `roof.kind=hip` AND `coverings.roofDeck=purlins`
// together, both of them options the card itself advertises, to put 26 purlins on a roof. Pairs
// are walked in BOTH orders, and each row's `applies` predicate is honoured against the spec as
// it stands when that row is reached, because that predicate is what the panel would have shown.
//
// A corpus built from `FAMILY_TABLE` presets, roof kinds and coverings alone leaves out eight
// schedules that are one click away: a slab foundation, a front left open, felt under the
// roofing, a tower cab roofed as a shed or reached by stair, a platform on skids, a bunker walled
// as a crib. The legacy fixtures stay in the walk — the frozen branch is shipped code too.
//
// The panel's write semantics are reproduced here (they live in the boot file, which cannot be
// imported outside a browser): the union rows rebuild their branch, and three rows mean "clear
// this" rather than "store this string".

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function setPath(spec: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = spec;
  for (const k of keys.slice(0, -1)) {
    if (node[k] === undefined || node[k] === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[keys[keys.length - 1]!] = value;
}

/** What the panel writes when a row is set to `value` — the same branch rebuilds the UI does. */
function applyPanelRow(spec: Record<string, unknown>, path: string, value: unknown): void {
  if (path === 'openFront') { spec.openFront = value === 'none' ? undefined : value; return; }
  if (path === 'site.soil') { spec.site = value === 'unknown' ? undefined : { soil: value }; return; }
  if (path === 'screenBand') { spec.screenBand = value ? { sillFt: HUT.screenBandSillFt.value, heightFt: HUT.screenBandHeightFt.value } : null; return; }
  if (path === 'roof.kind') {
    const prev = (spec.roof ?? {}) as { kind?: string; risePer12?: number; overhangFt?: number };
    const rise = prev.risePer12 ?? 4;
    const oh = prev.kind === 'none' ? 1 : prev.overhangFt ?? 1;
    const kind = value as RoofSpec['kind'];
    spec.roof =
      kind === 'shed' ? { kind, risePer12: rise || 3, overhangFt: oh, highSide: 'N' }
      : kind === 'flat' ? { kind, overhangFt: oh, drainPer12: 1 }
      : kind === 'none' ? { kind }
      : { kind, risePer12: rise, overhangFt: oh };
    return;
  }
  if (path === 'foundation.kind') {
    const prev = (spec.foundation ?? {}) as { crawlFt?: number };
    const kind = value as string;
    spec.foundation =
      kind === 'piers' || kind === 'wall' ? { kind, crawlFt: prev.crawlFt ?? 1.5 }
      : kind === 'basement' ? { kind, depthFt: 7.5, stairs: true }
      : kind === 'embedded' ? { kind, embedFt: 3 }
      : { kind };
    return;
  }
  setPath(spec, path, value);
}

/** The catalog cards themselves, and the roof/covering variants their card data offers. */
function cardSpecs(): { id: string; spec: StructureSpec }[] {
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

/** The rows of a card's panel that are a value to move at all. */
function panelRows(famId: string): PanelRow[] {
  // The family row opens another card (already in the corpus) and the openings editor is a list,
  // not a value — neither is a control set to one of a known set of values.
  return configSchemaFor(famId as never).groups
    .flatMap((g) => g.rows)
    .filter((r) => r.control !== 'family' && r.control !== 'openings-editor');
}

/** Every value a row offers. Number rows at both clamp ends and the middle. */
function rowValues(row: PanelRow): unknown[] {
  if (row.control === 'toggle') return [true, false];
  if (row.control === 'number') {
    const { min, max } = row;
    if (min === undefined || max === undefined) return [min, max].filter((v) => v !== undefined);
    return [...new Set([min, (min + max) / 2, max])];
  }
  return (row.options ?? []).map((o) => (row.numeric ? Number(o) : o));
}

/** Each card with ONE panel control moved, over every value that control offers. */
function panelSpecs(): { id: string; spec: StructureSpec }[] {
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    for (const row of panelRows(fam.id)) {
      for (const v of rowValues(row)) {
        const spec = clone(fam.preset) as unknown as Record<string, unknown>;
        if (row.applies && !row.applies(spec)) continue; // the panel would not have shown this row
        applyPanelRow(spec, row.path, v);
        out.push({ id: `${fam.id} ${row.path}=${String(v)}`, spec: spec as unknown as StructureSpec });
      }
    }
  }
  return out;
}

/**
 * Each card with TWO panel controls moved, in both orders. Order matters because a row's
 * `applies` predicate reads the spec as it stands when that row is reached — which is exactly how
 * the panel behaves, and how `roof.kind=hip` is what makes the purlins option appear at all.
 */
function pairSpecs(): { id: string; spec: StructureSpec }[] {
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const fam of FAMILY_TABLE) {
    const rows = panelRows(fam.id);
    for (const a of rows) {
      for (const b of rows) {
        if (a === b) continue;
        for (const va of rowValues(a)) {
          for (const vb of rowValues(b)) {
            const spec = clone(fam.preset) as unknown as Record<string, unknown>;
            if (a.applies && !a.applies(spec)) continue;
            applyPanelRow(spec, a.path, va);
            if (b.applies && !b.applies(spec)) continue;
            applyPanelRow(spec, b.path, vb);
            out.push({
              id: `${fam.id} ${a.path}=${String(va)} + ${b.path}=${String(vb)}`,
              spec: spec as unknown as StructureSpec,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Every spec the shipped app can generate from a catalog card by moving one or two of that card's
 * own panel controls. Deduplicated: most pairs land on a spec some other pair already produced
 * (a row set to the value it already had), and building each one twice buys nothing.
 */
function shippedSpecs(): { id: string; spec: StructureSpec }[] {
  const seen = new Set<string>();
  const out: { id: string; spec: StructureSpec }[] = [];
  for (const entry of [...cardSpecs(), ...panelSpecs(), ...pairSpecs()]) {
    const key = JSON.stringify(entry.spec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/** Every distinct `nailing` string a set of builds emits, mapped to the roles and one build. */
function emittedNailingFrom(specs: { id: string; spec: StructureSpec }[]): Map<string, { roles: Set<string>; where: string }> {
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
  for (const { id, spec } of specs) record(generateStructure(spec).members, id);
  return out;
}

// The walk is thousands of builds; three tests read it, and building it three times would triple
// the suite's runtime for an identical answer.
let cachedEmitted: Map<string, { roles: Set<string>; where: string }> | null = null;
const emittedNailing = (): Map<string, { roles: Set<string>; where: string }> =>
  (cachedEmitted ??= emittedNailingFrom(shippedSpecs()));

test('doctrine mirrors every nailing schedule a card and its panel can emit with one or two controls moved', () => {
  const emitted = emittedNailing();
  // The corpus is the guarantee's reach, so it is asserted rather than assumed: a refactor that
  // quietly narrowed the walk back to one generator would otherwise leave this test green.
  assert.ok(emitted.size > 90, `expected the real schedule set across both paths, got ${emitted.size}`);

  const mirrored = new Map(Object.entries(NAILING).map(([k, d]) => [d.value as string, k]));
  const homeless = [...emitted.entries()]
    .filter(([spec]) => !mirrored.has(spec))
    .map(([spec, { roles, where }]) => `${JSON.stringify(spec)} (roles: ${[...roles].sort().join(', ')}; e.g. ${where})`);
  assert.deepEqual(homeless, [], `emitted nailing schedules with no cited home in NAILING:\n  ${homeless.join('\n  ')}`);

  for (const [key, d] of Object.entries(NAILING)) {
    assert.ok(emitted.has(d.value as string), `NAILING.${key} mirrors nothing any generator emits`);
  }
});

test('the guarantee reaches the PANEL, not just the cards it ships', () => {
  // What the test above is worth is exactly what its corpus reaches, and the difference between
  // "the fourteen cards" and "the fourteen cards you can actually operate" is not rhetorical:
  // these schedules exist only once a control is moved. Narrow the corpus back to the cards and
  // this names, one by one, the joints that would go unwatched.
  const cardOnly = new Set(emittedNailingFrom(cardSpecs()).keys());
  const reachedByPanel = [...emittedNailingFrom(panelSpecs()).keys()].filter((s) => !cardOnly.has(s));
  assert.ok(
    reachedByPanel.length >= 7,
    `only ${reachedByPanel.length} schedules need a panel control moved — has the sweep stopped sweeping?`,
  );
  // And each of them is genuinely mirrored, and genuinely inside the corpus the guarantee above
  // walks — a sweep that exists but is not wired into that walk proves nothing.
  const mirrored = new Set(Object.values(NAILING).map((d) => d.value as string));
  assert.deepEqual(reachedByPanel.filter((s) => !mirrored.has(s)), []);
  const corpus = new Set(emittedNailing().keys());
  assert.deepEqual(reachedByPanel.filter((s) => !corpus.has(s)), [], 'the panel sweep is not in the walked corpus');
});

test('the guarantee reaches a member only a PAIR of card-advertised choices produces', () => {
  // What the second control buys, named. Narrow the corpus back to one control at a time and the
  // purlin's schedule leaves the walk entirely — not because it is unreachable, but because the
  // two clicks that reach it are inert one at a time. That is the shape of gap this register is
  // for, so the walk has to keep proving it still covers it.
  const singles = new Set(emittedNailingFrom([...cardSpecs(), ...panelSpecs()]).keys());
  const reachedOnlyByPairs = [...emittedNailing().keys()].filter((s) => !singles.has(s));
  assert.ok(
    reachedOnlyByPairs.includes(NAILING.purlinAtRafters.value as string),
    `the purlin schedule is no longer pair-only — the walk found it at ${reachedOnlyByPairs.length} pair-only schedules`,
  );
  const mirrored = new Set(Object.values(NAILING).map((d) => d.value as string));
  assert.deepEqual(reachedOnlyByPairs.filter((s) => !mirrored.has(s)), []);
});

test('no two EMITTED schedules are the same joint written two ways', () => {
  // One joint, one string. The frozen branch says "3-16d toenail ea bearing"; a sibling generator
  // that types "each bearing" has made a second joint out of one, and the register cannot see it
  // because both halves get a cited home. So this compares what the GENERATORS emit rather than
  // the table against itself: collapse the wording, and any two distinct emitted strings that
  // land on the same joint are the drift.
  const flatten = (s: string): string => s.toLowerCase().replace(/\beach\b/g, 'ea').replace(/\s+/g, ' ').trim();
  const byJoint = new Map<string, Map<string, string>>();
  for (const [spec, { where }] of emittedNailing()) {
    const k = flatten(spec);
    if (!byJoint.has(k)) byJoint.set(k, new Map());
    byJoint.get(k)!.set(spec, where);
  }
  const twins = [...byJoint.values()]
    .filter((variants) => variants.size > 1)
    .map((variants) => [...variants.entries()].map(([s, where]) => `${JSON.stringify(s)} (${where})`).join('  vs  '));
  assert.deepEqual(twins, [], `one joint, two strings on the member cards:\n  ${twins.join('\n  ')}`);
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
