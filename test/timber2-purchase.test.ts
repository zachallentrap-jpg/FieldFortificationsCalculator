// TIMBER-2 — the bill, made orderable (TRAINING_AND_PACKETS_PLAN §4.1.3, FD60/FD61).
//
// The claim under test is narrow and checkable: a supply section can act on this without
// asking a question back. That means every quantity carries a unit of issue, two different
// products never share a row, nothing is silently spliced, and no number is fabricated to
// fill a column.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyNominal, cutList, orderNominal, treatmentFor, TREATMENT_NOTE } from '../src/timber/bom';
import { DEFAULT_STOCK_FT, PURCHASE_NOTES, purchaseFor, stockFit } from '../src/timber/purchase';
import { familyById, shippedFamilies } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import { fracIn } from '../src/timber/units';
import type { Member } from '../src/timber/types';

const model = (id: string) => generateStructure(familyById(id as never)!.preset);
const lines = (id: string) => cutList(model(id).members);

function member(over: Partial<Member> = {}): Member {
  return {
    id: 'T-1', role: 'stud', nominal: '2x4', actual: { w: 1.5, d: 3.5 },
    cutLength: 96, position: [0, 0, 0], rotation: [0, 0, 0], stage: 1,
    grade: 'No. 2 common', nailing: '2-16d (PH)', doctrineRef: 'test',
    ...over,
  } as Member;
}

// ── FD60: two products must never share an order line ────────────────────────

