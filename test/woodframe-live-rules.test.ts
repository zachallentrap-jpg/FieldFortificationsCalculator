// WOODFRAME — the PROPAGATION LOCK for the live rule register.
//
// The doctrine register is a runtime-editable database (io.ts validates and applies offline
// corrections), and the closure inventory found the places where an applied edit went nowhere:
// module-load snapshots (the whole catalog was built once at boot), dead leaves shadowed by
// literals (spacing, the clamp table, the fastener arithmetic), and defaults retyped at their
// call sites. Every test here APPLIES a real import through `importDoctrine` — the only legal
// write path — and then asserts the edit reaches the consumer that used to hold the stale copy.
//
// Each lock was proven by reverting its wiring and watching it fail (the revert failures are
// recorded in DECISIONS.md D46): a lock that has never failed proves nothing.
//
// `resetDoctrine()` runs in `finally`, so no import here can leak into another suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importDoctrine, resetDoctrine } from '../src/woodframe/io';
import { getByPath } from '../src/woodframe/doctrine';
import { generateStructure } from '../src/woodframe/families/index';
import { joistNominalFor } from '../src/woodframe/subsystems/floorSystem';
import { familyTable } from '../src/woodframe/catalog';
import { buildFromFamily } from '../src/ui/woodframe/store';
import { fastenerTakeoff } from '../src/woodframe/fasteners';
import { normalizeSpec } from '../src/woodframe/normalize';
import { bomSummary, LABOR_RATES } from '../src/woodframe/bom';
import { laborModel, maxUsefulCrew } from '../src/woodframe/packet/labor';
import { roofingTiling } from '../src/ui/woodframe/tiling';
import type { BuildingSpec, StructureSpec } from '../src/woodframe/spec';
import type { Member } from '../src/woodframe/types';

