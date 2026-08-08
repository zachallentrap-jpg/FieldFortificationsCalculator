// The guard tower's cab, against the frame it is nailed to.
//
// The cab is the one wall in the toolkit that does NOT go through `generateWallCovering`. Every
// other wall gets its cladding placed by `wallTilePlacement`, which starts from the surface's
// own `faceOffsetFt` and pushes the panel out by the standoff plus half its thickness — so the
// panel's INNER face lands on the wall's outer face and the framing ends up behind it, which is
// where framing goes. The cab is hand-rolled in `tower.ts` and started from nothing: it centred
// each panel on the corner LINE, which is the corner posts' own centreline.
//
// These tests pin the two things that follow from "cladding goes on the outside of a frame",
// measured against the posts as the model actually emits them rather than against a constant:
// the panels do not occupy the posts, and they do not float off them either.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];
type Box = { x: [number, number]; y: [number, number]; z: [number, number] };

/** Rotate a local vector by a member's YXZ euler (R = Ry·Rx·Rz), the scene's convention. */
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
  x = a; z = b;
  return [x, y, z];
}

/**
 * World box of a member. Every piece here is yawed by a multiple of a right angle, so the
 * axis-aligned box IS the piece and nothing is being over-claimed by using one — which is not
 * true of a raked member and is the reason this helper is not exported.
 */
