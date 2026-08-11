// TIMBER-2 — the dressed-size table, held to the RULE rather than to two literals.
//
// Softwood is sold by a nominal size and delivered smaller, and there are two deductions, not
// one. DIMENSION LUMBER (nominal thickness under 5 in) loses 1/2 in up to a 6-in face and 3/4 in
// at 8 in and over — a 2x8 is 1 1/2 by 7 1/4. A TIMBER (nominal 5 in and thicker in its least
// dimension) is a different product: it is surfaced green and loses 1/2 in on every face, so an
// 8-in timber face is 7 1/2 in where an 8-in dimension-lumber face is 7 1/4.
//
// `DRESSED` had the dimension-lumber deduction on its two timber rows, 6x8 and 8x8, and modelled
// them 1/4 in shallow apiece. Those rows are not decoration: they are the bunker's crib logs and
// cap beams, the overhead stringers over the clear span, and the guard tower's mudsill — the
// members carrying the LS tags. Every other row was right, which is exactly why a test that
// restated the two corrected literals would prove nothing. This asserts the rule across the whole
// table, so the next size anyone adds is checked by the same standard the fix was made against.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRESSED } from '../src/woodframe/types';
import { BF_PER_LF } from '../src/woodframe/bom';
import { BUNKER, TOWER, IN_PER_FT } from '../src/woodframe/doctrine';
import { generateStructure } from '../src/woodframe/families/index';
import { familyById } from '../src/woodframe/catalog';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TYPES = fileURLToPath(new URL('../src/woodframe/types.ts', import.meta.url));

/** Nominal → dressed, by the standard softwood rule. `null` for a name this rule does not cover. */
function dressedByRule(nominal: string): { w: number; d: number } | null {
  const parts = nominal.split('x').map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [nw, nd] = parts as [number, number];
  // A timber is nominal 5 in and thicker in its LEAST dimension, and dresses 1/2 in all round.
  if (Math.min(nw, nd) >= 5) return { w: nw - 0.5, d: nd - 0.5 };
  // Dimension lumber. 1-in boards are the one fixed case (3/4 in); otherwise 1/2 in off up to a
  // 6-in face and 3/4 in off at 8 in and over.
  const face = (n: number): number => (n === 1 ? 0.75 : n <= 6 ? n - 0.5 : n - 0.75);
  return { w: face(nw), d: face(nd) };
}

test('every dressed size follows the deduction its own nominal calls for', () => {
  const wrong: string[] = [];
  for (const [nominal, actual] of Object.entries(DRESSED)) {
    const want = dressedByRule(nominal);
    assert.ok(want, `${nominal}: not a WxN nominal — the rule below cannot check it`);
    if (actual.w !== want.w || actual.d !== want.d) {
      wrong.push(`${nominal}: table says ${actual.w}x${actual.d}, the rule says ${want.w}x${want.d}`);
    }
  }
  assert.deepEqual(wrong, [], `dressed sizes off the standard rule:\n  ${wrong.join('\n  ')}`);
});

test('the table really does contain both kinds — the rule is not vacuously satisfied', () => {
  const names = Object.keys(DRESSED);
  const timbers = names.filter((n) => Math.min(...n.split('x').map(Number)) >= 5);
  const dimension = names.filter((n) => Math.min(...n.split('x').map(Number)) < 5);
  assert.ok(timbers.length >= 3, `only ${timbers.length} timber rows — the timber branch is barely tested`);
  assert.ok(dimension.length >= 8, `only ${dimension.length} dimension rows`);
  // And the two deductions genuinely differ on an 8-in face, which is the whole finding: an 8-in
  // TIMBER face and an 8-in DIMENSION face are not the same number.
  assert.notEqual(DRESSED['8x8']!.d, DRESSED['2x8']!.d);
});

test('the bunker and tower members that carry the load are cut to the timber size', () => {
  // Behavioural, on the emitted geometry rather than the table: these are the members the LS tags
  // are on, and they are what was 1/4 in shallow.
  const bunker = generateStructure(JSON.parse(JSON.stringify(familyById('crib-bunker' as never)!.preset)));
  const capNominal = BUNKER.capNominal.value as string;
  const cap = bunker.members.find((m) => m.role === 'capBeam' && m.nominal === capNominal);
  assert.ok(cap, `no ${capNominal} cap beam in the crib bunker`);
  assert.deepEqual({ w: cap.actual.w, d: cap.actual.d }, dressedByRule(capNominal));

  const tower = generateStructure(JSON.parse(JSON.stringify(familyById('tower' as never)!.preset)));
  const mudsillNominal = TOWER.mudsillNominal.value as string;
  const mudsill = tower.members.find((m) => m.role === 'sill' && m.nominal === mudsillNominal);
  assert.ok(mudsill, `no ${mudsillNominal} mudsill on the tower`);
  assert.deepEqual({ w: mudsill.actual.w, d: mudsill.actual.d }, dressedByRule(mudsillNominal));
});

test('the board-foot RATE is nominal — lumber is sold by the size on the tally, not the size it dresses to', () => {
  // Half of what a dressed size does to the bill. A stick of 8x8 is bought as 8x8 however it
  // surfaces, so the per-foot rate must stay off the nominal section; coupling it to DRESSED
  // would let a geometry correction reprice a job by itself.
  for (const nominal of ['6x8', '8x8', '6x6', '2x8']) {
    const [w, d] = nominal.split('x').map(Number) as [number, number];
    assert.ok(
      Math.abs(BF_PER_LF[nominal]! - (w * d) / IN_PER_FT) < 1e-12,
      `${nominal}: the board-foot rate followed the dressed size instead of the nominal one`,
    );
  }
});