/** Apply one leaf's correction through the only legal write path, or fail loudly. */
function apply(path: string, value: unknown): void {
  const live = getByPath(path);
  assert.ok(live, `${path} is not a registered leaf`);
  const report = importDoctrine({
    woodframeDoctrineVersion: 1,
    entries: [{ path, value, cite: live!.cite, ph: live!.ph }],
  });
  assert.equal(report.ok, true, `${path}: import rejected — ${JSON.stringify(report.rejected)}`);
  assert.equal(report.applied, 1);
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const count8d = (members: Member[]): number =>
  fastenerTakeoff(members).lines.find((l) => l.spec === '8d common')?.count ?? 0;

test('LOCK 1 — an imported stud spacing reaches the next minted card AND its hardware bill', () => {
  try {
    const before = buildFromFamily('gp-frame')!;
    const beforeModel = generateStructure(clone(before.spec));
    const beforeStuds = beforeModel.members.filter((m) => m.role === 'stud').length;
    const beforeTake = fastenerTakeoff(beforeModel.members);
    assert.equal((before.spec as BuildingSpec).spacing.studSpacingIn, 16, 'fixture check: ships at 16 in OC');
    assert.equal(beforeTake.fieldSupportSpacingIn, 16, 'fixture check: field nails assume the 16-in grid');

    apply('LAYOUT.studSpacingIn', 24);

    // The card is minted from the register as it now stands — not from a boot-time snapshot.
    const after = buildFromFamily('gp-frame')!;
    assert.equal((after.spec as BuildingSpec).spacing.studSpacingIn, 24, 'the minted preset carries the imported spacing');

    const afterModel = generateStructure(clone(after.spec));
    const afterStuds = afterModel.members.filter((m) => m.role === 'stud').length;
    assert.ok(
      afterStuds < beforeStuds,
      `stud count must drop when the layout opens to 24 in OC (got ${beforeStuds} -> ${afterStuds})`,
    );
    // "Accordingly" made exact: the minted card must build the SAME building the shipped preset
    // builds when its spacing is edited to 24 by hand — the import IS that edit, nothing more.
    const handEdited = clone(before.spec) as BuildingSpec;
    handEdited.spacing.studSpacingIn = 24;
    assert.deepEqual(afterModel.members, generateStructure(handEdited).members);

    // And the hardware bill's field-nail assumption follows the same leaf, live.
    const afterTake = fastenerTakeoff(afterModel.members);
    assert.equal(afterTake.fieldSupportSpacingIn, 24, 'the take-off states the imported grid');
    assert.ok(
      count8d(afterModel.members) < count8d(beforeModel.members),
      'sheathing field nails must thin out with the wider support grid',
    );
  } finally {
    resetDoctrine();
  }
});

test('LOCK 2 — an imported LIMITS row is the bound normalize clamps to', () => {
  try {
    const shipped = buildFromFamily('gp-frame')!.spec as BuildingSpec;
    assert.equal(shipped.dims.lengthFt, 48, 'fixture check: the GP building ships at 48 ft');
    assert.deepEqual(normalizeSpec(clone(shipped)).issues, [], 'fixture check: inside the shipped bounds');

    apply('LIMITS.dims.lengthFt', { min: 4, max: 40, step: 0.5 });

    const { spec, issues } = normalizeSpec(clone(shipped));
    assert.equal((spec as BuildingSpec).dims.lengthFt, 40, 'clamped to the imported bound, not the shipped one');
    assert.ok(
      issues.some((i) => i.path === 'dims.lengthFt' && i.kind === 'clamped' && i.message.includes('4–40')),
      `the clamp reports the imported range: ${JSON.stringify(issues)}`,
    );
  } finally {
    resetDoctrine();
  }
});

test('LOCK 3 — an imported hut dimension is the building the CARD mints (the catalog snapshot is dead)', () => {
  try {
    const before = buildFromFamily('b-hut')!;
    assert.deepEqual((before.spec as { dims: unknown }).dims, { lengthFt: 36, widthFt: 16 }, 'fixture check');
    const beforeMax = Math.max(...generateStructure(clone(before.spec)).members.map((m) => m.position[0]!));

    apply('HUT.bHut', { lengthFt: 24, widthFt: 14, wallHeightFt: 8 });

    const after = buildFromFamily('b-hut')!;
    assert.deepEqual(
      (after.spec as { dims: unknown }).dims,
      { lengthFt: 24, widthFt: 14 },
      'the card mints the imported plan size — a module-load FAMILY_TABLE snapshot would still say 36 x 16',
    );
    const afterMax = Math.max(...generateStructure(clone(after.spec)).members.map((m) => m.position[0]!));
    assert.ok(beforeMax > 34, `fixture check: the shipped hut reaches x=${beforeMax.toFixed(2)}`);
    assert.ok(afterMax < 27, `the minted building IS the shorter hut (reaches x=${afterMax.toFixed(2)})`);
  } finally {
    resetDoctrine();
  }
});

test('LOCK 4 — an imported corrugated sheet width reaches the roofing tiling', () => {
  try {
    const piece = { nominal: 'corrugated 26x8', cutLength: 96, actual: { w: 0.25, d: 26 } };
    assert.equal(roofingTiling(piece).along, 96 / 26, 'fixture check: shipped 26-in tile');

    apply('ROOFING.corrugatedWidthIn', 32);

    assert.equal(roofingTiling(piece).along, 96 / 32, 'the texture tiles at the imported sheet width');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 5 — imported labor figures reprice the bill and the shift table on the next compile', () => {
  try {
    const model = generateStructure(clone(buildFromFamily('gp-frame')!.spec as StructureSpec));
    const beforeMh = bomSummary(model.members, model.stagePlan).totalManHours;
    assert.equal(laborModel(bomSummary(model.members, model.stagePlan)).productiveHoursPerDay, 6, 'fixture check');
    const beforeCeiling = maxUsefulCrew(24);

    apply('LABOR.mhPerBoardFoot', 0.1);
    apply('LABOR.productiveHoursPerDay', 8);
    apply('LABOR.membersPerWorker', 6);

    const afterBom = bomSummary(model.members, model.stagePlan);
    assert.ok(afterBom.totalManHours > beforeMh, `the framing rate reprices the job (${beforeMh} -> ${afterBom.totalManHours})`);
    // The rate the packet PRINTS is the rate that priced it — the getter reads the live leaf.
    assert.equal(LABOR_RATES[0]!.value, '0.1 MH per board-foot');
    assert.equal(laborModel(afterBom).productiveHoursPerDay, 8, 'the shift divisor follows the leaf');
    assert.equal(maxUsefulCrew(24), beforeCeiling * 2, 'the crew ceiling follows membersPerWorker');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 7 — an imported small-plan width redraws the joist-size rule on the next frame', () => {
  try {
    assert.equal(joistNominalFor(10), '2x8', 'fixture check: 10 ft is a house span at the shipped 8-ft rule');
    const shipped = clone(buildFromFamily('storage-shed')!.spec) as BuildingSpec;
    shipped.dims = { ...shipped.dims, widthFt: 10 };
    const before = generateStructure(clone(shipped)).members.filter((m) => m.role === 'joist' && m.id.startsWith('FL-'));
    assert.ok(before.length > 0 && before.every((m) => m.nominal === '2x8'), 'fixture check: a 10-ft skid floor frames 2x8');

    apply('LAYOUT.smallPlanWidthFt', 12);

    assert.equal(joistNominalFor(10), '2x6', 'the rule reads the live leaf — a boot snapshot would still say 2x8');
    const after = generateStructure(clone(shipped)).members.filter((m) => m.role === 'joist' && m.id.startsWith('FL-'));
    assert.ok(after.length > 0 && after.every((m) => m.nominal === '2x6'),
      'the very next skid floor clear-spans on 2x6 under the imported rule');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 8 — an imported bridging row interval sets how many rows a span gets', () => {
  try {
    const shipped = buildFromFamily('storage-shed')!.spec as StructureSpec;
    const before = generateStructure(clone(shipped)).members.filter((m) => m.role === 'bridging');
    assert.ok(before.length > 0, 'fixture check: the 12-ft skid floor carries one bridging row');

    apply('LAYOUT.bridgingRowMaxFt', 4);

    const after = generateStructure(clone(shipped)).members.filter((m) => m.role === 'bridging');
    assert.equal(after.length, before.length * 2,
      `a 12-ft span at a 4-ft interval wants two rows (${before.length} pieces -> ${after.length})`);
  } finally {
    resetDoctrine();
  }
});

test('LOCK 9 — an imported cab post stock is what the next tower cuts', () => {
  try {
    const shipped = buildFromFamily('tower')!.spec as StructureSpec;
    const cabPosts = (m: Member[]): Member[] => m.filter((x) => x.role === 'post');
    const before = cabPosts(generateStructure(clone(shipped)).members);
    assert.equal(before.length, 4, 'fixture check: four cab corner posts');
    assert.ok(before.every((p) => p.nominal === '4x4'), 'fixture check: shipped 4x4');

    apply('TOWER.cabPostNominal', '6x6');

    const after = cabPosts(generateStructure(clone(shipped)).members);
    assert.ok(after.length === 4 && after.every((p) => p.nominal === '6x6'),
      'the cab posts follow the register — the module literal is dead');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 10 — an imported runner count is how many skids the next deck is dragged on', () => {
  try {
    const shipped = buildFromFamily('storage-shed')!.spec as StructureSpec;
    assert.equal(generateStructure(clone(shipped)).members.filter((m) => m.role === 'skid').length, 3, 'fixture check');

    apply('FOUNDATION.skidRunners', 5);

    assert.equal(generateStructure(clone(shipped)).members.filter((m) => m.role === 'skid').length, 5,
      'the runner count follows the register — the call-site default is dead');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 11 — an imported prop stock is what the next propped shutter is cut from', () => {
  try {
    const shipped = clone(buildFromFamily('sea-hut')!.spec) as StructureSpec & { shutters?: string };
    shipped.shutters = 'propped';
    const props = (m: Member[]): Member[] => m.filter((x) => x.role === 'shutter' && x.nominal !== '1x6');
    const before = props(generateStructure(clone(shipped)).members);
    assert.ok(before.length > 0 && before.every((p) => p.nominal === '2x2'), 'fixture check: shipped 2x2 props');

    apply('OPENING.shutterPropNominal', '2x4');

    const after = props(generateStructure(clone(shipped)).members);
    assert.ok(after.length === before.length && after.every((p) => p.nominal === '2x4'),
      'the prop stick follows the register — the module literal is dead');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 12 — the platform deck reads the TM 5-302 plank leaf; the tent floor reads TM 10-8340 — independently', () => {
  try {
    const platform = buildFromFamily('platform')!.spec as StructureSpec;
    const tent = buildFromFamily('tent-floor')!.spec as StructureSpec;
    const planks = (spec: StructureSpec): Set<string> =>
      new Set(generateStructure(clone(spec)).members.filter((m) => m.role === 'deckPlank').map((m) => m.nominal));
    assert.deepEqual([...planks(platform)], ['2x6'], 'fixture check');
    assert.deepEqual([...planks(tent)], ['2x6'], 'fixture check');

    apply('LUMBER.deckPlankNominal', '2x8');
    assert.deepEqual([...planks(platform)], ['2x8'], 'the platform deck follows its own leaf');
    assert.deepEqual([...planks(tent)], ['2x6'], 'the tent floor does NOT — two rules, two homes');

    apply('TENT.deckNominal', '2x4');
    assert.deepEqual([...planks(tent)], ['2x4'], 'the tent floor follows the tent leaf');
    assert.deepEqual([...planks(platform)], ['2x8'], 'and the platform does not move with it');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 13 — the imported roll SIDE lap is the course lap the next roof is laid to', () => {
  try {
    const shipped = buildFromFamily('guard-shack')!.spec as StructureSpec;
    const courses = (m: Member[]): Member[] => m.filter((x) => x.role === 'roofingCourse');
    assert.equal(courses(generateStructure(clone(shipped)).members).length, 4,
      'fixture check: two 32-in-exposure courses per slope at the shipped 4-in side lap');

    apply('ROOFING.rollSideLapIn', 8);

    assert.equal(courses(generateStructure(clone(shipped)).members).length, 6,
      'an 8-in side lap shrinks the exposure to 28 in and the same slope takes three courses per side');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 14 — an imported siding board lap tightens the course step on the next wall', () => {
  try {
    const shipped = buildFromFamily('storage-shed')!.spec as StructureSpec;
    const boards = (m: Member[]): number => m.filter((x) => x.role === 'sidingBoard').length;
    const before = boards(generateStructure(clone(shipped)).members);
    assert.ok(before > 0, 'fixture check: the shed sides in boards');

    apply('SIDING.boardLapIn', 2);

    const after = boards(generateStructure(clone(shipped)).members);
    assert.ok(after > before, `a 2-in lap wants more boards on the same walls (${before} -> ${after})`);
  } finally {
    resetDoctrine();
  }
});

test('LOCK 15 — an imported reviewed-span cap gates the bunker inside the shipped envelope', () => {
  try {
    const shipped = buildFromFamily('crib-bunker')!.spec as StructureSpec;
    const past = (m: ReturnType<typeof generateStructure>): string | undefined =>
      m.issues.find((i) => i.message.includes('past the last reviewed row'))?.message;
    assert.equal(past(generateStructure(clone(shipped))), undefined, 'fixture check: the 10-ft span is inside the shipped table');

    apply('BUNKER.maxReviewedSpanFt', 6);

    const msg = past(generateStructure(clone(shipped)));
    assert.ok(msg, 'pulling the reviewed cap under the shipped span must fire the report');
    assert.ok(msg!.includes('(6 ft)'), `the report names the imported cap: ${msg}`);
  } finally {
    resetDoctrine();
  }
});

test('LOCK 16 — an imported aisle width is checked against the latrine plan', () => {
  try {
    const shipped = buildFromFamily('latrine')!.spec as StructureSpec;
    const aisleIssue = (m: ReturnType<typeof generateStructure>): string | undefined =>
      m.issues.find((i) => i.message.includes('aisle'))?.message;
    assert.equal(aisleIssue(generateStructure(clone(shipped))), undefined, 'fixture check: the shipped plan clears the 3-ft aisle');

    apply('LATRINE.aisleWidthFt', 6);

    const msg = aisleIssue(generateStructure(clone(shipped)));
    assert.ok(msg, 'a 6-ft aisle requirement must fail the 8-ft-wide plan out loud');
    assert.ok(msg!.includes('6 ft'), `the check names the imported requirement: ${msg}`);
  } finally {
    resetDoctrine();
  }
});

test('LOCK 17 — the platform card\'s slope lock caption is spelled from the slopes leaf', () => {
  try {
    const caption = (): string => {
      const table = familyTable();
      return table.find((f) => f.id === 'platform')!.locks.find((l) => l.path === 'ramp.slope')!.value;
    };
    assert.equal(caption(), '1 in 4, 6 or 8', 'fixture check: the shipped caption');

    apply('RAMP.slopes', [3, 5, 7]);

    assert.equal(caption(), '1 in 3, 5 or 7', 'the lock caption follows the corrected list — the literal is dead');
  } finally {
    resetDoctrine();
  }
});

test('LOCK 6 — a repaired share link gets the imported roof default, not the shipped one', () => {
  try {
    apply('ROOF.risePer12', 6);
    // Branch (a): the whole roof SECTION never arrived — `repairSections` fills it from the
    // spec.ts fallback, whose getter must read the register at repair time.
    const missing = normalizeSpec({ family: 'building' } as unknown as StructureSpec);
    const aRoof = (missing.spec as BuildingSpec).roof;
    assert.equal(aRoof.kind, 'gable');
    assert.equal((aRoof as { risePer12: number }).risePer12, 6, 'section repair uses the register default at repair time');
    // Branch (b): a roof arrived but names a kind outside the union — `repairRoofShape`'s own
    // standard-gable fallback must read the same leaves.
    const shipped = buildFromFamily('gp-frame')!.spec as BuildingSpec;
    const malformed = clone(shipped) as unknown as { roof: unknown };
    malformed.roof = { kind: 'dome' };
    const repaired = normalizeSpec(malformed as unknown as StructureSpec);
    const bRoof = (repaired.spec as BuildingSpec).roof;
    assert.equal(bRoof.kind, 'gable');
    assert.equal((bRoof as { risePer12: number }).risePer12, 6, 'shape repair uses the register default at repair time');
  } finally {
    resetDoctrine();
  }
});
