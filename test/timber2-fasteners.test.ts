// TIMBER-2 — the hardware take-off, rule by rule.
//
// Every assertion below names a nailing schedule the engine ACTUALLY emits (see the comment on
// the "no schedule goes unread" test, which proves that claim rather than asserting it), so a
// rule that stops matching is a rule whose string changed, and the compat goldens would have
// caught that first. What this suite protects is the arithmetic on top.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fastenerTakeoff, fastenersForMember } from '../src/timber/fasteners';
import { familyById, FAMILY_TABLE } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import type { Member } from '../src/timber/types';

function member(nailing: string, over: Partial<Member> = {}): Member {
  return {
    id: 'T-1', role: 'stud', nominal: '2x4', actual: { w: 1.5, d: 3.5 },
    cutLength: 96, position: [0, 0, 0], rotation: [0, 0, 0], stage: 1,
    grade: 'No. 2 common', nailing, doctrineRef: 'test',
    ...over,
  } as Member;
}

function count(nailing: string, over: Partial<Member> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const ok = fastenersForMember(member(nailing, over), {
    add: (kind, n) => { out[kind] = (out[kind] ?? 0) + n; },
  });
  assert.ok(ok, `no rule matched: ${nailing}`);
  return out;
}

test('"N-Xd ea end" is N per end, both ends', () => {
  assert.deepEqual(count('2-16d ea end (PH)'), { '16d': 4 });
  assert.deepEqual(count('4-8d ea end (PH)'), { '8d': 8 });
});

test('an "or" is an alternative, not a second obligation', () => {
  // "2-16d ea end or 4-8d toenail" is one joint done one of two ways. Billing both would put
  // eight extra nails per joist into a supply request for a connection nobody makes twice.
  assert.deepEqual(count('2-16d ea end or 4-8d toenail (PH)'), { '16d': 4 });
});

test('a rafter owes its ridge nails AND its bird’s-mouth toenails', () => {
  // 3 at the ridge (one joint), 3 toenailed at the seat (one joint) — not 2x either.
  assert.deepEqual(count('3-16d at ridge, bird’s-mouth toenail 3-8d (PH)'), { '16d': 3, '8d': 3 });
});

test('a schedule naming another member is that joint seen from its other side', () => {
  // The ridge board says "rafters 3-16d ea". Every rafter already bought those same nails with
  // "3-16d at ridge". Counting the ridge too would double the biggest line on a roof.
  const out: Record<string, number> = {};
  fastenersForMember(member('rafters 3-16d ea (PH)', { role: 'ridge', nominal: '2x8', cutLength: 576 }), {
    add: (k, n) => { out[k] = (out[k] ?? 0) + n; },
  });
  assert.deepEqual(out, {});
});

test('spaced schedules count off the member’s own length', () => {
  assert.deepEqual(count('16d @ 12" to king stud (PH)', { cutLength: 96 }), { '16d': 8 });
  // Staggered means both faces, so twice the run.
  assert.deepEqual(count('16d @ 16" staggered, both faces (PH)', { cutLength: 96 }), { '16d': 12 });
});

test('sheathing counts edges by perimeter and field by intermediate supports', () => {
  // A 4x8 panel: 96 x 48, edges at 6" -> ceil(288/6) = 48; supports crossed at 16" = 5
  // intermediate, each taking ceil(48/12) = 4 -> 20. Total 68.
  const out = count('8d @ 6" edges / 12" field (PH)', { nominal: '4x8 panel', cutLength: 96, actual: { w: 0.5, d: 48 } });
  assert.deepEqual(out, { '8d': 68 });
});

test('concrete is not nailed, and says so by producing nothing', () => {
  const out: Record<string, number> = {};
  const ok = fastenersForMember(member('poured on undisturbed soil (PH)', { role: 'footing', nominal: 'conc pad 16x16x8' }), {
    add: (k, n) => { out[k] = (out[k] ?? 0) + n; },
  });
  assert.ok(ok, 'a footing is handled, not reported as unparsed');
  assert.deepEqual(out, {});
});

test('no schedule in a real building goes unread', () => {
  // This is the test that makes the rest meaningful: it walks every member of a shipped family
  // and fails if ANY nailing schedule falls through every rule. Silence here is the whole
  // honesty claim — a hardware list that skips what it did not understand looks complete.
  //
  // EVERY SHIPPED CARD, not one. This walked `gp-frame` alone for as long as it existed, and
  // `gp-frame` has no screened band — so the sea-hut's `staples @ 4" + batten` went unread on
  // four members per hut, in the one check whose entire job is to notice that.
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(JSON.parse(JSON.stringify(fam.preset)));
    const take = fastenerTakeoff(model.members);
    assert.deepEqual(take.unparsed, [],
      `${fam.id} unread schedules: ${take.unparsed.map((u) => `${u.schedule} (x${u.members})`).join(' | ')}`);
    assert.ok(take.lines.length > 0, `${fam.id} bought no fasteners at all`);
    for (const line of take.lines) {
      assert.ok(Number.isInteger(line.count) && line.count > 0, `${fam.id}: ${line.spec} count`);
      assert.ok(line.usedFor.length > 0, `${fam.id}: ${line.spec} has no attribution`);
    }
  }
});

test('the take-off is pure and additive over stages', () => {
  const model = generateStructure(JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)));
  const whole = fastenerTakeoff(model.members);
  assert.deepEqual(fastenerTakeoff(model.members), whole, 'same members in, same bill out');
  // Splitting the members by stage and summing must give the same totals: the bill is an
  // aggregation over members, so it cannot depend on how they were grouped.
  const stages = [...new Set(model.members.map((m) => m.stage))];
  const perStage = new Map<string, number>();
  for (const s of stages) {
    for (const line of fastenerTakeoff(model.members.filter((m) => m.stage === s)).lines) {
      perStage.set(line.spec, (perStage.get(line.spec) ?? 0) + line.count);
    }
  }
  for (const line of whole.lines) {
    assert.equal(perStage.get(line.spec), line.count, `${line.spec} differs when counted per stage`);
  }
});
