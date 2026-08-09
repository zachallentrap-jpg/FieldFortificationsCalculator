// `coverings.roofDeck`, which had three faults in one field.
//
// A BOARD DECK WAS PLYWOOD. `'boards'` and `'plywood'` came out of the covering pass byte for
// byte the same: the same 4x8 panel members, the same nominal on the cut list, the same smooth
// tan sheet on screen. The wall pass next door has always laid its board siding as real boards at
// their true dressed width with the last one ripped — this side never did.
//
// `'skip'` WAS A SYNONYM FOR `'none'` that no card offered and no generator told apart.
//
// AND THE WHOLE SECTION TOOK ANY STRING. `siding: "nonsense"` and `roofing: "nonsense"` came back
// with the same member count as a real answer; `wallSheathing` and `roofDeck` came back with none.
// Nothing said a word. A share link is the only way to reach any of it, and a share link is
// exactly where a typo — or a value from a later version of this tool — comes from.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { LUMBER, PANEL, IN_PER_FT } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

/** A roof kind the covering pass actually decks — the frozen gable decks itself (C-9). */
const SHED = { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' };

const deckOf = (roofDeck: string, over: Record<string, unknown> = {}) => {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset)) as Record<string, unknown>;
  spec.roof = { ...SHED };
  spec.coverings = { wallSheathing: 'none', siding: 'plywood', roofDeck, roofing: 'none', ...over };
  return generateStructure(spec as unknown as StructureSpec);
};

const sig = (m: ReturnType<typeof deckOf>): string => m.members
  .filter((x) => x.role === 'roofPanel' || x.role === 'purlin')
  .map((x) => `${x.nominal}|${x.cutLength.toFixed(4)}|${x.actual.d.toFixed(4)}|${x.position.map((v) => v.toFixed(4))}`)
  .join(';');

test('A BOARD DECK IS BOARDS — not the plywood option wearing a different label', () => {
  const boards = deckOf('boards');
  const plywood = deckOf('plywood');
  const bd = boards.members.filter((x) => x.role === 'roofPanel');
  const pw = plywood.members.filter((x) => x.role === 'roofPanel');
  assert.ok(bd.length > 0 && pw.length > 0, 'both decks lay something');
  assert.notEqual(sig(boards), sig(plywood), "'boards' and 'plywood' produce identical geometry");
  // Every piece of a board deck is STOCK: a nominal the lumber table knows, at its own thickness.
  const stockNominal = LUMBER.deckBoardNominal.value as string;
  const stock = DRESSED[stockNominal]!;
  for (const k of bd) {
    assert.equal(k.nominal, stockNominal, `${k.id} is a ${k.nominal} on a board deck`);
    assert.ok(Math.abs(k.actual.w - stock.w) < 1e-9, `${k.id} is not ${stockNominal} thick`);
  }
  // And the plywood deck is untouched — panels, at the panel thickness.
  for (const k of pw) {
    assert.match(k.nominal, /panel$/, `${k.id} is a ${k.nominal} on a plywood deck`);
    assert.ok(Math.abs(k.actual.w - (PANEL.roofDeckThickIn.value as number)) < 1e-9);
  }
});

test('and the boards are WHOLE — the sheet tiler used to slice each one into four', () => {
  // `tileSurface` splits a course into bands up the slope when a hip tapers faster than a sheet's
  // height can follow. That is right for a 4-ft sheet and wrong for a 7¼-in board: measured on a
  // hip, every course came out as four 1⅞-in strips. A board is one piece, cut on the diagonal at
  // the hip, which is what clipping to the span at its own mid-height describes.
  const stock = DRESSED[LUMBER.deckBoardNominal.value as string]!;
  for (const roof of [SHED, { kind: 'hip', risePer12: 4, overhangFt: 1 }]) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset)) as Record<string, unknown>;
    spec.roof = roof;
    spec.coverings = { wallSheathing: 'none', siding: 'plywood', roofDeck: 'boards', roofing: 'none' };
    const bd = generateStructure(spec as unknown as StructureSpec).members.filter((x) => x.role === 'roofPanel');
    assert.ok(bd.length > 10, `${roof.kind}: ${bd.length} boards`);
    const widths = [...new Set(bd.map((k) => Math.round(k.actual.d * 1e6) / 1e6))].sort((a, b) => a - b);
    // One full width, plus at most one ripped course per plane.
    assert.ok(Math.abs(widths[widths.length - 1]! - stock.d) < 1e-6,
      `${roof.kind}: the widest board is ${widths[widths.length - 1]!.toFixed(3)} in of a ${stock.d} in stock face`);
    for (const w of widths) {
      assert.ok(w <= stock.d + 1e-9, `${roof.kind}: a board claims a ${w.toFixed(3)} in face on ${stock.d} in stock`);
    }
    const full = bd.filter((k) => Math.abs(k.actual.d - stock.d) < 1e-6).length;
    assert.ok(full > bd.length / 2, `${roof.kind}: only ${full} of ${bd.length} boards are whole`);
  }
});