function box(m: Member): Box {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const overlap = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
const TOL = 1e-9;

function cab(over: Record<string, unknown> = {}) {
  const spec = JSON.parse(JSON.stringify(familyById('tower')!.preset));
  Object.assign(spec, over);
  const model = generateStructure(spec);
  // The cab's own stage, found from the CLADDING rather than from the posts. It used to be "the
  // last stage a 4x4 post appears in, which is the only place 4x4 posts and cladding share a
  // stage" — true until a shed cab grew the two 4x4 posts that carry its high side, which are
  // roof framing and land in a later stage with no cladding in it at all. What this file is
  // about is cladding against the posts it hangs on, so the cladding is what picks the stage.
  const clad = model.members.filter((m) => m.role === 'siding' || m.role === 'screenPanel');
  const stage = clad.length > 0
    ? Math.max(...clad.map((m) => m.stage))
    : Math.max(...model.members.filter((m) => m.role === 'post' && m.nominal === '4x4').map((m) => m.stage));
  return {
    spec,
    posts: model.members.filter((m) => m.role === 'post' && m.nominal === '4x4' && m.stage === stage),
    skin: model.members.filter((m) => (m.role === 'siding' || m.role === 'screenPanel') && m.stage === stage),
  };
}

test('THE CAB\'S CLADDING IS OUTSIDE ITS CORNER POSTS, not buried in them', () => {
  // Measured on the shipped preset before the fix: every panel was centred on the corner line,
  // so each of the eight (panel, post) pairs shared 1¾ in × 3½ ft × ½ in — 36.8 cubic inches of
  // one solid inside another — and the four posts stood proud of their own wall by 1½ in on
  // every elevation.
  const { posts, skin } = cab();
  assert.equal(posts.length, 4, 'four corner posts carry the cab roof');
  assert.ok(skin.length >= 4, 'the preset cab is clad');
  for (const s of skin) {
    const a = box(s);
    for (const p of posts) {
      const b = box(p);
      const dx = overlap(a.x, b.x), dy = overlap(a.y, b.y), dz = overlap(a.z, b.z);
      if (dx <= TOL || dy <= TOL || dz <= TOL) continue;
      assert.fail(
        `${s.id} runs into ${p.id}: ${(dx * IN_PER_FT).toFixed(2)} x ${(dy * IN_PER_FT).toFixed(2)} `
        + `x ${(dz * IN_PER_FT).toFixed(2)} in of overlap`);
    }
  }
});

test('and it is nailed to them — the panels touch the posts, they do not float off', () => {
  // The other way to have no overlap is to hold the skin off the frame, which would be just as
  // wrong and would look almost the same from outside. Each panel must LAND on the post plane:
  // its inner face exactly on the posts' outer face, no gap and no bite.
  const { posts, skin } = cab();
  const postX = posts.flatMap((p) => box(p).x);
  const postZ = posts.flatMap((p) => box(p).z);
  const frame = { xMin: Math.min(...postX), xMax: Math.max(...postX), zMin: Math.min(...postZ), zMax: Math.max(...postZ) };
  for (const s of skin) {
    const a = box(s);
    // A cab panel is thin in exactly one plan axis; that axis says which wall it is.
    const thinX = a.x[1] - a.x[0] < a.z[1] - a.z[0];
    const [inner, want] = thinX
      ? (a.x[0] < (frame.xMin + frame.xMax) / 2 ? [a.x[1], frame.xMin] : [a.x[0], frame.xMax])
      : (a.z[0] < (frame.zMin + frame.zMax) / 2 ? [a.z[1], frame.zMin] : [a.z[0], frame.zMax]);
    assert.ok(Math.abs(inner - want) < TOL,
      `${s.id} sits ${((inner - want) * IN_PER_FT).toFixed(3)} in off the post face it is nailed to`);
  }
});

test('the four panels close the box: they meet at every corner and lap nowhere', () => {
  // Four panels each spanning corner to corner meet in an L and leave the post's arris showing.
  // The fix runs the two z-walls past the corners and butts the x-walls into them, which is the
  // ordinary sheathing lap — so the corner is covered AND no two panels occupy the same wood.
  const { posts, skin } = cab();
  for (let i = 0; i < skin.length; i++) {
    for (let j = i + 1; j < skin.length; j++) {
      const a = box(skin[i]!), b = box(skin[j]!);
      const dx = overlap(a.x, b.x), dy = overlap(a.y, b.y), dz = overlap(a.z, b.z);
      assert.ok(dx <= TOL || dy <= TOL || dz <= TOL,
        `${skin[i]!.id} and ${skin[j]!.id} overlap by ${(dx * IN_PER_FT).toFixed(2)} x `
        + `${(dy * IN_PER_FT).toFixed(2)} x ${(dz * IN_PER_FT).toFixed(2)} in`);
    }
  }
  // Corner coverage: at each of the four post corners, some panel at that height covers the
  // outermost point of the frame. Checked per band (siding, screen) so a covered half-wall
  // cannot vouch for an open screen band.
  const postX = posts.flatMap((p) => box(p).x);
  const postZ = posts.flatMap((p) => box(p).z);
  const fx: [number, number] = [Math.min(...postX), Math.max(...postX)];
  const fz: [number, number] = [Math.min(...postZ), Math.max(...postZ)];
  for (const role of new Set(skin.map((m) => m.role))) {
    const band = skin.filter((m) => m.role === role);
    for (const x of fx) for (const z of fz) {
      const covers = band.some((m) => {
        const a = box(m);
        return a.x[0]! - TOL <= x && x <= a.x[1]! + TOL && a.z[0]! - TOL <= z && z <= a.z[1]! + TOL;
      });
      assert.ok(covers, `no ${role} covers the cab corner at (${x.toFixed(4)}, ${z.toFixed(4)})`);
    }
  }
});

test('a screened cab has both bands, stacked with no gap and no overlap', () => {
  // The screen band is thinner than the siding, so both cannot sit on one offset. What they DO
  // share is the plane they are fastened to; their heights simply meet.
  const { skin } = cab();
  const siding = skin.filter((m) => m.role === 'siding');
  const screen = skin.filter((m) => m.role === 'screenPanel');
  assert.equal(siding.length, 4);
  assert.equal(screen.length, 4, 'the shipped cab is half-wall-screen');
  const top = Math.max(...siding.map((m) => box(m).y[1]!));
  const bot = Math.min(...screen.map((m) => box(m).y[0]!));
  assert.ok(Math.abs(top - bot) < TOL, `the bands are ${((bot - top) * IN_PER_FT).toFixed(3)} in apart`);
  assert.ok(box(screen[0]!).x[1]! - box(screen[0]!).x[0]! > 0, 'the screen has extent');
});

test('an open-rail cab is clad by nothing at all', () => {
  const { skin } = cab({ cab: { walls: 'open-rail', roof: 'pyramid', roofing: 'corrugated' } });
  assert.equal(skin.length, 0, 'open-rail means no cab walls');
});

test('an unscreened half-wall cab is clad the same way, on a shed roof', () => {
  // `half-wall` runs the same placement with no screen band above it, and a shed cab is a
  // different roof over the same box. The frame relationship must not depend on either.
  const { posts, skin } = cab({ cab: { walls: 'half-wall', roof: 'shed', roofing: 'roll' } });
  assert.equal(skin.length, 4, 'four siding panels and no screen');
  assert.ok(skin.every((m) => m.role === 'siding'), 'half-wall carries no screen band');
  for (const s of skin) {
    const a = box(s);
    for (const p of posts) {
      const b = box(p);
      const dx = overlap(a.x, b.x), dy = overlap(a.y, b.y), dz = overlap(a.z, b.z);
      assert.ok(dx <= TOL || dy <= TOL || dz <= TOL, `${s.id} runs into ${p.id}`);
    }
  }
});