test('FD60: sheet goods separate by THICKNESS, not just by nominal', () => {
  // Subfloor (3/4), roof sheathing (1/2) and plywood siding (1/2) all call themselves
  // "4x8 panel". Merged, a supply section requisitions one pile of plywood and either the
  // floor goes down in half-inch or the roof in three-quarter.
  const all = lines('gp-frame').filter((l) => l.klass === 'sheet');
  const panels = all.filter((l) => l.nominal.includes('panel'));
  const thicknesses = new Set(panels.map((l) => l.nominal));
  assert.ok(thicknesses.has('4x8 panel 3/4"'), `no 3/4 row: ${[...thicknesses].join(', ')}`);
  assert.ok(thicknesses.has('4x8 panel 1/2"'), `no 1/2 row: ${[...thicknesses].join(', ')}`);
  // And no row is left un-thicknessed — that would be the merged row surviving.
  for (const l of panels) assert.match(l.nominal, /"$/, `${l.nominal} carries no thickness`);
});

test('the member keeps its own nominal — only the ORDER line is qualified', () => {
  // The BOM is a projection (I-3) and the two legacy floor/roof generators are frozen (C-10).
  // Correcting a bill must not touch the model it bills.
  for (const l of lines('gp-frame')) {
    assert.ok(l.nominal.startsWith(l.memberNominal), `${l.nominal} is not a qualified ${l.memberNominal}`);
  }
  const m = model('gp-frame');
  assert.ok(m.members.some((x) => x.nominal === '4x8 panel'), 'the member itself is unchanged');
});

test('orderNominal only touches sheet goods, and only when a thickness exists', () => {
  assert.equal(orderNominal(member()), '2x4');
  assert.equal(orderNominal(member({ nominal: '4x8 panel', actual: { w: 0.75, d: 48 } })), '4x8 panel 3/4"');
  assert.equal(orderNominal(member({ nominal: '4x8 panel', actual: { w: 0, d: 48 } })), '4x8 panel');
  assert.equal(orderNominal(member({ nominal: 'conc pad 16x16x8', actual: { w: 16, d: 8 } })), 'conc pad 16x16x8');
});

test('grade is part of the key — cutList no longer throws it away', () => {
  const cut = cutList([member(), member({ id: 'T-2', grade: 'select structural' })]);
  assert.equal(cut.length, 2, 'two grades of the same stick are two order lines');
  assert.deepEqual(cut.map((l) => l.grade).sort(), ['No. 2 common', 'select structural']);
});

test('every line carries a unit of issue', () => {
  for (const f of shippedFamilies()) {
    for (const l of lines(f.id)) {
      assert.ok(['EA', 'LF', 'BF', 'SHT', 'CY', 'LB'].includes(l.unitOfIssue), `${f.id}/${l.nominal}: ${l.unitOfIssue}`);
      assert.equal(l.klass, classifyNominal(l.memberNominal));
    }
  }
});

// ── Treatment ────────────────────────────────────────────────────────────────

test('anything bearing on soil is called out for ground contact', () => {
  for (const role of ['sill', 'post', 'skid', 'towerLeg', 'cribLog']) {
    assert.equal(treatmentFor(role), 'ground-contact', `${role} touches the ground`);
  }
  assert.equal(treatmentFor('stud'), undefined, 'a role with no cited rule prints blank, not a guess');
  assert.ok(TREATMENT_NOTE.includes('(PH)'), 'the note admits its own pending state');
});

test('a line whose roles disagree keeps the STRICTER treatment', () => {
  // Under-treating a member that touches soil is the failure that matters; over-treating one
  // that does not costs money. The bill errs the safe way and the note says how it decided.
  const cut = cutList([member({ role: 'sill' }), member({ id: 'T-2', role: 'deckPlank' })]);
  assert.equal(cut.length, 1, 'same nominal, same length, same grade — one line');
  assert.equal(cut[0]!.treatment, 'ground-contact');
});

// ── Stock fit ────────────────────────────────────────────────────────────────

test('cuts are packed onto real stock lengths, and the waste is exact', () => {
  // Three 5-ft cuts: two fit an 8-footer would leave 8-10=negative, so it opens the shortest
  // stock that holds ONE (8 ft) three times, 3 ft waste each.
  const cut = cutList(Array.from({ length: 3 }, (_, i) => member({ id: `T-${i}`, cutLength: 60 })));
  const { stock } = stockFit(cut, [8, 10, 12]);
  assert.equal(stock.length, 1);
  assert.equal(stock[0]!.stockLengthFt, 8);
  assert.equal(stock[0]!.pieces, 3);
  assert.equal(stock[0]!.wasteLF, 9, '3 ft off each of three sticks');
  assert.deepEqual(stock[0]!.cutsServed, [{ lengthIn: 60, count: 3 }]);
});

test('two cuts that share a stick share a stick', () => {
  const cut = cutList([member({ cutLength: 60 }), member({ id: 'T-2', cutLength: 36 })]);
  const { stock } = stockFit(cut, [8, 10, 12]);
  assert.equal(stock.length, 1);
  assert.equal(stock[0]!.pieces, 1, '5 ft + 3 ft is one 8-footer');
  assert.equal(stock[0]!.wasteLF, 0);
});

test('a bin opens at the SHORTEST stock that holds the cut', () => {
  // Opening a 16-footer for a 3-ft cut buys twelve feet to throw away.
  const { stock } = stockFit(cutList([member({ cutLength: 36 })]), DEFAULT_STOCK_FT);
  assert.equal(stock[0]!.stockLengthFt, 8);
});

test('FD61: nothing but lumber ever reaches the stock fit', () => {
  // A panel or a concrete nominal in here prints "buy 12-ft lengths of concrete slab", and the
  // cube goes NaN on the way through a DRESSED table that has no concrete row.
  for (const f of shippedFamilies()) {
    const { stock, longRuns } = stockFit(lines(f.id));
    for (const r of [...stock, ...longRuns]) {
      const base = r.nominal.replace(/ \d+(?: \d+\/\d+)?"$/, '');
      assert.equal(classifyNominal(base), 'lumber', `${f.id}: ${r.nominal} is not lumber`);
    }
  }
});

test('a run longer than any stock is surfaced, never silently spliced', () => {
  const cut = cutList([member({ nominal: '2x6', cutLength: 48 * 12, role: 'sill' })]);
  const { stock, longRuns } = stockFit(cut, [8, 10, 12, 14, 16]);
  assert.equal(stock.length, 0);
  assert.equal(longRuns.length, 1);
  assert.equal(longRuns[0]!.linealFt, 48);
  assert.deepEqual(longRuns[0]!.roles, ['sill']);
  // The note has to say what to do about it — a table with no instruction is a dead end.
  assert.ok(PURCHASE_NOTES.longRuns.includes('splice'), PURCHASE_NOTES.longRuns);
});

test('a long run names its roles, so a plate can be told from a girder', () => {
  // A 48-ft top plate is spliced over studs as a matter of course; a 48-ft girder is a design
  // problem. The tool will not decide which — but it must give the reader enough to.
  const { longRuns } = stockFit(lines('gp-frame'));
  assert.ok(longRuns.length > 0);
  for (const r of longRuns) assert.ok(r.roles.length > 0, `${r.nominal} at ${r.lengthIn}in names no role`);
});

// ── Sheets, concrete, hardware ───────────────────────────────────────────────

test('panels are bought by the sheet; roll goods are reported as coverage in squares', () => {
  // Panels butt, so cut area IS the area consumed. Roll roofing laps as it is laid, so the
  // same arithmetic under-orders it — and "41 sheets of roll roofing" is not a thing to order.
  const p = purchaseFor(lines('gp-frame'));
  const panel = p.sheets.find((s) => s.nominal.includes('panel'))!;
  assert.equal(panel.basis, 'sheet');
  assert.equal(panel.unit, 'SHT');
  assert.equal(panel.quantity, Math.ceil(panel.areaSqFt / 32 - 1e-9));

  const roll = p.sheets.find((s) => /roll|felt|paper/i.test(s.nominal));
  if (roll) {
    assert.equal(roll.basis, 'square');
    assert.equal(roll.unit, 'SQ');
    assert.equal(roll.quantity, Math.ceil(roll.areaSqFt / 100 - 1e-9));
  }
  assert.ok(PURCHASE_NOTES.squares.includes('laps are NOT added'), 'the lap gap must be stated');
});

test('concrete gets a real volume, from the member section — never from DRESSED', () => {
  const p = purchaseFor(lines('gp-frame'));
  assert.ok(p.concrete.length > 0, 'the GP frame is on concrete pads');
  for (const c of p.concrete) {
    assert.ok(Number.isFinite(c.cubicYards) && c.cubicYards > 0, `${c.nominal}: ${c.cubicYards} CY`);
    assert.ok(Number.isFinite(c.linealFt) && c.linealFt > 0);
  }
  assert.deepEqual(p.unpriced, [], 'nothing should be unpriceable in the GP frame');
});

test('a nominal with no section is ADMITTED, not billed at zero', () => {
  const cut = cutList([{ ...member({ nominal: 'mystery goo', cutLength: 120 }), actual: undefined } as unknown as Member]);
  const p = purchaseFor(cut);
  assert.equal(p.concrete[0]!.cubicYards, 0);
  assert.deepEqual(p.unpriced, ['mystery goo'], 'the reader has to be told the cube is missing');
});

test('every number in a purchase is finite, for every shipped family', () => {
  // FD61's actual failure mode: a NaN cube on a bill nobody notices until supply asks.
  for (const f of shippedFamilies()) {
    const p = purchaseFor(lines(f.id));
    for (const r of p.stock) for (const v of [r.pieces, r.wasteLF, r.stockLengthFt]) {
      assert.ok(Number.isFinite(v), `${f.id}/${r.nominal}: non-finite`);
    }
    for (const s of p.sheets) for (const v of [s.pieces, s.areaSqFt, s.quantity]) {
      assert.ok(Number.isFinite(v) && v >= 0, `${f.id}/${s.nominal}: ${v}`);
    }
    for (const c of p.concrete) for (const v of [c.linealFt, c.cubicYards]) {
      assert.ok(Number.isFinite(v) && v >= 0, `${f.id}/${c.nominal}: ${v}`);
    }
    for (const r of p.longRuns) assert.ok(Number.isFinite(r.linealFt) && r.linealFt > 0, `${f.id}/${r.nominal}`);
  }
});

test('every cut in the model is accounted for exactly once', () => {
  // The one arithmetic identity that matters: cuts served + long runs = pieces to make. A bill
  // that quietly drops a member is worse than no bill (TD18's rule, applied to purchasing).
  for (const f of shippedFamilies()) {
    const all = lines(f.id);
    const lumber = all.filter((l) => classifyNominal(l.memberNominal) === 'lumber');
    const want = lumber.reduce((a, l) => a + l.count, 0);
    const { stock, longRuns } = stockFit(all);
    const served = stock.reduce((a, r) => a + r.cutsServed.reduce((b, c) => b + c.count, 0), 0)
      + longRuns.reduce((a, r) => a + r.count, 0);
    assert.equal(served, want, `${f.id}: ${want} cuts in, ${served} accounted for`);
  }
});

test('fracIn writes an inch the way a catalogue does', () => {
  assert.equal(fracIn(0.5), '1/2');
  assert.equal(fracIn(0.75), '3/4');
  assert.equal(fracIn(1.5), '1 1/2');
  assert.equal(fracIn(2), '2');
  assert.equal(fracIn(0.25), '1/4');
  assert.equal(fracIn(0.125), '1/8');
});

test('the notes say what the numbers do NOT include', () => {
  // Every one of these is an error bar. Losing one turns an estimate into a claim.
  assert.ok(PURCHASE_NOTES.stockFit.toLowerCase().includes('kerf'));
  assert.ok(PURCHASE_NOTES.waste.toLowerCase().includes('no contingency'));
  assert.ok(PURCHASE_NOTES.sheets.includes('ripped'));
});
