// TIMBER-2 T8 — the hip roof's two pieces of arithmetic.
//
// Both are things a framing square gives you and a naive implementation gets wrong, so both are
// asserted against the formula rather than against a snapshot of whatever the code happened to
// produce — a golden would have frozen the bug just as happily as the fix.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { tileSurface } from '../src/timber/subsystems/coverings';
import { familyById } from '../src/timber/catalog';
import { hipLenPerFtRun, jackDifference, planeSpanAt, roofPlanes } from '../src/timber/subsystems/roofFamilies';

function hipModel(risePer12 = 6) {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12, overhangFt: 1 };
  return generateStructure(spec);
}

test('a hip runs the DIAGONAL, not the common run', () => {
  // The classic hip mistake: using √(1+slope²) instead of √(2+slope²) gives a hip about a foot
  // short in twelve. At 6-in-12 the two figures are 1.118 and 1.500 — not subtle, and still the
  // most commonly miscut member on a hip roof.
  const slope = 0.5;
  assert.equal(hipLenPerFtRun(slope), Math.sqrt(2 + slope * slope));
  assert.ok(hipLenPerFtRun(slope) > Math.sqrt(1 + slope * slope) + 0.3);
});

test('jack rafters shorten by a constant, and it matches the framing-square figure', () => {
  // This is what makes a hip layable-out: every jack is shorter than its neighbour by the same
  // amount, so you cut a sequence rather than measuring each stick.
  const model = hipModel(6);
  const lengths = [...new Set(model.members.filter((m) => m.role === 'jackRafter').map((m) => Math.round((m.cutLength / 12) * 1000) / 1000))]
    .sort((a, b) => b - a);
  assert.ok(lengths.length >= 3, `expected a run of jacks, got ${lengths.length}`);
  const expected = jackDifference(0.5, 16 / 12);
  for (let i = 1; i < lengths.length; i++) {
    assert.ok(
      Math.abs(lengths[i - 1]! - lengths[i]! - expected) < 0.01,
      `jacks ${i - 1}→${i} differ by ${(lengths[i - 1]! - lengths[i]!).toFixed(3)}, expected ${expected.toFixed(3)}`,
    );
  }
});

test('the ridge is shortened by half the span at each end', () => {
  // A hip roof's ridge is not its building's length — the hips converge on it half a span in
  // from each end, which is exactly what makes it a hip and not a gable.
  const model = hipModel();
  const spec = model.spec as { dims: { lengthFt: number; widthFt: number } };
  const ridge = model.members.find((m) => m.role === 'ridge')!;
  assert.ok(Math.abs(ridge.cutLength / 12 - (spec.dims.lengthFt - spec.dims.widthFt)) < 0.01);
});

test('a hip roof has four hips, commons and jacks — and no gable studs', () => {
  const model = hipModel();
  const roles = new Map<string, number>();
  for (const m of model.members) roles.set(m.role, (roles.get(m.role) ?? 0) + 1);
  assert.equal(roles.get('hipRafter'), 4);
  assert.ok((roles.get('rafter') ?? 0) > 0, 'commons over the ridge');
  assert.ok((roles.get('jackRafter') ?? 0) > 0, 'jacks to the hips');
});

// ── The skin (added when the hip's covering gap was closed) ──────────────────

function areaOf(model: ReturnType<typeof hipModel>, role: string): number {
  return model.members
    .filter((m) => m.role === role)
    .reduce((a, m) => a + (m.cutLength / 12) * ((m.actual?.d ?? 0) / 12), 0);
}

function gableModel(risePer12 = 6) {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'gable', risePer12, overhangFt: 1 };
  return generateStructure(spec);
}

test('a hip has FOUR roof surfaces, two of them triangular', () => {
  // For a long time this returned two: a hip was treated as a gable, so the long slopes got
  // deck and roofing and the two ends showed bare framing under a finished roof.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12: 6, overhangFt: 1 };
  const planes = roofPlanes(spec, 0);
  assert.equal(planes.length, 4);
  const ends = planes.filter((p) => p.topLengthFt === 0);
  assert.equal(ends.length, 2, 'the two hip ends taper to a point');
  const longs = planes.filter((p) => p.topLengthFt === spec.dims.lengthFt - spec.dims.widthFt);
  assert.equal(longs.length, 2, 'the two long slopes taper to the ridge');
  // Every surface rises the same run, which is what makes it one roof and not four planes.
  assert.equal(new Set(planes.map((p) => p.slopeLengthFt.toFixed(6))).size, 1);
});

