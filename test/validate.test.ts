import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { allCodes } from '../src/engine/codes';
import { importDoctrine } from '../src/doctrine/io';
import { getByPath } from '../src/doctrine/registry';
import { coverMaterialDefault } from '../src/doctrine/protection';
import type { ShieldMaterial } from '../src/doctrine/protection';
import { DOCTRINE_VERSION } from '../src/version';
import { defaultInputs } from './helpers';
import type { Inputs } from '../src/engine/types';

const codesFor = (over: Partial<Inputs>): Set<string> =>
  new Set(compute(defaultInputs(over)).validation.map((v) => v.code));

// Run `body` against a doctrine table filled with the given leaf values, then put the original
// values back — through the sanctioned importer both ways, so the fixture is a fill a qualified
// user could actually have made.
function withDoctrine(values: Record<string, number>, body: () => void): void {
  const fileOf = (v: Record<string, number>): unknown => ({
    doctrineVersion: DOCTRINE_VERSION,
    entries: Object.entries(v).map(([path, value]) => ({ path, value, status: 'PLACEHOLDER', source: getByPath(path)!.source })),
  });
  const before = Object.fromEntries(Object.keys(values).map((p) => [p, getByPath(p)!.value as number]));
  assert.ok(importDoctrine(fileOf(values)).ok, 'fixture fill applies');
  try {
    body();
  } finally {
    assert.ok(importDoctrine(fileOf(before)).ok, 'doctrine restored');
  }
}

// ONE of the two routes to the missing-shielding-data fail-safe: name a cover material the
// shielding table does not carry, so there is no leaf at all to size a roof from. The other is
// a leaf that IS there but holds no buildable thickness — a fill of zero or less, which arrives
// through the sanctioned importer and lands on the same code (exercised end to end in
// test/protection.test.ts). Neither route is reachable from inputs alone.
function withNoShieldingData(threat: string, body: () => void): void {
  const original = coverMaterialDefault[threat]!;
  coverMaterialDefault[threat] = 'no_such_material' as ShieldMaterial;
  try {
    body();
  } finally {
    coverMaterialDefault[threat] = original;
  }
}

test('each validation code is reachable', () => {
  const fired = new Set<string>();
  const scenarios: Partial<Inputs>[] = [
    { positionType: '___' }, // INVALID_POSITION
    { soil: '___' }, // INVALID_SOIL
    { standard: '___' as unknown as Inputs['standard'] }, // INVALID_STANDARD
    { threat: '___' }, // INVALID_THREAT
    { revetment: '___' }, // INVALID_REVETMENT
    { soil: 'sand', revetment: 'none' }, // REVET_REQUIRED_SOIL
    { threat: 'at-he-contact', overheadCover: true }, // ROOF_ENGINEERED
    { threat: 'at-rpg', overheadCover: true, standard: 'hasty' }, // + ROOF_ENGINEERED_HASTY
    { soil: 'rock', machineAssist: false }, // EXCAV_HAND_HEAVY
    { count: 5000 }, // COUNT_CLAMPED
    { teamSize: 999 }, // TEAM_CLAMPED
    { positionType: 'vehicle_hull_defilade', threat: 'sa-556', overheadCover: true, machineAssist: true }, // ROOF_SPAN_EXCEEDED (12 ft span > table)
    { positionType: 'bunker_op_cp', standard: 'reinforced' }, // CUT_DEPTH_SHORING (deep cut)
    { positionType: 'vehicle_turret_defilade', machineAssist: false }, // MACHINE_REQUIRED_VEHICLE
    { positionType: 'one_man', standard: 'hasty' }, // SPOIL_SHORT (big parapet ring, tiny hasty dig)
    { positionType: 'vehicle_hull_defilade', machineAssist: true }, // SPOIL_EXCESS_VEHICLE
    { soil: 'silt' }, // DRAINAGE_WET_SOIL
    { threat: 'none', overheadCover: true }, // COVER_NO_THREAT
    { threat: 'sa-556', overheadCover: true, standard: 'hasty' }, // COVER_UNDER_THREAT (0.75x roof)
    { positionType: 'atgm_javelin' }, // ATGM_BACKBLAST
    { positionType: 'mortar_pit', overheadCover: true, threat: 'sa-556' }, // COVER_MORTAR_INDIRECT
  ];
  for (const s of scenarios) for (const c of codesFor(s)) fired.add(c);

  // ROOF_NO_SHIELDING_DATA and ROOF_NO_COVER_MULTIPLIER have no reachable input combination —
  // they are the fail-safes for doctrine that is missing or unusable, so reaching them means
  // taking the shielding row away, or filling a value that leaves no thickness to build to.
  withNoShieldingData('ind-mtr-81', () => {
    for (const c of codesFor({ threat: 'ind-mtr-81', overheadCover: true })) fired.add(c);
  });
  withDoctrine({ 'standards.deliberate.coverMul': 0 }, () => {
    for (const c of codesFor({ threat: 'ind-mtr-81', overheadCover: true, standard: 'deliberate' })) fired.add(c);
  });
  // PLATFORM_CLAMPED likewise: the shipped catalog's platforms all fit their own bays, so only
  // a fill describing a platform wider than its trench can reach the clamp.
  withDoctrine({ 'positions.fifty_cal.firingPlatform.W': 3.0 }, () => {
    for (const c of codesFor({ positionType: 'fifty_cal' })) fired.add(c);
  });

  for (const def of allCodes()) {
    assert.ok(fired.has(def.code), 'code never fired: ' + def.code);
  }
});

