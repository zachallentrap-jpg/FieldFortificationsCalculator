// The loading platform's ramp, against the ground it runs down to.
//
// A ramp is the one piece of this toolkit whose whole job is to get from a deck to the earth, so
// where it meets the earth is not a detail. `platform.ts` parameterises it beautifully — one
// `seat(x, s, drop)` for every piece, `s = 0` at grade and `s = 1` at the platform edge — and put
// `s = 0` on the WALKING SURFACE. Everything holding that surface up was therefore underground:
// the toe plank lay entirely below grade, and the stringers ran 12.34 in deep for the last six
// feet of a twenty-four-foot run. The stringers' own nailing note says "bedded at grade"; buried
// a foot under it is not bedded.
//
// Two things had to change and they are independent, so both are pinned here: the datum (`s = 0`
// is now one deck thickness up, so the toe board lies ON the earth) and the toe cut (a stringer
// is cut level where its underside meets grade, which is what makes the toe a bedded wedge rather
// than a square end driven into the ground).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { stringerEndProfile } from '../src/timber/stringerCuts';
import { RAMP, IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

type V3 = [number, number, number];

function rotate(m: Member, v: V3): V3 {
  const [rx, ry, rz] = m.rotation;
  let [x, y, z] = v;
  let a = x * Math.cos(rz) - y * Math.sin(rz);
  let b = x * Math.sin(rz) + y * Math.cos(rz);
  x = a; y = b;
  a = y * Math.cos(rx) - z * Math.sin(rx);
  b = y * Math.sin(rx) + z * Math.cos(rx);
  y = a; z = b;
  a = x * Math.cos(ry) + z * Math.sin(ry);
  b = -x * Math.sin(ry) + z * Math.cos(ry);
  return [a, y, b];
}

function corners(m: Member): V3[] {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const out: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    out.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
  }
  return out;
}

/** The stringer AS CUT — its raw box is not the piece, and at a 1:6 toe the difference is a foot. */
function cutCorners(m: Member): V3[] {
  const hz = m.actual.w / 24;
  return stringerEndProfile(m).flatMap(([px, py]) => [-hz, hz].map((pz) => {
    const r = rotate(m, [px, py, pz]);
    return [m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]] as V3;
  }));
}

function platform(over: Record<string, unknown> = {}) {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset)) as Record<string, unknown>;
  Object.assign(spec, over);
  const m = generateStructure(spec as unknown as StructureSpec);
  return {
    model: m,
    gradeY: m.levels.gradeY ?? 0,
    stringers: m.members.filter((x) => x.id.startsWith('PF-stringer')),
    // Everything on the ramp: it is the only thing out past the platform's own edge. CONCRETE IS
    // EXCLUDED — a footing is supposed to be in the ground, and a check that flags one is a check
    // that has stopped meaning anything.
    ramp: m.members.filter((x) => x.role !== 'footing' && x.role !== 'slab'
      && corners(x).some((c) => c[2] < -0.01)),
  };
}

test('NOTHING ON THE RAMP IS UNDERGROUND', () => {
  // Measured before: the stringers reached 12.34 in below grade and the toe plank sat entirely
  // under it. The deck is checked as a plain box because its pieces are not cut; the stringers
  // are checked as CUT, because a raked box round a 1:6 toe over-reads by the whole toe wedge.
  const { gradeY, stringers, ramp } = platform();
  assert.ok(stringers.length >= 2, 'the preset has a ramp');
  for (const s of stringers) {
    const lo = Math.min(...cutCorners(s).map((c) => c[1]));
    assert.ok(lo >= gradeY - 1e-6,
      `${s.id} reaches ${((lo - gradeY) * IN_PER_FT).toFixed(2)} in below grade`);
  }
  for (const x of ramp.filter((r) => r.role !== 'stringer')) {
    const lo = Math.min(...corners(x).map((c) => c[1]));
    assert.ok(lo >= gradeY - 1e-6,
      `${x.id} (${x.role}) reaches ${((lo - gradeY) * IN_PER_FT).toFixed(2)} in below grade`);
  }
});

test('and the toe still REACHES the ground — it does not stop short of it', () => {
  // The other way to have nothing underground is to hold the whole ramp up in the air, which
  // would be just as wrong and would look almost the same in a thumbnail.
  const { gradeY, ramp } = platform();
  const deck = ramp.filter((x) => x.role === 'deckPlank');
  assert.ok(deck.length > 0);
  const lo = Math.min(...deck.flatMap((x) => corners(x).map((c) => c[1])));
  const deckThickFt = Math.max(...deck.map((x) => x.actual.w)) / IN_PER_FT;
  // The boards are laid ACROSS the ramp from the toe up, so the lowest one's centre is half a
  // board up the slope and its underside is a hair above grade rather than exactly on it. The
  // claim is that the toe LANDS: on the ground, within the thickness of the board that gets there
  // first, and never under it.
  const boardRiseFt = Math.max(...deck.map((x) => x.actual.d)) / IN_PER_FT;
  assert.ok(lo >= gradeY - 1e-9, `the toe board's underside is at ${lo.toFixed(4)}, below grade`);
  assert.ok(lo - gradeY <= boardRiseFt + deckThickFt,
    `the toe board's underside is ${((lo - gradeY) * IN_PER_FT).toFixed(2)} in up — the ramp stops short of the ground`);
});