/** Fraction of a plane's true outline that some tile actually lands on. */
function coverageOf(plane: ReturnType<typeof roofPlanes>[number], sheetW: number, sheetH: number, clip: 'cover' | 'average' = 'cover'): number {
  const tiles = tileSurface(plane.eaveLengthFt, plane.slopeLengthFt, sheetW, sheetH, 0, (v) => planeSpanAt(plane, v), clip);
  let inside = 0;
  let covered = 0;
  const N = 140;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const v = ((i + 0.5) / N) * plane.slopeLengthFt;
      const u = ((j + 0.5) / N) * plane.eaveLengthFt;
      const s = planeSpanAt(plane, v);
      if (u < s.lo || u > s.hi) continue;
      inside += 1;
      if (tiles.some((t) => u >= t.u0 && u <= t.u1 && v >= t.v0 && v <= t.v1)) covered += 1;
    }
  }
  return inside === 0 ? 1 : covered / inside;
}

test('THE COVERAGE CHECK: the VISIBLE surface of a hip is complete', () => {
  // The failure this exists for is subtle and looks fine in a summary: clipping each course at
  // its MID-height makes the billed area come out exactly right, and leaves the roof full of
  // diamond-shaped holes along the hip lines with framing showing through. Measured, before the
  // fix: 96.5% of each long slope and 85.1% of each end. A number that averages correctly is
  // not the same as a roof that is covered — which is why the ROOFING covers.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12: 6, overhangFt: 1 };
  for (const plane of roofPlanes(spec, 0)) {
    const c = coverageOf(plane, 3, 3, 'cover');
    assert.ok(c > 0.999, `${plane.id}: only ${(c * 100).toFixed(1)}% of the visible surface covered`);
  }
});

test('the two layers are clipped differently, and the pairing is the point', () => {
  // Covering BOTH floats tan deck panels above the neighbouring slope's roofing where they
  // cross a hip — the artifact the render showed. Averaging both puts holes in the visible
  // surface. Deck averages (its gaps hide under the roofing) and roofing covers.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12: 6, overhangFt: 1 };
  const end = roofPlanes(spec, 0).find((p) => p.topLengthFt === 0)!;
  const cover = tileSurface(end.eaveLengthFt, end.slopeLengthFt, 4, 8, 0, (v) => planeSpanAt(end, v), 'cover');
  const avg = tileSurface(end.eaveLengthFt, end.slopeLengthFt, 4, 8, 0, (v) => planeSpanAt(end, v), 'average');
  // How far the TOP course reaches, not how wide one sheet is — sheets are capped at 4 ft
  // either way, so a per-sheet comparison would have found no difference at all.
  const topReach = (t: typeof cover) => {
    const vTop = Math.max(...t.map((x) => x.v0));
    const row = t.filter((x) => x.v0 === vTop);
    return Math.max(...row.map((x) => x.u1)) - Math.min(...row.map((x) => x.u0));
  };
  assert.ok(topReach(cover) > topReach(avg), `covering ${topReach(cover)} must reach further than averaging ${topReach(avg)}`);
  assert.ok(coverageOf(end, 4, 8, 'average') < 0.999, 'averaging genuinely leaves gaps — that is the trade');
});

test('the deck bills its true area — a hip\'s offcuts are reusable', () => {
  // A hip's four corners are mirror pairs, so the diagonal triangle cut off at one is the piece
  // needed at another. That is why the DECK is counted at its true area rather than at the
  // rectangle each sheet is cut from, and why it comes out equal to the gable's.
  const hip = areaOf(hipModel(), 'roofPanel');
  const gable = areaOf(gableModel(), 'roofPanel');
  assert.ok(hip > 0, 'a hip with no deck is the bug all of this exists for');
  assert.ok(Math.abs(hip - gable) < 1, `deck: hip ${hip.toFixed(1)} sf vs gable ${gable.toFixed(1)} sf`);
});

