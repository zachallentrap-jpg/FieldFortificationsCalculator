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
  ];
  for (const s of scenarios) for (const c of codesFor(s)) fired.add(c);

  for (const def of allCodes()) {
    assert.ok(fired.has(def.code), 'code never fired: ' + def.code);
  }
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
