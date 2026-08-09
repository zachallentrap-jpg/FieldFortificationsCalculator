// The attic hatch, and the two ceiling joists it deleted.
//
// `atticAccess` is wired end to end — the card offers it as "Attic hatch", `BuildingSpec` carries
// it, and `roof.ts` frames the opening the way the floor frames a stairwell: doubled trimmers,
// doubled headers, tail joists to the headers. Nobody had ever LOOKED at it.
//
// THE ABSORBED-BY-TRIMMERS TEST USED HALF THE JOIST SPACING WHERE IT SHOULD HAVE USED THE WIDTH OF
// THE WOOD. `Math.abs(x - edge) < oc / 2` is eight inches on a 16-in layout, so every ceiling joist
// within eight inches of an opening edge was deleted — and nothing took its place, because the
// trimmers stay on the opening line, they do not move out to the joist line. On the shipped custom
// card that was two joists of fourteen:
//
//   x = 8.125  outside the opening, 7½ in from its edge, 5¼ in clear of the trimmer — deleted
//   x = 10.792 INSIDE the opening, where it should have been cut into a pair of tails — deleted
//
// leaving 21¼ and 22¼-in bays in a ceiling laid out at 16 in on centre, one of them straight
// across the hatch. A trimmer 5¼ in away has not absorbed anything; it is a separate member.
//
// This is a COMPAT-LOCK EVENT. `roof.ts` is frozen legacy and the goldens pinned the missing wood:
// one of thirteen curated fixtures moves (`demo-braced-attic`, 325 → 328 members, three ADDED and
// none removed or moved) and 36 of the 72 matrix rows, which are exactly the rows with the hatch
// on. Every fixture without it is byte-identical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { IN_PER_FT } from '../src/timber/doctrine';
import type { Member } from '../src/timber/types';

type V3 = [number, number, number];

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

function box(m: Member): { x: [number, number]; y: [number, number]; z: [number, number] } {
  const h: V3 = [m.cutLength / 24, m.actual.d / 24, m.actual.w / 24];
  const pts: V3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = rotate(m, [sx * h[0], sy * h[1], sz * h[2]]);
    pts.push([m.position[0] + r[0], m.position[1] + r[1], m.position[2] + r[2]]);
  }
  const g = (i: number): [number, number] => [Math.min(...pts.map((p) => p[i]!)), Math.max(...pts.map((p) => p[i]!))];
  return { x: g(0), y: g(1), z: g(2) };
}

const CEILING = ['joist', 'tailJoist', 'trimmerJoist', 'headerJoist'];

function hatched(dims?: { lengthFt: number; widthFt: number }) {
  const spec = JSON.parse(JSON.stringify(familyById('custom')!.preset));
  spec.atticAccess = true;
  if (dims) spec.dims = dims;
  const model = generateStructure(spec);
  const plateTop = Math.max(...model.members.filter((m) => m.role === 'capPlate').map((m) => box(m).y[1]));
  const ceiling = model.members.filter((m) => CEILING.includes(m.role) && box(m).y[0] >= plateTop - 1e-9)
    .map((m) => ({ m, b: box(m) }));
  const trimmers = ceiling.filter((k) => k.m.role === 'trimmerJoist');
  const headers = ceiling.filter((k) => k.m.role === 'headerJoist');
  return {
    model,
    ceiling,
    trimmers,
    headers,
    dims: (model.spec as unknown as { dims: { lengthFt: number; widthFt: number } }).dims,
  };
}

test('NO BAY IN THE CEILING IS WIDER THAN THE LAYOUT — two joists used to vanish at the hatch', () => {
  // The visible claim, and the one the deleted joists break. Sampled ACROSS the ceiling at a
  // station clear of the opening, where every joist, tail and trimmer is present: the widest gap
  // between one piece and the next is a bay, and a bay is the spacing less the wood.
  for (const dims of [undefined, { lengthFt: 24, widthFt: 16 }, { lengthFt: 32, widthFt: 20 }]) {
    const { ceiling, headers, dims: d } = hatched(dims);
    const label = `${d.lengthFt}x${d.widthFt}`;
    assert.ok(headers.length === 4, `${label}: ${headers.length} header joists — the hatch is not framed`);
    // Outside the opening in z, so the tails count.
    const z = Math.min(...headers.map((k) => k.b.z[0])) / 2;
    const at = ceiling.filter((k) => k.b.z[0] - 1e-9 <= z && z <= k.b.z[1] + 1e-9 && k.m.role !== 'headerJoist')
      .map((k) => k.b.x).sort((a, b) => a[0] - b[0]);
    assert.ok(at.length > 4, `${label}: ${at.length} ceiling members at z=${z.toFixed(3)}`);
    // The bound is the SPACING, not the spacing less the wood. A trimmer stands on the opening
    // edge, which does not land on the layout, so the bay from a trimmer to the next joist can
    // legitimately run out to a shade under a full 16 in — 15¾ on a 24-ft ceiling. What it cannot
    // do is exceed it, and a deleted joist made bays of 19¾ and 21½.
    const spacing = 16 / IN_PER_FT;
    let worst = { gap: 0, at: 0 };
    for (let i = 0; i + 1 < at.length; i++) {
      const gap = at[i + 1]![0] - at[i]![1];
      if (gap > worst.gap) worst = { gap, at: at[i]![1] };
    }
    assert.ok(worst.gap <= spacing + 1e-9,
      `${label}: a ${(worst.gap * IN_PER_FT).toFixed(2)} in bay at x=${worst.at.toFixed(3)} in a ceiling `
      + `laid out at ${(spacing * IN_PER_FT).toFixed(0)} in on centre — a joist is missing there`);
  }
});