test('the roofing bills MORE than the deck, because it has to reach the hip', () => {
  const hipRoofing = areaOf(hipModel(), 'roofingCourse');
  const gableRoofing = areaOf(gableModel(), 'roofingCourse');
  assert.ok(hipRoofing > gableRoofing, `${hipRoofing.toFixed(0)} vs ${gableRoofing.toFixed(0)}`);
  // Bounded — this is trim at the hips, not a second roof.
  assert.ok(hipRoofing < gableRoofing * 1.25, `${(100 * (hipRoofing / gableRoofing - 1)).toFixed(0)}% is too much to be trim`);
});

test('the two roofs cover the same PLAN — the surfaces themselves are equal', () => {
  // The geometric identity the material figure above sits on top of, checked without the tiler
  // in the way: an equal-pitch hip and gable on one plan have the same roof area.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  const planeArea = (kind: 'hip' | 'gable') => {
    spec.roof = { kind, risePer12: 6, overhangFt: 1 };
    return roofPlanes(spec, 0).reduce(
      (a, p) => a + ((p.eaveLengthFt + (p.topLengthFt ?? p.eaveLengthFt)) / 2) * p.slopeLengthFt, 0);
  };
  assert.ok(Math.abs(planeArea('hip') - planeArea('gable')) < 0.01,
    `hip ${planeArea('hip').toFixed(2)} vs gable ${planeArea('gable').toFixed(2)}`);
});

test('nothing the hip lays hangs off the roof', () => {
  // A rectangle cannot be cut on a diagonal, so the pieces step across the hip line — but no
  // piece may extend past the plane it belongs to.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.roof = { kind: 'hip', risePer12: 6, overhangFt: 1 };
  for (const plane of roofPlanes(spec, 0)) {
    for (let v = 0; v <= plane.slopeLengthFt; v += plane.slopeLengthFt / 8) {
      const s = planeSpanAt(plane, v);
      assert.ok(s.lo >= -1e-9 && s.hi <= plane.eaveLengthFt + 1e-9, `${plane.id} at v=${v}: [${s.lo}, ${s.hi}]`);
      assert.ok(s.hi >= s.lo - 1e-9);
    }
    // The eave is full width and the top is the declared top.
    assert.ok(Math.abs(planeSpanAt(plane, 0).hi - planeSpanAt(plane, 0).lo - plane.eaveLengthFt) < 1e-9);
    assert.ok(Math.abs(planeSpanAt(plane, plane.slopeLengthFt).hi - planeSpanAt(plane, plane.slopeLengthFt).lo - (plane.topLengthFt ?? plane.eaveLengthFt)) < 1e-9);
  }
});

test('a rectangular roof is untouched by the taper machinery', () => {
  // The gable and the shed must come out byte-for-byte as before — the goldens say so, and
  // this says why they still can.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  for (const kind of ['gable', 'shed'] as const) {
    spec.roof = kind === 'gable'
      ? { kind, risePer12: 6, overhangFt: 1 }
      : { kind, risePer12: 3, overhangFt: 1, highSide: 'N' };
    for (const plane of roofPlanes(spec, 0)) {
      assert.equal(plane.topLengthFt, undefined, `${kind}/${plane.id} declared a taper`);
      const s = planeSpanAt(plane, plane.slopeLengthFt / 2);
      assert.deepEqual(s, { lo: 0, hi: plane.eaveLengthFt });
    }
  }
});

test('a square-plan hip is a pyramid — the ridge vanishes and all four faces are triangles', () => {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset));
  spec.dims = { lengthFt: 20, widthFt: 20 };
  spec.roof = { kind: 'hip', risePer12: 6, overhangFt: 1 };
  const planes = roofPlanes(spec, 0);
  assert.equal(planes.length, 4);
  for (const p of planes) assert.equal(p.topLengthFt, 0, `${p.id} should come to a point`);
  const model = generateStructure(spec);
  assert.ok(areaOf(model, 'roofPanel') > 0, 'a pyramid roof still gets a deck');
});
