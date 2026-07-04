import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { allCodes } from '../src/engine/codes';
import { defaultInputs } from './helpers';
import type { Inputs } from '../src/engine/types';

const codesFor = (over: Partial<Inputs>): Set<string> =>
  new Set(compute(defaultInputs(over)).validation.map((v) => v.code));

test('each validation code is reachable', () => {
  const fired = new Set<string>();
  const scenarios: Partial<Inputs>[] = [
    { positionType: '___' }, // INVALID_POSITION
    { soil: '___' }, // INVALID_SOIL
    { standard: '___' as unknown as Inputs['standard'] }, // INVALID_STANDARD
    { threat: '___' }, // INVALID_THREAT
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
  ];
  for (const s of scenarios) for (const c of codesFor(s)) fired.add(c);

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

test('REVET_REQUIRED_SOIL is an error and clears when a revetment is chosen', () => {
  assert.ok(codesFor({ soil: 'sand', revetment: 'none' }).has('REVET_REQUIRED_SOIL'));
  assert.ok(!codesFor({ soil: 'sand', revetment: 'sandbag_facing' }).has('REVET_REQUIRED_SOIL'));
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
