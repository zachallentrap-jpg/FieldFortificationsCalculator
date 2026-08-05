// TIMBER-2 — the stage model (plan §8.2, §3.3, TD10/TD18).
//
// The load-bearing property: a one-story gable building's stage plan is the legacy `STAGES`
// array, ordinal for ordinal. That is precisely why the legacy suites — which assert
// `stage === 5` means wall framing — never had to be touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, specFromBuildingInput, type BuildingInput } from '../src/timber/frame';
import { generateStructure } from '../src/timber/families/index';
import { bomSummary, boardFeet } from '../src/timber/bom';
import { STAGES } from '../src/timber/types';
import { stagePlanForBuilding, stagePlanForLegacyBuilding, STAGE_KEYS, ordinalOf } from '../src/timber/stagePlan';
import { FAMILY_TABLE } from '../src/timber/catalog';
import { normalizeSpec } from '../src/timber/normalize';

const demo: BuildingInput = {
  lengthFt: 20, widthFt: 16, wallHeightFt: 8,
  studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
  risePer12: 4, overhangFt: 1, crawlFt: 1.5,
  openings: [{ wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }],
};

test('the legacy building plan IS the legacy STAGES array, ordinal for ordinal', () => {
  const plan = stagePlanForLegacyBuilding();
  assert.equal(plan.length, STAGES.length);
  for (let i = 0; i < plan.length; i++) {
    assert.equal(plan[i]!.ordinal, STAGES[i]!.id, `ordinal ${i}`);
    assert.equal(plan[i]!.label, STAGES[i]!.name, `label ${i}`);
  }
});

test('every plan entry has a key from the closed vocabulary and a real sequence note', () => {
  for (const e of stagePlanForLegacyBuilding()) {
    assert.ok(STAGE_KEYS.includes(e.key), `${e.key} is not in the StageKey vocabulary`);
    assert.ok(e.detail.length > 20, `stage ${e.ordinal}: the detail line is what teaches the sequence`);
  }
});

test('every building plan has UNIQUE keys — requireOrdinal must have exactly one answer', () => {
  // The defect this pins down: the legacy plan spelled the subfloor row 'floor' and the
  // ceiling row 'roof-frame', so requireOrdinal (first match, by design) stamped every hip
  // and shed member into "Ceiling joists" — and the member card printed it.
  for (const kind of ['gable', 'hip', 'pyramid', 'shed', 'flat', 'none'] as const) {
    const plan = stagePlanForBuilding(kind);
    const keys = plan.map((e) => e.key);
    assert.equal(new Set(keys).size, keys.length, `${kind}: duplicate keys in [${keys.join(', ')}]`);
    for (const e of plan) {
      assert.ok(STAGE_KEYS.includes(e.key), `${kind}: ${e.key} is not in the vocabulary`);
      assert.ok(e.detail.length > 20, `${kind} stage ${e.ordinal}: missing sequence note`);
    }
  }
});

test('a hip frames at "Rafters & ridge" and ties its plates at "Ceiling joists"', () => {
  const spec = specFromBuildingInput(demo);
  const model = generateStructure({ ...spec, roof: { kind: 'hip', risePer12: 4, overhangFt: 1 } });
  const frame = model.stagePlan.find((e) => e.key === 'roof-frame')!;
  assert.equal(frame.label, 'Rafters & ridge', 'the hip frame stage is the rafter stage');
  for (const role of ['ridge', 'rafter', 'hipRafter', 'jackRafter'] as const) {
    const ms = model.members.filter((m) => m.role === role);
    assert.ok(ms.length > 0, `hip roof has no ${role}`);
    for (const m of ms) {
      assert.equal(m.stage, frame.ordinal, `${m.id} landed at stage ${m.stage}, not ${frame.ordinal}`);
    }
  }
  const ceiling = model.stagePlan.find((e) => e.key === 'ceiling')!;
  assert.equal(ceiling.label, 'Ceiling joists');
  const joists = model.members.filter((m) => m.stage === ceiling.ordinal);
  assert.ok(joists.length >= 3, 'a hip thrusts on its plates like a gable — the ceiling stage must tie them');
  for (const j of joists) assert.equal(j.role, 'joist');
});

