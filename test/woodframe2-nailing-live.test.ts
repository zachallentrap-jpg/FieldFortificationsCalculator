// WOODFRAME-2 — the register is LIVE for the sibling generators (the propagation lock).
//
// io.ts's contract is that a validated import lands in the very next generate with no
// re-wiring: every consumer reads `.value` at use time. These tests hold the generators in
// families/** and subsystems/** to that contract over the REAL import path — change a leaf with
// `importDoctrine`, regenerate a SHIPPED catalog card, and the emitted members must carry the
// new value. A generator that retypes a register string as its own literal passes every
// byte-identity test in the suite and fails here, which is the difference between MIRRORING the
// register (the frozen branch's discipline) and READING it (the sibling branch's).
//
// Three leaves, three kinds of consumption: a nailing schedule printed on the member card, a
// spacing that decides how many members exist at all, and a stock nominal that decides what
// they are cut from. Each test resets the doctrine in a finally so nothing leaks into the rest
// of the suite.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importDoctrine, resetDoctrine, WOODFRAME_DOCTRINE_VERSION } from '../src/woodframe/io';
import { NAILING, BUNKER, LUMBER } from '../src/woodframe/doctrine';
import { generateStructure } from '../src/woodframe/families/index';
import { familyById, type FamilyId } from '../src/woodframe/catalog';
import type { StructureSpec } from '../src/woodframe/spec';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function cardSpec(id: FamilyId): StructureSpec {
  const fam = familyById(id);
  assert.ok(fam, `catalog card "${id}" exists`);
  return clone(fam!.preset) as StructureSpec;
}

/** One entry through the real import path — rejected means the test setup is wrong, not the lock. */
function apply(path: string, value: unknown, cite: string): void {
  const report = importDoctrine({
    woodframeDoctrineVersion: WOODFRAME_DOCTRINE_VERSION,
    entries: [{ path, value, cite, ph: true }],
  });
  assert.equal(report.ok, true, `import of ${path} must apply: ${JSON.stringify([...report.rejected, ...report.rejectedTables])}`);
  assert.equal(report.applied, 1);
}

test('an imported nailing schedule is on the members of the very next generate', () => {
  try {
    const before = generateStructure(cardSpec('tower'));
    const girtsBefore = before.members.filter((m) => m.role === 'girt');
    assert.ok(girtsBefore.length > 0, 'the shipped tower card emits girts');
    for (const g of girtsBefore) assert.equal(g.nailing, NAILING.towerGirt.value);

    const corrected = 'bolted to each leg, two bolts per end (PH)';
    assert.notEqual(corrected, NAILING.towerGirt.value);
    apply('NAILING.towerGirt', corrected, 'TM 5-302 tower girts');

    const after = generateStructure(cardSpec('tower'));
    const girts = after.members.filter((m) => m.role === 'girt');
    assert.ok(girts.length > 0);
    for (const g of girts) {
      assert.equal(g.nailing, corrected, `${g.id}: the girt schedule must come from the live register`);
    }
  } finally {
    resetDoctrine();
  }
});

test('an imported spacing re-spaces the very next generate — the bunker overhead', () => {
  try {
    const before = generateStructure(cardSpec('crib-bunker'));
    const nBefore = before.members.filter((m) => m.role === 'ohcStringer').length;
    assert.ok(nBefore > 1, 'the shipped bunker card emits overhead stringers');

    const shipped = BUNKER.stringerSpacingFt.value as number;
    apply('BUNKER.stringerSpacingFt', shipped / 2, 'ATP 3-37.34 timber dead-load stringer table (PH, SME)');

    const after = generateStructure(cardSpec('crib-bunker'));
    const nAfter = after.members.filter((m) => m.role === 'ohcStringer').length;
    assert.ok(
      nAfter > nBefore,
      `halving the stringer spacing must add stringers (${nBefore} before, ${nAfter} after)`,
    );
  } finally {
    resetDoctrine();
  }
});

test('an imported stock nominal is what the very next generate cuts — the tower cab rafters', () => {
  try {
    const before = generateStructure(cardSpec('tower'));
    const hipsBefore = before.members.filter((m) => m.role === 'hipRafter');
    assert.ok(hipsBefore.length > 0, 'the shipped tower card has a pyramid cab framed with hip rafters');
    for (const m of hipsBefore) assert.equal(m.nominal, LUMBER.rafterNominal.value);

    assert.notEqual(LUMBER.rafterNominal.value, '2x8');
    apply('LUMBER.rafterNominal', '2x8', 'FM 5-426 ch. 6 roof framing');

    const after = generateStructure(cardSpec('tower'));
    const hips = after.members.filter((m) => m.role === 'hipRafter');
    assert.ok(hips.length > 0);
    for (const m of hips) {
      assert.equal(m.nominal, '2x8', `${m.id}: the cab rafter stock must come from the live register`);
    }
  } finally {
    resetDoctrine();
  }
});