test('and the LENGTHS are not — a piece cut to fit is cut to the dressed face, so the bill moves', () => {
  // The other half, and the one that is easy to state backwards. Board feet are rate × length,
  // and the length of anything cut BETWEEN two members is set by how wide those members really
  // are. The crib bunker's overhead blocking fits between 8x8 stringers: at the timber deduction
  // the stringers are 7 1/2 in and each block is cut shorter than it would be at 7 1/4, and the
  // bunker's board-foot total moves with it. Expected off the RULE rather than off `DRESSED`, so
  // reverting the table makes the emitted cut and the expectation disagree.
  const bunker = generateStructure(JSON.parse(JSON.stringify(familyById('crib-bunker' as never)!.preset)));
  const stringers = bunker.members.filter((m) => m.role === 'ohcStringer').sort((a, b) => a.position[0] - b.position[0]);
  const blocking = bunker.members.filter((m) => m.role === 'ohcBlocking');
  assert.ok(stringers.length >= 2 && blocking.length > 0, 'the crib bunker no longer has an overhead deck to measure');

  const nominal = stringers[0]!.nominal;
  const rule = dressedByRule(nominal)!;
  const centreSpacingFt = stringers[1]!.position[0] - stringers[0]!.position[0];
  const clearGapFt = centreSpacingFt - rule.w / IN_PER_FT;
  for (const b of blocking) {
    assert.ok(
      Math.abs(b.cutLength / IN_PER_FT - clearGapFt) < 1e-9,
      `${b.id}: cut ${(b.cutLength / IN_PER_FT).toFixed(4)} ft between ${nominal} stringers `
      + `${centreSpacingFt.toFixed(4)} ft apart; a ${rule.w} in face leaves ${clearGapFt.toFixed(4)} ft`,
    );
  }
  // Stated as the money consequence, from the same rule: a quarter inch on each stringer face is
  // this many board feet off the bunker's bill, which is why the cut list is not decoration.
  const wrongGapFt = centreSpacingFt - (rule.w - 0.25) / IN_PER_FT;
  const swing = blocking.length * (wrongGapFt - clearGapFt) * BF_PER_LF[nominal]!;
  assert.ok(swing > 1, `a quarter inch across ${blocking.length} blocks moves only ${swing.toFixed(2)} BF`);
});

test('the figures the DRESSED header argues from are the ones the bunker actually cuts', () => {
  // The header makes its case for the timber deduction on one member — the crib bunker's overhead
  // blocking — and states what that member is cut to at each of the two faces. A magnitude stated
  // there is an argument, so it has to survive being checked: the blocks are cut in INCHES, and a
  // figure a reader cannot reproduce is the same defect the header exists to correct.
  const cribBunker = () => JSON.parse(JSON.stringify(familyById('crib-bunker' as never)!.preset));
  const measure = (): { blocks: number; cutIn: number } => {
    const blocking = generateStructure(cribBunker()).members.filter((m) => m.role === 'ohcBlocking');
    const lengths = [...new Set(blocking.map((b) => +b.cutLength.toFixed(3)))];
    assert.equal(lengths.length, 1, `the overhead blocking is no longer one repeated cut: ${lengths.join(', ')}`);
    return { blocks: blocking.length, cutIn: lengths[0]! };
  };

  const asTimber = measure();
  // The counterfactual the header names, measured rather than asserted: the same bunker with the
  // 8x8 row standing back on the dimension-lumber deduction.
  const saved = { ...DRESSED['8x8']! };
  DRESSED['8x8'] = { w: 7.25, d: 7.25 };
  let asDimensionLumber: { blocks: number; cutIn: number };
  try {
    asDimensionLumber = measure();
  } finally {
    DRESSED['8x8'] = saved;
  }
  assert.deepEqual(DRESSED['8x8'], saved, 'the table was left mutated');
  assert.ok(asDimensionLumber.cutIn > asTimber.cutIn, 'a narrower stringer face has to leave a longer block');

  const header = readFileSync(TYPES, 'utf8').split('export const DRESSED')[0]!.replace(/\n\s*\/\/\s?/g, ' ');
  const stated = /(\d+)\s+overhead blocks is cut ([\d.]+) (in|ft) between 7 1\/2-in stringers where it would be ([\d.]+) (in|ft)/i
    .exec(header);
  assert.ok(stated, 'the header no longer states the blocking figures its argument rests on');
  assert.equal(Number(stated[1]), asTimber.blocks, `the header counts ${stated[1]} blocks; the bunker cuts ${asTimber.blocks}`);
  assert.equal(stated[3]!.toLowerCase(), 'in', `the header gives the cut in ${stated[3]}; it is inches`);
  assert.equal(stated[5]!.toLowerCase(), 'in', `the header gives the counterfactual in ${stated[5]}; it is inches`);
  assert.equal(Number(stated[2]), asTimber.cutIn, `the header says ${stated[2]} in; the bunker cuts ${asTimber.cutIn} in`);
  assert.equal(
    Number(stated[4]), asDimensionLumber.cutIn,
    `the header says a 7 1/4-in stringer would leave ${stated[4]} in; it leaves ${asDimensionLumber.cutIn} in`,
  );
});