test('a shed plan has no ceiling row, and its rafters are the roof-frame stage', () => {
  const spec = specFromBuildingInput(demo);
  const model = generateStructure({
    ...spec,
    roof: { kind: 'shed', risePer12: 2, overhangFt: 1, highSide: 'N' },
  });
  assert.equal(model.stagePlan.find((e) => e.key === 'ceiling'), undefined, 'a shed has no ceiling frame');
  const frame = model.stagePlan.find((e) => e.key === 'roof-frame')!;
  assert.ok(model.members.some((m) => m.role === 'rafter' && m.stage === frame.ordinal));
  for (const m of model.members) {
    assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${m.id}: stage ${m.stage} outside the shed plan`);
  }
});

test('ordinalOf finds the first entry with a key (how families stamp their emits)', () => {
  const plan = stagePlanForLegacyBuilding();
  assert.equal(ordinalOf(plan, 'layout'), 1);
  assert.equal(ordinalOf(plan, 'floor'), 3, 'first floor stage, not the deck');
  assert.equal(ordinalOf(plan, 'walls'), 5);
  assert.equal(ordinalOf(plan, 'roofing'), 10);
  assert.equal(ordinalOf(plan, 'cribwork'), undefined, 'a building has no cribwork stage');
});

test('every member sits inside its own model plan, and the partition is exact', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  for (const m of model.members) {
    assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${m.id}: stage ${m.stage} outside the plan`);
  }
  const bom = bomSummary(model.members, model.stagePlan);
  assert.equal(bom.totalMembers, model.members.length, 'stage BOMs partition the model exactly');
  const totalBf = model.members.reduce((a, m) => a + boardFeet(m), 0);
  assert.ok(Math.abs(bom.totalBoardFeet - totalBf) < 1e-6);
});

test('TD18: bomSummary THROWS past the plan instead of silently dropping members', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  // Rig a member past the legacy plan, the way a tower's stages would land.
  const rigged = [...model.members, { ...model.members[0]!, id: 'RIGGED-01', stage: 14 as never }];
  assert.throws(
    () => bomSummary(rigged),
    /RIGGED-01 is at stage 14, past the 11-stage plan/,
    'a bill that is quietly short is worse than no bill',
  );
  // With a plan long enough, it rolls up fine.
  const longPlan = [...model.stagePlan];
  while (longPlan.length < 14) {
    longPlan.push({ ordinal: longPlan.length + 1, key: 'finish', label: `Stage ${longPlan.length + 1}`, detail: 'test' });
  }
  assert.equal(bomSummary(rigged, longPlan).totalMembers, rigged.length);
});

test('the defaulted (no-plan) call still matches the plan-passed call for legacy models', () => {
  const model = generateStructure(specFromBuildingInput(demo));
  assert.deepEqual(bomSummary(model.members), bomSummary(model.members, model.stagePlan));
  // And that is what the TIMBER-1 caller has always gotten.
  assert.deepEqual(bomSummary(generateFrame(demo).members), bomSummary(model.members));
});

