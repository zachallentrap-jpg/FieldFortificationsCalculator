// The rail on a flight of stairs, which did not exist.
//
// `StairResult.landings` has carried the comment "Landing centres, for the railing pass" since
// the module was written, and grep found no reader anywhere. So a 24-ft guard tower — switched
// from a ladder to a stair BY EM 385-1-1, because a ladder that high is not acceptable — climbed
// three flights past two landings with nothing to hold and nothing to stop a fall, while the
// platform it arrives at carried a full guardrail with a toe board. Measured before: 21 rail and
// toe-board members in the model, every one of them at 24 ft or above.
//
// The same shape as `fill`, `entrySteps` and `shutters` before it: the field that names the
// missing work is right there in the type, written by the thing that knows and read by nobody.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { generateStair } from '../src/timber/subsystems/access';
import { RAIL, STAIR, IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';
import { DRESSED } from '../src/timber/types';
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

/** The two ends of a member's centreline, in world space. */
function ends(m: Member): [V3, V3] {
  const h = m.cutLength / 24;
  const a = rotate(m, [h, 0, 0]);
  return [
    [m.position[0] + a[0], m.position[1] + a[1], m.position[2] + a[2]],
    [m.position[0] - a[0], m.position[1] - a[1], m.position[2] - a[2]],
  ];
}

const modelOf = (id: string, over: Record<string, unknown> = {}) => {
  const spec = JSON.parse(JSON.stringify(familyById(id as never)!.preset)) as Record<string, unknown>;
  Object.assign(spec, over);
  return generateStructure(spec as unknown as StructureSpec);
};

const topH = (RAIL.topHeightIn.value as number) / IN_PER_FT;
const midH = (RAIL.midHeightIn.value as number) / IN_PER_FT;

/** A rail piece that follows a slope — the ones on the flights, as against a landing's. */
const raked = (m: Member): boolean => Math.abs(m.rotation[2]) > 1e-6;

test('THE FLIGHTS OF A TOWER STAIR ARE RAILED — on both sides, every flight', () => {
  const m = modelOf('tower', { platformHeightFt: 24 });
  assert.ok(m.issues.some((i) => i.path === 'access'),
    'the premise: 24 ft is past the ladder threshold and the tool switched to a stair');
  const stringers = m.members.filter((x) => x.role === 'stringer');
  assert.ok(stringers.length >= 9, `${stringers.length} stringers — expected three flights of three`);
  const flights = new Set(stringers.map((s) => `${s.rotation[1].toFixed(6)}|${s.position[1].toFixed(3)}`));
  const rakedTop = m.members.filter((x) => x.role === 'railTop' && raked(x));
  const rakedMid = m.members.filter((x) => x.role === 'railMid' && raked(x));
  assert.equal(rakedTop.length, flights.size * 2,
    `${rakedTop.length} raked top rails for ${flights.size} flights — a flight is railed on BOTH sides`);
  assert.equal(rakedMid.length, rakedTop.length, 'every top rail has a mid rail under it');
  const posts = m.members.filter((x) => x.role === 'railPost' && x.position[1] < 23);
  assert.ok(posts.length >= rakedTop.length, `${posts.length} posts below the platform for ${rakedTop.length} rail runs`);
});

test('and each rail runs its own flight — same pitch, same yaw, same length', () => {
  // A rail on the right line is not the same as a rail at the right angle: the check is against
  // the STRINGER of that flight, because the stringer is the flight.
  const m = modelOf('tower', { platformHeightFt: 24 });
  const stringers = m.members.filter((x) => x.role === 'stringer');
  const rails = m.members.filter((x) => (x.role === 'railTop' || x.role === 'railMid') && raked(x));
  assert.ok(rails.length >= 12, `${rails.length} raked rails — three flights railed both sides is twelve`);
  for (const r of rails) {
    const mate = stringers.find((s) => Math.abs(s.rotation[1] - r.rotation[1]) < 1e-9
      && Math.abs(s.rotation[2] - r.rotation[2]) < 1e-9);
    assert.ok(mate, `${r.id} is raked at ${r.rotation[2].toFixed(4)} on a heading no stringer runs`);
    // The stringer's stock runs a riser further down the rake than the nosing line does — it has
    // to, because its foot is cut level on the ground below the first nose. The rail is the
    // nosing line's own length.
    const riser = (mate!.rotation[2] === 0 ? 0 : Math.tan(mate!.rotation[2]))
      * (Math.max(STAIR.unitRunIn.value as number, STAIR.minTreadIn.value as number) / IN_PER_FT);
    const want = mate!.cutLength / IN_PER_FT - riser * Math.sin(mate!.rotation[2]);
    assert.ok(Math.abs(r.cutLength / IN_PER_FT - want) < 1e-9,
      `${r.id} is ${(r.cutLength / IN_PER_FT).toFixed(4)} ft long against a flight of ${want.toFixed(4)} ft`);
  }
});

test('and it stands the doctrine height above the treads, measured plumb', () => {
  // A stair rail is measured PLUMB from the nosing line, which is why the rails are raked and the
  // posts are not. Checked at the foot of each rail against the tread whose nose is under it —
  // exactly, because both come off the same line.
  const m = modelOf('tower', { platformHeightFt: 24 });
  const treadTops = m.members.filter((x) => x.role === 'tread').map((t) => t.position[1] + t.actual.w / 24);
  assert.ok(treadTops.length > 20);
  const tops = m.members.filter((x) => x.role === 'railTop' && raked(x));
  assert.ok(tops.length > 0);
  for (const r of tops) {
    const low = ends(r).reduce((a, b) => (a[1] < b[1] ? a : b));
    const want = low[1] - topH;
    const near = treadTops.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a));
    assert.ok(Math.abs(near - want) < 1e-9,
      `${r.id}: its foot is ${topH.toFixed(3)} ft above ${want.toFixed(4)}, and the nearest tread top is ${near.toFixed(4)}`);
    // And the mid rail is the doctrine drop below it, on the same line. Matched on HEIGHT as
    // well as plan: a switchback stacks its flights over one another, so flight 1 and flight 3
    // share a plan line exactly and picking by plan alone found a rail 9¾ ft away.
    const mid = m.members.filter((x) => x.role === 'railMid' && raked(x)
      && Math.abs(x.position[0] - r.position[0]) < 1e-9 && Math.abs(x.position[2] - r.position[2]) < 1e-9)
      .sort((a, b) => Math.abs(a.position[1] - r.position[1]) - Math.abs(b.position[1] - r.position[1]))[0];
    assert.ok(mid, `${r.id} has no mid rail on its line`);
    assert.ok(Math.abs((r.position[1] - mid!.position[1]) - (topH - midH)) < 1e-9,
      `${r.id}: the mid rail is ${(r.position[1] - mid!.position[1]).toFixed(4)} ft below it, not ${(topH - midH).toFixed(4)}`);
  }
});