test('COVER_UNDER_THREAT fires for a hasty roof and clears at deliberate/reinforced', () => {
  const cov = (standard: Inputs['standard']): Set<string> =>
    codesFor({ threat: 'sa-556', overheadCover: true, standard });
  // Hasty scales the threat-sized cover to 0.75× — thinner than full protection.
  assert.ok(cov('hasty').has('COVER_UNDER_THREAT'), 'hasty roof is under-thick for the threat');
  // Deliberate builds the full doctrinal thickness; reinforced exceeds it — neither is short.
  assert.ok(!cov('deliberate').has('COVER_UNDER_THREAT'), 'deliberate meets the requirement');
  assert.ok(!cov('reinforced').has('COVER_UNDER_THREAT'), 'reinforced exceeds it');
  // No cover requested ⇒ nothing to be short.
  assert.ok(!codesFor({ threat: 'sa-556', overheadCover: false, standard: 'hasty' }).has('COVER_UNDER_THREAT'), 'no roof, no shortfall');
});

// Pull the two thicknesses the warning prints as its evidence back out of the message.
function coverEvidence(message: string): { drawn: number; required: number } {
  const m = /roof ~([\d.]+) ft as drawn; ~([\d.]+) ft fully stops/.exec(message);
  assert.ok(m, 'the warning prints both thicknesses: ' + message);
  return { drawn: Number(m![1]), required: Number(m![2]) };
}

test('COVER_UNDER_THREAT fires on a shortfall too small to survive display rounding', () => {
  // The panel rounds to a tenth of a foot. Fill the doctrine so a real shortfall lands inside
  // one rounding step: 1.44 ft required, 1.3536 ft delivered — a roof an inch short of stopping
  // the round, on the one check that says so. Comparing rounded values hides it entirely, and
  // reporting rounded values shows the operator two identical numbers as proof the roof is thin.
  withDoctrine({ 'protection.shielding.sa-556.soil': 1.44, 'standards.hasty.coverMul': 0.94 }, () => {
    const r = compute(defaultInputs({ threat: 'sa-556', overheadCover: true, standard: 'hasty' }));
    assert.equal(r.cover.roofPath, 'earth_on_stringers', 'a real earth roof, not an engineered one');
    assert.ok(r.cover.thickness < 1.44, 'the roof really is thinner than the requirement');
    const shortfall = r.validation.find((v) => v.code === 'COVER_UNDER_THREAT');
    assert.ok(shortfall, 'a genuine shortfall must not be rounded away');
    // The evidence must SHOW the shortfall: two numbers that differ, in the direction claimed.
    const { drawn, required } = coverEvidence(shortfall!.message);
    assert.ok(drawn < required, 'the printed roof must read thinner than the printed requirement: ' + shortfall!.message);
    assert.match(shortfall!.message, /ft short\)/, 'and the shortfall itself is named');
  });
});

test('COVER_UNDER_THREAT reports at the panel’s own tenth of a foot when that is enough', () => {
  // Precision is added only where it is needed — a shortfall wider than a tenth of a foot is
  // reported in the same tenths the panel and the drawings show.
  const r = compute(defaultInputs({ threat: 'ind-art-155', overheadCover: true, standard: 'hasty' }));
  const shortfall = r.validation.find((v) => v.code === 'COVER_UNDER_THREAT');
  assert.ok(shortfall, 'a hasty roof against 155mm is short');
  const { drawn, required } = coverEvidence(shortfall!.message);
  assert.ok(required - drawn > 0.1, 'this shortfall is bigger than one rounding step');
  assert.equal(drawn, Math.round(r.cover.thickness * 10) / 10, 'drawn thickness at the panel’s precision');
  assert.match(shortfall!.message, /roof ~\d+(\.\d)? ft as drawn/, 'no extra decimals where tenths already tell the story');
});

