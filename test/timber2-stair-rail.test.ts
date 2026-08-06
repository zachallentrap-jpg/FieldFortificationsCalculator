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
  const landings = m.members.filter((x) => x.role === 'deckPlank');
  assert.equal(landings.length, 2, 'a 24-ft switchback turns twice');
  for (const l of landings) {
    const y = l.position[1] + l.actual.w / 24;
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