test('THE LANDINGS ARE RAILED TOO — on every side but the way on and the way off', () => {
  const m = modelOf('tower', { platformHeightFt: 24 });
  // Grouped by HEIGHT, not by piece: a landing is decked in planks like any other floor, so the
  // member count is its area and not the number of turns.
  const levels = [...new Set(m.members.filter((x) => x.role === 'deckPlank')
    .map((x) => Math.round((x.position[1] + x.actual.w / 24) * 1e6) / 1e6))];
  assert.equal(levels.length, 2, 'a 24-ft switchback turns twice');
  for (const y of levels) {
    const level = m.members.filter((x) => x.role === 'railTop' && !raked(x)
      && Math.abs(x.position[1] - (y + topH)) < 1e-9);
    // A 180° turn puts both flights on the same side of the landing, so exactly one of its four
    // sides is the way on and off — and the other three are open edges that need a rail.
    assert.equal(level.length, 3,
      `the landing at ${y.toFixed(2)} ft is railed on ${level.length} of its four sides`);
  }
});

test('and a flight that does not reach the fall-protection threshold is left alone', () => {
  // Not a blanket rule: whether an edge needs a rail is `railings.ts`'s decision and it comes
  // from the doctrine height. A hut's entry steps rise 2 ft 5 in to the threshold, which is under
  // it, and three steps with a handrail on them would be this tool inventing a requirement.
  const m = modelOf('gp-frame');
  assert.ok(m.members.some((x) => x.role === 'tread'), 'the premise: it has entry steps');
  const rise = (m.levels.subfloorTop ?? 0) - (m.levels.gradeY ?? 0);
  assert.ok(rise < (RAIL.requiredAboveFt.value as number),
    `the premise: ${rise.toFixed(3)} ft is under the ${RAIL.requiredAboveFt.value} ft threshold`);
  assert.equal(m.members.filter((x) => x.role.startsWith('rail') || x.role === 'toeBoard').length, 0);
});

test('and no two pieces of a railed stair carry the same id', () => {
  // Every `generateRailing` call numbers its pieces from one, so a platform and two landings all
  // produced `RL-railPost-01` until each got its own prefix. The stair generator hit this exact
  // thing with its own flights; an id is what selection and the packet key on.
  for (const [id, over] of [['tower', { platformHeightFt: 24 }], ['platform', {}]] as [string, Record<string, unknown>][]) {
    const seen = new Set<string>();
    for (const k of modelOf(id, over).members) {
      assert.ok(!seen.has(k.id), `${id}: two members carry ${k.id}`);
      seen.add(k.id);
    }
  }
});