test('COVER_UNDER_THREAT ranks with the warnings, above every planning-realism note', () => {
  const v = compute(defaultInputs({ threat: 'sa-556', overheadCover: true, standard: 'hasty' })).validation;
  const cover = v.find((i) => i.code === 'COVER_UNDER_THREAT');
  assert.ok(cover, 'fires on a hasty roof');
  assert.equal(cover!.severity, 'warning', '"this roof does not stop the round you picked" is not an advisory');
  const at = v.findIndex((i) => i.code === 'COVER_UNDER_THREAT');
  const firstAdvisory = v.findIndex((i) => i.severity === 'advisory');
  assert.ok(firstAdvisory === -1 || at < firstAdvisory, 'ranked with the warnings, not trailing the advisories');
});

test('PLATFORM_CLAMPED says what was described and what will be built — and never fires on a platform that fits', () => {
  // The clamp itself (compute cutting the platform to the bay, once, for the bill and all three
  // views) is correct behaviour; what this locks is that it no longer happens in silence.
  const shipped = compute(defaultInputs({ positionType: 'fifty_cal' }));
  assert.ok(!shipped.validation.some((v) => v.code === 'PLATFORM_CLAMPED'), 'the shipped catalog fits its own bays');

  withDoctrine({ 'positions.fifty_cal.firingPlatform.W': 3.0 }, () => {
    const r = compute(defaultInputs({ positionType: 'fifty_cal' }));
    const adv = r.validation.find((v) => v.code === 'PLATFORM_CLAMPED');
    assert.ok(adv, 'an imported impossible platform is no longer rewritten silently');
    assert.equal(adv!.severity, 'advisory', 'the build is right; the note is for whoever filled the table');
    // Both halves of the story: the table's platform, and the buildable one.
    assert.match(adv!.message, /described 4×3 ft/, 'says what the table described: ' + adv!.message);
    assert.match(adv!.message, /built 4×2 ft/, 'says what will be built: ' + adv!.message);
    // And the figure the bill uses IS the built one (the undug volume follows the clamp).
    const geo = r.geometry as { plan: { platform: { W: number } | null } };
    assert.equal(geo.plan.platform!.W, 2, 'one clamped footprint for the bill and every view');
  });
});

test('REVET_REQUIRED_SOIL is an error and clears when a revetment is chosen', () => {
  assert.ok(codesFor({ soil: 'sand', revetment: 'none' }).has('REVET_REQUIRED_SOIL'));
  assert.ok(!codesFor({ soil: 'sand', revetment: 'sandbag_facing' }).has('REVET_REQUIRED_SOIL'));
});

test('SANDBAG_BASIC_LOAD_EXCEEDED is a per-position check — building more positions must not hide it', () => {
  // A bunker with overhead cover against a small crew: each individual position needs far more
  // bags than that crew carries. Scaling `count` up must not make the SAME per-position shortfall
  // disappear — the crew's carried load is per-soldier, not per-job.
  const base = { positionType: 'bunker_op_cp' as const, standard: 'reinforced' as const, threat: 'sa-127', overheadCover: true, teamSize: 4 };
  assert.ok(codesFor({ ...base, count: 1 }).has('SANDBAG_BASIC_LOAD_EXCEEDED'), 'fires at count=1');
  assert.ok(codesFor({ ...base, count: 50 }).has('SANDBAG_BASIC_LOAD_EXCEEDED'), 'still fires at count=50 — same per-position shortfall');
});

test('validation ordering: errors before warnings before advisories', () => {
  const v = compute(defaultInputs({ positionType: '___', threat: 'at-he-contact', overheadCover: true, count: 5000 }))
    .validation;
  const rank = { error: 0, warning: 1, advisory: 2 };
  for (let i = 1; i < v.length; i++) {
    assert.ok(rank[v[i]!.severity] >= rank[v[i - 1]!.severity], 'tiered order');
  }
});

test('clean deliberate build with a valid revetment has no errors', () => {
  const v = compute(defaultInputs({ threat: 'sa-556', soil: 'loam', revetment: 'none' })).validation;
  assert.ok(!v.some((i) => i.severity === 'error'), 'no errors on a valid config');
});