test('no stage in any plan is a dead stop — every row either builds something or says it will not', () => {
  // THE GUARD THAT WOULD HAVE CAUGHT THE PYRAMID. A "pyramid" building — reachable only through
  // a shared link, because `decodeSpec` takes any JSON with a `family` key — listed Ceiling
  // joists and Rafters & ridge and framed NEITHER, then hung a single plank of roofing in the
  // air over an open building. Nothing complained, because nothing was checking that a stage the
  // plan advertises is a stage something lands in.
  //
  // A row may be deliberately memberless — a slab has to cure, a skid building's bearing line is
  // cleared and strung before a skid is dropped on it — and those say so with `noMembers`. What
  // is not allowed is a row that is empty because no generator was ever written for it.
  const failures: string[] = [];
  for (const fam of FAMILY_TABLE) {
    const variants: { label: string; spec: Parameters<typeof generateStructure>[0] }[] = [
      { label: fam.id, spec: fam.preset },
    ];
    // Every roof the picker offers this family, not just the one its preset ships with — the
    // pyramid was only ever reachable off-preset, and so is every other roof in `fam.roofs`.
    if (fam.specBranch === 'building') {
      const prev = (fam.preset as { roof?: { risePer12?: number; overhangFt?: number } }).roof ?? {};
      const rise = prev.risePer12 ?? 4;
      const oh = prev.overhangFt ?? 1;
      for (const kind of fam.roofs) {
        const roof =
          kind === 'flat' ? { kind, overhangFt: oh, drainPer12: 1 }
          : kind === 'none' ? { kind }
          : kind === 'shed' ? { kind, risePer12: rise, overhangFt: oh, highSide: 'N' as const }
          : { kind, risePer12: rise, overhangFt: oh };
        variants.push({ label: `${fam.id}/${kind}`, spec: { ...(fam.preset as object), roof } as unknown as Parameters<typeof generateStructure>[0] });
      }
    }
    for (const v of variants) {
      const model = generateStructure(v.spec);
      const occupied = new Set<number>(model.members.map((m) => m.stage as number));
      for (const row of model.stagePlan) {
        if (occupied.has(row.ordinal) || row.noMembers) continue;
        failures.push(`${v.label}: stage ${row.ordinal} "${row.label}" (${row.key}) is empty`);
      }
    }
  }
  assert.deepEqual(failures, [], `dead stops on the scrubber:\n  ${failures.join('\n  ')}`);
});

test('a building has no pyramid roof — it is framed as a hip, and said so', () => {
  // `pyramid` is the guard tower cab's roof and the tower generator owns it. The building path
  // frames gable, hip, shed and flat; for a pyramid it framed nothing at all and the covering
  // pass skinned a roof that had no rafters under it. Downgraded now, loudly.
  const base = FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset as object;
  const spec = { ...base, dims: { lengthFt: 16, widthFt: 16 }, roof: { kind: 'pyramid', risePer12: 5, overhangFt: 1 } };
  const { spec: normalized, issues } = normalizeSpec(spec as Parameters<typeof normalizeSpec>[0]);
  assert.equal((normalized as { roof: { kind: string } }).roof.kind, 'hip', 'a building kept a roof kind it cannot frame');
  const said = issues.find((i) => i.path === 'roof.kind');
  assert.ok(said, 'the roof was changed under the operator with nothing said about it');
  assert.equal(said.severity, 'warn');

  // And the model that comes out is framed, not a floating skin.
  const model = generateStructure(spec as Parameters<typeof generateStructure>[0]);
  const framing = model.members.filter((m) => m.role === 'rafter' || m.role === 'hipRafter' || m.role === 'jackRafter');
  const skin = model.members.filter((m) => m.role === 'roofPanel' || m.role === 'roofingCourse');
  assert.ok(skin.length > 0, 'no roof skin at all');
  assert.ok(framing.length > 0, `${skin.length} pieces of roof skin over ${framing.length} rafters`);
});

test('the plan does not advertise a skin the spec has turned off', () => {
  const base = FAMILY_TABLE.find((f) => f.id === 'gp-frame')!.preset as unknown as { coverings: Record<string, string> };
  const keys = (spec: unknown): string[] =>
    generateStructure(spec as Parameters<typeof generateStructure>[0]).stagePlan.map((s) => s.key);
  assert.ok(keys(base).includes('roofing'), 'a roofed building should have a roofing stage');
  assert.ok(keys(base).includes('siding'), 'a clad building should have a siding stage');
  const bare = { ...base, coverings: { ...base.coverings, roofing: 'none', siding: 'none', wallSheathing: 'none' } };
  assert.ok(!keys(bare).includes('roofing'), 'a roofing stop with no roofing to lay');
  assert.ok(!keys(bare).includes('siding'), 'a siding stop with no siding to hang');
  // Sheathing alone still earns the close-in stage — it is what lands there.
  const sheathed = { ...base, coverings: { ...base.coverings, roofing: 'none', siding: 'none', wallSheathing: 'plywood' } };
  assert.ok(keys(sheathed).includes('siding'), 'sheathing has nowhere to land');
});