test('the railing generator honours a prefix, and defaults to the one it always had', () => {
  const edges = [{ id: 'e', from: [0, 0] as [number, number], to: [8, 0] as [number, number] }];
  const a = generateStair({ base: [0, 0], up: [1, 0], baseY: 0, topY: 12, widthFt: 3, stage: 1, idPrefix: 'ZZ' });
  assert.ok(a.members.some((k) => k.role === 'railTop'), 'a 12-ft climb is railed');
  for (const k of a.members) assert.match(k.id, /^ZZ/, `${k.id} ignored the prefix`);
  void edges;
});

test('A LANDING CARRIES BOTH FLIGHTS — all of both, not the gap between them', () => {
  // `walkPath` turns a switchback in place and steps SIDEWAYS one stair width, so the two flights
  // stand side by side and the pair is two widths across. The landing was a square of ONE width
  // centred between their two centrelines: measured on the 24-ft tower, each 30-in tread met it
  // over exactly 15 in, and half the width of every flight stepped off onto air.
  const m = modelOf('tower', { platformHeightFt: 24 });
  const deck = m.members.filter((x) => x.role === 'deckPlank');
  assert.ok(deck.length > 0, 'the switchback has landings at all');
  const treads = m.members.filter((x) => x.role === 'tread');
  const plan = (k: Member) => {
    const h: V3 = [k.cutLength / 24, k.actual.d / 24, k.actual.w / 24];
    const xs: number[] = [];
    const zs: number[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const r = rotate(k, [sx * h[0], sy * h[1], sz * h[2]]);
      xs.push(k.position[0] + r[0]);
      zs.push(k.position[2] + r[2]);
    }
    return { x: [Math.min(...xs), Math.max(...xs)] as [number, number], z: [Math.min(...zs), Math.max(...zs)] as [number, number] };
  };
  const levels = [...new Set(deck.map((x) => Math.round((x.position[1] + x.actual.w / 24) * 1e6) / 1e6))];
  for (const y of levels) {
    const planks = deck.filter((x) => Math.abs(x.position[1] + x.actual.w / 24 - y) < 1e-9);
    const px = planks.map(plan).flatMap((b) => b.x);
    const pz = planks.map(plan).flatMap((b) => b.z);
    const lx: [number, number] = [Math.min(...px), Math.max(...px)];
    const lz: [number, number] = [Math.min(...pz), Math.max(...pz)];
    // The tread just below the landing is the last step of the flight arriving at it; the tread
    // just above is the first step of the flight leaving. BOTH must be fully over the landing in
    // the across direction — the direction the pair of flights is two widths wide in.
    const below = treads.filter((t) => t.position[1] < y).sort((a, b) => b.position[1] - a.position[1])[0];
    const above = treads.filter((t) => t.position[1] > y).sort((a, b) => a.position[1] - b.position[1])[0];
    for (const t of [below, above]) {
      assert.ok(t, `no flight meets the landing at ${y}`);
      const b = plan(t!);
      const wide = b.x[1] - b.x[0] > b.z[1] - b.z[0];
      const [t0, t1] = wide ? b.x : b.z;
      const [g0, g1] = wide ? lx : lz;
      const over = Math.min(t1, g1) - Math.max(t0, g0);
      assert.ok(Math.abs(over - (t1 - t0)) < 1e-9,
        `landing at ${y.toFixed(2)} ft: ${t!.id} is ${((t1 - t0) * IN_PER_FT).toFixed(1)} in wide and only `
        + `${(over * IN_PER_FT).toFixed(1)} in of it is over the landing`);
    }
    // And it is deep enough to turn on: a landing shorter than the stair is wide is not one.
    const deep = Math.min(lx[1] - lx[0], lz[1] - lz[0]);
    assert.ok(deep >= (treads[0]!.cutLength / IN_PER_FT) - 1e-9,
      `landing at ${y.toFixed(2)} ft is ${deep.toFixed(2)} ft deep against a ${(treads[0]!.cutLength / IN_PER_FT).toFixed(2)} ft stair width`);
  }
});

test('and it is decked in boards that exist', () => {
  // The landing used to be ONE piece of `2x10` with a face width of 30 in written onto it — a
  // board nobody can cut, on a list somebody has to fill. It is a floor; it gets floor boards.
  const m = modelOf('tower', { platformHeightFt: 24 });
  for (const k of m.members.filter((x) => x.role === 'deckPlank')) {
    const stock = DRESSED[k.nominal];
    assert.ok(stock, `${k.id} is a ${k.nominal}, which is not stock`);
    assert.ok(k.actual.d <= stock!.d + 1e-9,
      `${k.id} claims a ${k.actual.d.toFixed(2)} in face on a ${k.nominal}, which is ${stock!.d} in`);
    assert.ok(Math.abs(k.actual.w - stock!.w) < 1e-9, `${k.id} is not ${k.nominal} thick`);
  }
});
