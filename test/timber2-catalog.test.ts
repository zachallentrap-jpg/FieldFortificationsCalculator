// TIMBER-2 — the catalog (plan §8.5, TD3/TD20).
//
// The catalog is DATA, so the tests are about data integrity: every preset actually
// generates, every card has the pieces the picker and the workbench need, and no two cards
// are secretly the same card (the family-identity AC — two entries that produce the same
// structure are one entry shown twice, which is worse than one entry).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILY_TABLE, familyById, pickerGroups, shippedFamilies, GROUP_ORDER } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import { normalizeSpec, specToJson } from '../src/timber/normalize';
import type { BuildingSpec } from '../src/timber/spec';

test('every shipped preset normalizes clean and generates a real structure', () => {
  for (const f of shippedFamilies()) {
    const { issues } = normalizeSpec(f.preset);
    assert.deepEqual(issues, [], `${f.id}: a preset that needs clamping is a preset with a wrong number in it`);
    const model = generateStructure(f.preset);
    assert.ok(model.members.length > 50, `${f.id}: only ${model.members.length} members`);
    for (const m of model.members) {
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${f.id}/${m.id}: non-finite`);
      }
      assert.ok(m.doctrineRef.length > 0 && m.nailing.length > 0, `${f.id}/${m.id}: missing provenance`);
    }
  }
});

test('every family carries the pieces the UI needs — including a cutaway (mandate #5)', () => {
  for (const f of FAMILY_TABLE) {
    assert.ok(f.name.length > 0 && f.oneLiner.length > 10, `${f.id}: needs a real one-liner`);
    assert.ok(f.lineage.length > 5, `${f.id}: needs its doctrine lineage`);
    assert.ok(GROUP_ORDER.includes(f.group), `${f.id}: unknown group ${f.group}`);
    assert.ok(f.roofs.length > 0, `${f.id}: needs at least one legal roof`);
    // AC-CAT-19: a family with no cutaway spec fails the build. Every structure is cuttable.
    assert.ok(f.cutaway, `${f.id}: no CutawaySpec — mandate #5 says EVERY structure has one`);
    assert.ok(['x', 'y', 'z'].includes(f.cutaway.axis), `${f.id}: bad cut axis`);
    assert.ok(f.cutaway.frac >= 0 && f.cutaway.frac <= 1, `${f.id}: cut fraction outside the model`);
    assert.ok(f.cutaway.reason.length > 20, `${f.id}: the cut must teach something — say what`);
  }
});

test('every lock names its value AND its citation', () => {
  for (const f of FAMILY_TABLE) {
    for (const lock of f.locks) {
      assert.ok(lock.label.length > 0, `${f.id}: a lock with no label is a mystery`);
      assert.ok(lock.value.length > 0, `${f.id}/${lock.label}: no value`);
      assert.ok(/\(PH\)|FM |TM |EM |UFC /.test(lock.cite), `${f.id}/${lock.label}: cite "${lock.cite}"`);
    }
  }
});

test('family identity: no two cards generate the same structure (TD20)', () => {
  const seen = new Map<string, string>();
  for (const f of shippedFamilies()) {
    const key = specToJson(f.preset);
    const prior = seen.get(key);
    assert.equal(prior, undefined, `${f.id} and ${prior} are the same card twice — give one a real identity`);
    seen.set(key, f.id);
  }
});

test('gp-frame is a real standard design, deliberately unlike custom (TD20)', () => {
  const gp = familyById('gp-frame')!.preset as BuildingSpec;
  const custom = familyById('custom')!.preset as BuildingSpec;
  assert.notDeepEqual(gp.dims, custom.dims, 'the GP building is not the demo building');
  assert.notEqual(gp.coverings.siding, 'none', 'a standard design ships closed in');
  assert.notEqual(gp.coverings.roofing, 'none', 'and roofed');
  assert.equal(custom.coverings.siding, 'none', 'custom starts bare — it is a clean sheet');
  assert.ok(gp.dims.lengthFt >= 40, 'the GP building is the long one');
});

test('the custom card states its scope so nobody hunts for a tower knob (TD22/TD40)', () => {
  const custom = familyById('custom')!;
  assert.equal(custom.locks.length, 0, 'custom locks nothing — that is the whole card');
  assert.ok(/building/i.test(custom.oneLiner), 'the one-liner must say it customizes a BUILDING');
  assert.ok(/tower|bunker|platform/i.test(custom.oneLiner), 'and where the other families are customized');
});

test('picker groups are in the TD15 order and hide unshipped families', () => {
  const groups = pickerGroups();
  const order = groups.map((g) => g.group);
  const expected = GROUP_ORDER.filter((g) => order.includes(g));
  assert.deepEqual(order, expected, 'groups must follow the catalog taxonomy order');
  for (const g of groups) {
    assert.ok(g.families.length > 0, `${g.group}: empty groups are omitted, never rendered blank`);
    for (const f of g.families) assert.ok(f.shipped, `${f.id}: unshipped families never reach the picker`);
  }
});

test('legal roof kinds are actually buildable by the engine', () => {
  for (const f of shippedFamilies()) {
    for (const kind of f.roofs) {
      if (f.specBranch !== 'building') continue;
      const base = f.preset as BuildingSpec;
      const roof =
        kind === 'gable' ? { kind: 'gable' as const, risePer12: 4, overhangFt: 1 }
        : kind === 'shed' ? { kind: 'shed' as const, risePer12: 3, overhangFt: 1, highSide: 'N' as const }
        : kind === 'flat' ? { kind: 'flat' as const, overhangFt: 1, drainPer12: 1 }
        : { kind: 'none' as const };
      const model = generateStructure({ ...base, roof });
      assert.ok(model.members.length > 0, `${f.id}: roof ${kind} generated nothing`);
    }
  }
});

test('covering options offered by a card are options the engine implements', () => {
  const implemented = {
    wallSheathing: ['none', 'plywood', 'boards'],
    siding: ['none', 'plywood', 'boards', 'boardAndBatten'],
    roofDeck: ['none', 'plywood', 'boards', 'skip', 'purlins'],
    roofing: ['none', 'roll', 'rollDouble', 'corrugated'],
  } as const;
  for (const f of FAMILY_TABLE) {
    for (const [key, offered] of Object.entries(f.coverings)) {
      const legal = implemented[key as keyof typeof implemented];
      for (const opt of offered ?? []) {
        assert.ok(legal.includes(opt as never), `${f.id}: offers ${key}="${opt}", which the engine does not implement`);
      }
    }
  }
});