test('the slope is still the doctrine slope — only the datum moved', () => {
  // The rise the slope is measured over changed (it starts a board's thickness up), so the run
  // changed with it. What must NOT change is the ratio, which is the life-safety figure.
  // Measured off the stringers' own pitch, which IS the ramp's geometry — a bounding box round
  // the deck boards answers with their thickness folded in and reads 3% shallow.
  for (const slope of RAMP.slopes.value as readonly number[]) {
    const p = platform({ ramp: { widthFt: 8, slope } });
    assert.ok(p.stringers.length >= 2, `1:${slope} produced no stringers`);
    for (const s2 of p.stringers) {
      const measured = 1 / Math.tan(Math.abs(s2.rotation[2]!));
      assert.ok(Math.abs(measured - slope) < 1e-9,
        `1:${slope} ramp measures 1:${measured.toFixed(4)}`);
    }
  }
});

test('a stringer cut for a RAMP puts its long wedge at the bottom, not the top', () => {
  // The toolkit contains both handednesses. A stair climbs out of its +X end and its foot is at
  // -hx; the ramp is written the other way round — "walking out the +X end goes DOWNHILL" — so
  // its foot is at +hx. Cutting the level face onto the wrong end would leave the buried end
  // square and hang the wedge in the air at the deck.
  const { stringers } = platform();
  const s = stringers[0]!;
  assert.ok(s.rotation[2]! < 0, 'the premise: a ramp stringer carries a negative pitch');
  const prof = stringerEndProfile(s);
  const hx = s.cutLength / 24;
  const underside = prof.filter((q) => q[1] < 0).map((q) => q[0]).sort((a, b) => a - b);
  // The long bite is taken off the +X (downhill) end, so the underside stops well short of +hx
  // and starts close to -hx.
  assert.ok(hx - underside[1]! > hx * 0.1, 'the level cut is at the downhill end');
  assert.ok(underside[0]! + hx < hx * 0.1, 'and the plumb cut at the uphill end is the small one');
  // A stair's is the mirror image, from the same function.
  const stair = { cutLength: s.cutLength, actual: s.actual, rotation: [0, 0, -s.rotation[2]!] as V3 };
  const stairProf = stringerEndProfile(stair);
  const stairUnder = stairProf.filter((q) => q[1] < 0).map((q) => q[0]).sort((a, b) => a - b);
  assert.ok(Math.abs(stairUnder[0]! + underside[1]!) < 1e-9, 'the two are mirror images');
});

test('the ramp is the same shape at every slope the doctrine offers', () => {
  for (const slope of RAMP.slopes.value as readonly number[]) {
    const { gradeY, stringers, ramp } = platform({ ramp: { widthFt: 8, slope } });
    assert.ok(stringers.length >= 2, `1:${slope} produced no stringers`);
    for (const s of stringers) {
      const lo = Math.min(...cutCorners(s).map((c) => c[1]));
      assert.ok(lo >= gradeY - 1e-6, `1:${slope}: ${s.id} is ${((lo - gradeY) * IN_PER_FT).toFixed(2)} in under`);
    }
    const deck = ramp.filter((x) => x.role === 'deckPlank');
    const deckLo = Math.min(...deck.flatMap((x) => corners(x).map((c) => c[1])));
    const reach = (Math.max(...deck.map((x) => x.actual.d)) + Math.max(...deck.map((x) => x.actual.w))) / IN_PER_FT;
    assert.ok(deckLo >= gradeY - 1e-9 && deckLo - gradeY <= reach,
      `1:${slope}: the toe board's underside is at ${deckLo.toFixed(4)} against grade ${gradeY.toFixed(4)}`);
  }
});

test('a platform with no ramp has no ramp members', () => {
  const spec = JSON.parse(JSON.stringify(familyById('platform')!.preset)) as Record<string, unknown>;
  delete spec.ramp;
  const m = generateStructure(spec as unknown as StructureSpec);
  assert.equal(m.members.filter((x) => x.id.startsWith('PF-stringer')).length, 0);
  assert.ok(m.members.length > 50, 'the platform itself is still built');
});