test('and every joist line inside the hatch is CUT INTO TAILS, not deleted', () => {
  // The half of the defect that mattered most: one of the two lost joists was inside the opening,
  // where the framing pattern says it becomes a pair of tail joists running to the headers. The
  // legacy test asked for `tails.length >= 2`, which a scuttle that has lost half of them passes.
  for (const dims of [undefined, { lengthFt: 24, widthFt: 16 }, { lengthFt: 32, widthFt: 20 }]) {
    const { ceiling, trimmers, headers, dims: d } = hatched(dims);
    const label = `${d.lengthFt}x${d.widthFt}`;
    const holeX: [number, number] = [
      Math.max(...trimmers.filter((k) => k.b.x[1] < d.lengthFt / 2).map((k) => k.b.x[1])),
      Math.min(...trimmers.filter((k) => k.b.x[0] > d.lengthFt / 2).map((k) => k.b.x[0])),
    ];
    const holeZ: [number, number] = [
      Math.max(...headers.filter((k) => k.b.z[1] < d.widthFt / 2).map((k) => k.b.z[1])),
      Math.min(...headers.filter((k) => k.b.z[0] > d.widthFt / 2).map((k) => k.b.z[0])),
    ];
    // The layout the ceiling is on, read off the joists that are NOT at the hatch.
    const lines = [...new Set(ceiling.filter((k) => k.m.role === 'joist')
      .map((k) => Math.round(((k.b.x[0] + k.b.x[1]) / 2) * 1e6) / 1e6))].sort((a, b) => a - b);
    assert.ok(lines.length >= 4, `${label}: ${lines.length} plain ceiling joists`);
    const spacing = lines[1]! - lines[0]!;
    // Every station on that layout that falls strictly inside the opening must be a pair of tails.
    const tails = ceiling.filter((k) => k.m.role === 'tailJoist');
    for (let i = 0; lines[0]! + i * spacing < d.lengthFt; i++) {
      // Multiplied, not accumulated: adding a 16-in step thirteen times drifts past any tolerance
      // tight enough to tell one joist line from the next.
      const x = lines[0]! + i * spacing;
      if (!(x > holeX[0] + 1e-9 && x < holeX[1] - 1e-9)) continue;
      // ABSORBED IS ALLOWED, AND ONLY THIS IS ABSORBED: a station whose joist would land IN the
      // doubled trimmer really is replaced by it. On a 24-ft ceiling the hatch edge falls half an
      // inch off a joist line and that one is genuinely absorbed; on the 20-ft one the nearest is
      // 5¼ in clear of the trimmer, which is a separate member and was deleted anyway.
      const jw = 1.5 / IN_PER_FT / 2;
      if (trimmers.some((k) => k.b.x[0] < x + jw - 1e-9 && k.b.x[1] > x - jw + 1e-9)) continue;
      const mine = tails.filter((k) => Math.abs((k.b.x[0] + k.b.x[1]) / 2 - x) < 1e-4);
      assert.equal(mine.length, 2,
        `${label}: the ceiling-joist line at x=${x.toFixed(4)} runs through the hatch and has `
        + `${mine.length} tail joists, not the pair the framing pattern gives it`);
      // And they run to the headers, not past them or short of them.
      const ends = mine.map((k) => k.b.z).sort((a, b) => a[0] - b[0]);
      assert.ok(Math.abs(ends[0]![0]) < 1e-9 && Math.abs(ends[1]![1] - d.widthFt) < 1e-9,
        `${label}: the tails at x=${x.toFixed(4)} run ${ends[0]![0].toFixed(3)}..${ends[0]![1].toFixed(3)} and `
        + `${ends[1]![0].toFixed(3)}..${ends[1]![1].toFixed(3)} across a ${d.widthFt}-ft ceiling`);
      assert.ok(ends[0]![1] <= holeZ[0] + 1e-9 && ends[1]![0] >= holeZ[1] - 1e-9,
        `${label}: a tail at x=${x.toFixed(4)} runs into the opening it stops at`);
    }
    assert.ok(tails.length >= 2, `${label}: no tails at all — is the hatch on a joist line?`);
  }
});

test('and nothing in the ceiling shares wood with anything else in it', () => {
  // The guard on the fix: restoring a deleted joist is only right if it fits. The one at 8.125
  // clears the trimmer pair by 5¼ in and the one at 10.792 by 5¼ in the other way, which is why
  // "absorbed" was the wrong word for either of them.
  const ov = (a: [number, number], b: [number, number]): number => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  for (const dims of [undefined, { lengthFt: 24, widthFt: 16 }, { lengthFt: 32, widthFt: 20 }]) {
    const { ceiling, dims: d } = hatched(dims);
    for (let i = 0; i < ceiling.length; i++) {
      for (let j = i + 1; j < ceiling.length; j++) {
        const a = ceiling[i]!, b = ceiling[j]!;
        const s: V3 = [ov(a.b.x, b.b.x), ov(a.b.y, b.b.y), ov(a.b.z, b.b.z)];
        assert.ok(!s.every((v) => v > 1e-9),
          `${d.lengthFt}x${d.widthFt}: ${a.m.id} and ${b.m.id} share `
          + `${s.map((v) => (v * IN_PER_FT).toFixed(3)).join(' x ')} in of wood`);
      }
    }
  }
});
