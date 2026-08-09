// What a roof does at the top of its slope, when there is nothing on the other side.
//
// A RIDGE IS WHERE TWO SLOPES MEET. `generateRidgeCaps` capped every plane's top edge on the
// stated grounds that "a plane's TOP edge is a ridge" — true of a gable, where the other plane
// comes up to the same line, and false of a SHED or a FLAT roof, which is one plane whose top
// edge is the eave over the high wall. Capped anyway, the 12-in cap laid on that line put half
// its width out past the roof's own edge:
//
//   storage shed, flat roof:  cap z 12.500..13.500   roofing ends z 12.978
//
// so six inches of a twenty-foot piece hung in the air with nothing under it, the length of the
// building. The same edge had the opposite problem below it: the fascia is emitted once per
// plane at v = 0, so the one edge that had a cap it should not have also lacked the board it
// should — a row of raw square-cut rafter tails overhanging the pony wall by a foot, which is
// exactly the defect the fascia was added to fix at the other three edges.
//
// Both are asserted here as PHYSICAL claims rather than counts: a cap has roofing under all of
// it, and a roof edge is either continued by another slope or closed with a board.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
interface Box { x: [number, number]; y: [number, number]; z: [number, number] }

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
function rotate(m: Pick<Member, 'rotation'>, v: V3): V3 {
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

const halfExtents = (m: Member): V3 => [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];

function box(m: Member): Box {
  const h = halfExtents(m);
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

/** Is world point `p` inside the member's ORIENTED box? A raked piece's AABB is not the piece. */
function inside(m: Member, p: V3, pad = 0): boolean {
  const d: V3 = [p[0] - m.position[0], p[1] - m.position[1], p[2] - m.position[2]];
  const h = halfExtents(m);
  const axes: V3[] = [rotate(m, [1, 0, 0]), rotate(m, [0, 1, 0]), rotate(m, [0, 0, 1])];
  return axes.every((a, i) => Math.abs(d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) <= h[i]! + pad);
}

const ROOFS: { kind: string; roof: Record<string, unknown> }[] = [
  { kind: 'gable', roof: { kind: 'gable', risePer12: 4, overhangFt: 1 } },
  { kind: 'hip', roof: { kind: 'hip', risePer12: 4, overhangFt: 1 } },
  { kind: 'pyramid', roof: { kind: 'pyramid', risePer12: 6, overhangFt: 1 } },
  { kind: 'shed', roof: { kind: 'shed', risePer12: 4, overhangFt: 1, highSide: 'N' } },
  { kind: 'flat', roof: { kind: 'flat', overhangFt: 1, drainPer12: 1 } },
];

function roofed(roof: Record<string, unknown>, roofing = 'corrugated') {
  const spec = JSON.parse(JSON.stringify(familyById('storage-shed')!.preset));
  spec.roof = roof;
  spec.coverings.roofing = roofing;
  return generateStructure(spec);
}

test('A CAP IS NAILED ON BOTH SIDES OF ITS JOINT — one side used to be in the air', () => {
  // Not "roofing under every point of it": over the joint itself there is deliberately none, and
  // that is what the cap is for — each course is offset perpendicular from its plane and cut at
  // `slopeLengthFt`, so its top edge pulls back from the ridge and the two slopes' sheets stop
  // short of the line. The claim is the one the cap's own fastener note makes: BOTH SIDES. On a
  // shed or flat roof there is no other side — the top edge is the eave over the high wall — so
  // one half of a 12-in cap lay on the roofing and the other hung past the edge of it.
  for (const { kind, roof } of ROOFS) {
    const model = roofed(roof);
    const caps = model.members.filter((m) => m.role === 'ridgeCap');
    const cover = model.members.filter((m) => m.role === 'roofingCourse');
    assert.ok(cover.length > 0, `${kind}: nothing is roofed`);
    for (const cap of caps) {
      const h = halfExtents(cap);
      const held = (p: V3): boolean => {
        for (let d = 0; d <= 1.2; d += 0.01) {
          if (cover.some((c) => inside(c, [p[0], p[1] - d, p[2]], 1e-4))) return true;
        }
        return false;
      };
      // Along the cap at cell centres — a cap ends exactly on the roofing's own rake, and a
      // sample sitting on that shared edge is a coin toss.
      for (let i = 0; i < 12; i++) {
        const u = -h[0] + 2 * h[0] * (i + 0.5) / 12;
        for (const side of [-1, 1]) {
          const r = rotate(cap, [u, side * h[1] * 0.9, 0]);
          const p: V3 = [cap.position[0] + r[0], cap.position[1] + r[1], cap.position[2] + r[2]];
          assert.ok(held(p), `${kind}: ${cap.id} has nothing under its `
            + `${side < 0 ? 'first' : 'second'} edge at ${p.map((v) => v.toFixed(3)).join(', ')} — `
            + 'that side of the cap is over the edge of the roof, not on it');
        }
      }
    }
  }
});

test('and a roof EDGE is either continued by another slope or closed with a fascia', () => {
  // The general claim the missing board breaks. Every rafter ends somewhere; at a ridge or a hip
  // the roof carries on past it in another plane, and everywhere else the end is exposed and
  // wants a board over it. A shed's high edge is neither continued nor closed.
  for (const { kind, roof } of ROOFS) {
    const model = roofed(roof);
    const rafters = model.members.filter((m) => m.role === 'rafter' || m.role === 'hipRafter'
      || m.role === 'jackRafter');
    const fascia = model.members.filter((m) => m.role === 'fascia');
    assert.ok(rafters.length > 4, `${kind}: ${rafters.length} rafters`);
    assert.ok(fascia.length > 0, `${kind}: no fascia at all`);
    for (const r of rafters) {
      const ax = rotate(r, [1, 0, 0]);
      const half = r.cutLength / 24;
      for (const s of [-1, 1]) {
        const end: V3 = [r.position[0] + ax[0] * s * half, r.position[1] + ax[1] * s * half,
          r.position[2] + ax[2] * s * half];
        // Closed: a fascia across the end, within its own thickness of it.
        if (fascia.some((f) => inside(f, end, 0.12))) continue;
        // Or continued: another rafter running a DIFFERENT way finishes at the same place, which
        // is what a ridge and a hip are.
        const cont = rafters.some((o) => {
          if (o.id === r.id) return false;
          const oa = rotate(o, [1, 0, 0]);
          if (Math.abs(oa[0] * ax[0] + oa[1] * ax[1] + oa[2] * ax[2]) > 0.999) return false;
          const oh = o.cutLength / 24;
          return [-1, 1].some((t) => Math.hypot(
            o.position[0] + oa[0] * t * oh - end[0],
            o.position[1] + oa[1] * t * oh - end[1],
            o.position[2] + oa[2] * t * oh - end[2]) < 1.0);
        });
        assert.ok(cont, `${kind}: ${r.id} ends at ${end.map((v) => v.toFixed(3)).join(', ')} with no `
          + 'fascia over it and no other slope carrying on past it — a row of bare rafter tails');
      }
    }
  }
});

test('a roof with ONE slope has no ridge, and a gable, hip and pyramid still have theirs', () => {
  // The consequence in the simplest terms, and the guard that the fix did not take the caps off
  // the roofs that need them. Stated as a comparison between roof kinds rather than as counts,
  // because the count is the generator's business and "which roofs have a ridge" is not.
  const capsOn = (kind: string): number =>
    roofed(ROOFS.find((r) => r.kind === kind)!.roof).members.filter((m) => m.role === 'ridgeCap').length;
  for (const kind of ['shed', 'flat']) {
    assert.equal(capsOn(kind), 0, `${kind}: a single-slope roof has no ridge to cap`);
  }
  for (const kind of ['gable', 'hip', 'pyramid']) {
    assert.ok(capsOn(kind) > 0, `${kind}: lost the caps over the joints between its slopes`);
  }
  // And the low eave never lost its own board either.
  for (const { kind, roof } of ROOFS) {
    const model = roofed(roof);
    const fascia = model.members.filter((m) => m.role === 'fascia').map((m) => box(m));
    const rafters = model.members.filter((m) => m.role === 'rafter').map((m) => box(m));
    const lowest = Math.min(...rafters.map((b) => b.y[0]));
    assert.ok(fascia.some((f) => f.y[0] <= lowest + 0.2),
      `${kind}: no fascia down at the low eave, where the rafters bottom out at ${lowest.toFixed(3)}`);
  }
});