test('and the roofing rides on the deck it actually has', () => {
  // The lift used to come off `PANEL.roofDeckThickIn` for both, so a ¾-in board deck lifted the
  // roofing by ½ in and the courses sank into it.
  const lowest = (deck: string): number => Math.min(...deckOf(deck, { roofing: 'corrugated' })
    .members.filter((x) => x.role === 'roofingCourse').map((x) => x.position[1]));
  const board = DRESSED[LUMBER.deckBoardNominal.value as string]!.w / IN_PER_FT;
  const panel = (PANEL.roofDeckThickIn.value as number) / IN_PER_FT;
  // The lift is PERPENDICULAR to the roof plane, so a quarter inch of extra deck raises the
  // course by a quarter inch times the cosine of the pitch — not by a quarter inch.
  const cos = Math.cos(Math.atan(SHED.risePer12 / 12));
  const rise = lowest('boards') - lowest('plywood');
  assert.ok(Math.abs(rise - (board - panel) * cos) < 1e-9,
    `roofing sits ${rise.toFixed(5)} ft higher on boards than on plywood; the decks differ by `
    + `${(board - panel).toFixed(5)} ft, which on this pitch is ${((board - panel) * cos).toFixed(5)}`);
});

test('A COVERING NOBODY WROTE IS REPAIRED AND SAID — on every one of the four', () => {
  const fields: [string, string][] = [
    ['wallSheathing', 'none, plywood, boards'],
    ['siding', 'none, plywood, boards, boardAndBatten'],
    ['roofDeck', 'none, plywood, boards, purlins'],
    ['roofing', 'none, roll, rollDouble, corrugated'],
  ];
  for (const [field, choices] of fields) {
    const spec = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset)) as Record<string, unknown>;
    spec.roof = { ...SHED };
    (spec.coverings as Record<string, unknown>)[field] = 'nonsense';
    const m = generateStructure(spec as unknown as StructureSpec);
    const said = m.issues.find((i) => i.path === `coverings.${field}`);
    assert.ok(said, `coverings.${field}: an unknown value is accepted in silence`);
    assert.ok(said!.message.includes(choices), `coverings.${field}: the message does not name the choices`);
    // And every legal value is left alone.
    for (const ok of choices.split(', ')) {
      const clean = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset)) as Record<string, unknown>;
      clean.roof = { ...SHED };
      (clean.coverings as Record<string, unknown>)[field] = ok;
      assert.equal(generateStructure(clean as unknown as StructureSpec).issues
        .filter((i) => i.path === `coverings.${field}`).length, 0,
      `coverings.${field}: "${ok}" was repaired and should not have been`);
    }
  }
});

test("and a link still carrying roofDeck 'skip' gets the thing it always meant", () => {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset)) as Record<string, unknown>;
  spec.roof = { ...SHED };
  (spec.coverings as Record<string, unknown>).roofDeck = 'skip';
  const m = generateStructure(spec as unknown as StructureSpec);
  const said = m.issues.find((i) => i.path === 'coverings.roofDeck');
  assert.ok(said, "'skip' is accepted in silence");
  assert.match(said!.message, /same as none/, 'and the message says what it meant');
  assert.equal((m.spec as unknown as { coverings: { roofDeck: string } }).coverings.roofDeck, 'none');
  assert.equal(m.members.filter((x) => x.role === 'roofPanel').length,
    deckOf('none').members.filter((x) => x.role === 'roofPanel').length);
});
