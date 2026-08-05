// TIMBER-2 — building breadth: new foundations and the small-plan rule (plan §8.3, §3.2.2).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { specFromBuildingInput } from '../src/timber/frame';
import { joistNominalFor, SMALL_PLAN_WIDTH_FT } from '../src/timber/subsystems/floorSystem';
import type { BuildingSpec, FoundationSpec } from '../src/timber/spec';
import { shippedFamilies, familyById } from '../src/timber/catalog';
import { maxOpeningTopFt } from '../src/timber/normalize';
import { FAMILY_TABLE } from '../src/timber/catalog';
import type { Member } from '../src/timber/types';

function bldg(over: Partial<BuildingSpec> = {}): BuildingSpec {
  const base = specFromBuildingInput({
    lengthFt: 20, widthFt: 16, wallHeightFt: 8,
    studSpacingIn: 16, joistSpacingIn: 16, rafterSpacingIn: 16,
    risePer12: 4, overhangFt: 1, crawlFt: 1.5, openings: [],
  });
  return { ...base, ...over };
}

test('an open front is posts and a beam — not a wall, and not skinned', () => {
  // The storage-shed card offers this in so many words: "a wide door bay — or leave the whole
  // front open". spec.ts documented it as "posts + header", normalizeSpec dropped that wall's
  // openings with a warning, isLegacyBuilding excluded it from the frozen path — and no
  // generator read the field. A spec with openFront produced a model BYTE-IDENTICAL to one
  // without: same member count, same studs on the wall the card promises to leave open.
  const vert = (m: { cutLength: number; actual: { w: number; d: number }; rotation: readonly number[]; position: readonly number[] }): [number, number] => {
    const hx = m.cutLength / 12 / 2, hy = m.actual.d / 12 / 2, hz = m.actual.w / 12 / 2;
    const [rx, , rz] = m.rotation as [number, number, number];
    const h = Math.abs(hx * Math.sin(rz)) + Math.abs(hy * Math.cos(rz) * Math.cos(rx)) + Math.abs(hz * Math.sin(rx));
    return [m.position[1]! - h, m.position[1]! + h];
  };
  const closed = generateStructure(bldg({ coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'none' } }));
  const open = generateStructure(bldg({
    openFront: 'S',
    coverings: { wallSheathing: 'none', siding: 'plywood', roofDeck: 'plywood', roofing: 'none' },
  }));
  const onS = (model: typeof open, role: string) => model.members.filter((m) => m.wall === 'S' && m.role === role);

  // The fixture must actually have a wall there, or "it is gone" proves nothing.
  for (const role of ['stud', 'solePlate', 'siding'] as const) {
    assert.ok(onS(closed, role).length > 0, `fixture check: a closed wall has ${role}`);
  }
  // And it is gone: nothing that fills a wall between its plates survives on that side.
  for (const role of ['stud', 'solePlate', 'brace', 'siding', 'sheathingPanel', 'header', 'cripple'] as const) {
    if (role === 'header') continue; // the open front has its OWN header — the beam, checked below
    assert.equal(onS(open, role).length, 0, `an open front has no ${role}`);
  }
  // The plates stay — they are what the rafters bear on.
  assert.equal(onS(open, 'topPlate').length, 1);
  assert.equal(onS(open, 'capPlate').length, 1);

  // And the load path under them is real: floor → post → beam → top plate, meeting at each joint.
  const posts = onS(open, 'post');
  const beams = onS(open, 'header');
  assert.ok(posts.length >= 2, 'an open bay needs a post at each end at least');
  assert.equal(beams.length, posts.length - 1, 'one beam per bay');
  const [postLo, postHi] = vert(posts[0]!);
  const [beamLo, beamHi] = vert(beams[0]!);
  const [plateLo] = vert(onS(open, 'topPlate')[0]!);
  assert.ok(Math.abs(postLo) < 1e-9, 'posts stand on the floor');
  assert.ok(Math.abs(beamLo - postHi) < 1e-9, 'the beam bears on the posts');
  assert.ok(Math.abs(plateLo - beamHi) < 1e-9, 'and the plates bear on the beam');

  // The other three walls are untouched.
  for (const wall of ['N', 'E', 'W'] as const) {
    const before = closed.members.filter((m) => m.wall === wall).length;
    const after = open.members.filter((m) => m.wall === wall).length;
    assert.equal(after, before, `wall ${wall} must not change because the front opened`);
  }
});

test('the B-hut has its bays: partitions are framed, and the framing stack meets exactly', () => {
  // `bHutPartitions()` computed three dividing walls, `buildingSpecForHut` put them on the spec,
  // `isLegacyBuilding` checked for them — and `generateBuilding` never read the field. Nothing
  // was framed. The card's cutaway even said "cut across the bays, see how the partitions land
  // between the studs": a cut plane aimed at empty air.
  const hut = generateStructure(familyById('b-hut')!.preset);
  const part = hut.members.filter((m) => m.id.startsWith('PT-'));
  assert.ok(part.length > 0, 'a B-hut is defined by its bays');

  const vert = (m: { cutLength: number; actual: { w: number; d: number }; rotation: readonly number[]; position: readonly number[] }): [number, number] => {
    const hx = m.cutLength / 12 / 2, hy = m.actual.d / 12 / 2, hz = m.actual.w / 12 / 2;
    const [rx, , rz] = m.rotation as [number, number, number];
    const h = Math.abs(hx * Math.sin(rz)) + Math.abs(hy * Math.cos(rz) * Math.cos(rx)) + Math.abs(hz * Math.sin(rx));
    return [m.position[1]! - h, m.position[1]! + h];
  };
  const one = (role: string) => part.find((m) => m.role === role)!;
  const [soleLo, soleHi] = vert(one('solePlate'));
  const [studLo, studHi] = vert(one('stud'));
  const [topLo, topHi] = vert(one('topPlate'));
  assert.ok(Math.abs(soleLo) < 1e-9, 'the sole plate sits on the floor');
  assert.ok(Math.abs(studLo - soleHi) < 1e-9, 'studs stand on the sole plate');
  assert.ok(Math.abs(topLo - studHi) < 1e-9, 'the top plate lands on the studs');
  assert.ok(Math.abs(topHi - 8) < 1e-9, 'and stops at wall height, under the ceiling framing');

  // ONE top plate. A partition carries nothing; the doubled cap is what takes a roof.
  assert.equal(part.filter((m) => m.role === 'capPlate').length, 0, 'a non-bearing wall has no cap plate');

  // The doorway: jacks carry the header, cripples fill from the header to the plate.
  const [jackLo, jackHi] = vert(one('jackStud'));
  const [hdrLo, hdrHi] = vert(one('header'));
  const [cripLo, cripHi] = vert(one('cripple'));
  assert.ok(Math.abs(jackLo - soleHi) < 1e-9, 'jacks stand on the sole plate too');
  assert.ok(Math.abs(hdrLo - jackHi) < 1e-9, 'the header bears on the jacks');
  assert.ok(Math.abs(cripLo - hdrHi) < 1e-9, 'cripples start at the header');
  assert.ok(Math.abs(cripHi - topLo) < 1e-9, 'and close on the top plate');

  // Bays are equal, and the partitions butt BETWEEN the exterior walls rather than through them.
  const { lengthFt: L, widthFt: W } = familyById('b-hut')!.preset.dims;
  const stations = [...new Set(part.map((m) => Math.round(m.position[0] * 100) / 100))].sort((a, b) => a - b);
  assert.equal(stations.length, 3, 'four bays need three dividers');
  for (let i = 0; i < stations.length; i++) {
    assert.ok(Math.abs(stations[i]! - (L * (i + 1)) / 4) < 1e-6, `divider ${i} is off its quarter point`);
  }
  for (const m of part) {
    const z = m.position[2]!;
    assert.ok(z > 0 && z < W, `${m.id} at z=${z.toFixed(2)} is outside the hut`);
  }

  // And a hut whose card promises one open bay has none.
  const squad = generateStructure(familyById('squad-hut')!.preset);
  assert.equal(squad.members.filter((m) => m.id.startsWith('PT-')).length, 0, 'the squad hut is one open bay');
});

test('no header is driven through a top plate — on any shipped preset, at any wall height', () => {
  // The storage shed shipped one. Its 8-ft door needs a 2x10 by the span table, a 2x10 is 9¼ in
  // deep, and an 8-ft wall has 91½ in between plates — so a 7-ft door wanted 93¼. The header
  // was drawn running 1¾ in INTO the top plate: two solid members in the same space, on a
  // standard card, hidden under siding and only visible with the framing stage scrubbed up.
  // The guard shack had three more of them, from a 3½-ft window sill on a 7.5-ft wall.
  const vert = (m: { cutLength: number; actual: { w: number; d: number }; rotation: readonly number[]; position: readonly number[] }): [number, number] => {
    const hx = m.cutLength / 12 / 2, hy = m.actual.d / 12 / 2, hz = m.actual.w / 12 / 2;
    const [rx, , rz] = m.rotation as [number, number, number];
    const h = Math.abs(hx * Math.sin(rz)) + Math.abs(hy * Math.cos(rz) * Math.cos(rx)) + Math.abs(hz * Math.sin(rx));
    return [m.position[1]! - h, m.position[1]! + h];
  };
  for (const f of shippedFamilies()) {
    const model = generateStructure(f.preset);
    const plates = model.members.filter((m) => m.role === 'topPlate');
    for (const h of model.members.filter((m) => m.role === 'header')) {
      const plate = plates.find((p) => p.wall === h.wall);
      if (!plate) continue;
      const clearance = vert(plate)[0] - vert(h)[1];
      assert.ok(
        clearance > -1e-6,
        `${f.id}/${h.id} (${h.nominal}) is driven ${(-clearance * 12).toFixed(2)} in into ${plate.id}`,
      );
    }
  }
});

test('maxOpeningTopFt: an opening plus its header must clear the plates', () => {
  // 8-ft wall, 3-ft window: plates take 4½ in, a 2x6 header 5½, leaving 86 in = 7.167 ft.
  assert.ok(Math.abs(maxOpeningTopFt(8, 3) - (8 - 0.375 - 5.5 / 12)) < 1e-9);
  // The same wall with an 8-ft door needs a 2x10, which costs another 3¾ in of headroom.
  assert.ok(maxOpeningTopFt(8, 8) < maxOpeningTopFt(8, 3), 'a wider opening leaves less headroom');
  // A taller wall buys headroom foot for foot.
  assert.ok(Math.abs((maxOpeningTopFt(9, 3) - maxOpeningTopFt(8, 3)) - 1) < 1e-9);
});

test('slab on grade: the slab IS the floor — concrete, an edge under the walls, no wood floor', () => {
  // What this replaces: "Slab on grade" emitted NO slab. It fell through to the framed-floor
  // branch and produced joists, bridging and a subfloor resting on nothing at all — a wood
  // floor with clear air under it, and no concrete anywhere in the model or on the bill.
  const model = generateStructure(bldg({ foundation: { kind: 'slab' } }));

  const slabs = model.members.filter((m) => m.role === 'slab');
  assert.equal(slabs.length, 1, 'one pour');
  const slab = slabs[0]!;
  const slabTop = slab.position[1] + slab.actual.d / 12 / 2;
  assert.ok(Math.abs(slabTop) < 1e-9, `the slab top IS the floor; it is at ${slabTop.toFixed(3)}`);
  assert.ok(Math.abs(slab.cutLength / 12 - 20) < 1e-9, 'the pour covers the plan length');
  assert.ok(Math.abs(slab.actual.w / 12 - 16) < 1e-9, 'and its width');

  // NOTHING IS FRAMED UNDER A SLAB. Stated as "what is below the floor" rather than a list of
  // banned roles, because 'joist' is not by itself a floor member — a gable roof's ceiling
  // joists carry the same role, up at the plates, and a ban on the word would have failed for
  // the wrong reason.
  for (const m of model.members.filter((x) => x.position[1] < -1e-6)) {
    assert.ok(
      m.role === 'slab' || m.role === 'footing',
      `${m.id} (${m.role}) is under a slab — only the pour and its edge belong there`,
    );
  }

  // The thickened edge runs under every wall line, carrying the slab.
  const edge = model.members.filter((m) => m.role === 'footing');
  assert.equal(edge.length, 4, 'one run per wall line');
  const slabBottom = slab.position[1] - slab.actual.d / 12 / 2;
  for (const f of edge) {
    const top = f.position[1] + f.actual.d / 12 / 2;
    assert.ok(Math.abs(top - slabBottom) < 1e-9, `${f.id}: its top must be the slab's underside`);
  }

  // And the walls stand ON it: a sole plate's underside is the slab's top face.
  const sole = model.members.filter((m) => m.role === 'solePlate');
  assert.ok(sole.length > 0);
  for (const p of sole) {
    // A plate is laid FLAT (rx = -90°), so its thickness — `actual.w` — is the vertical
    // dimension, not its face width. Getting that backwards reads a plate as 2 in low.
    // Only the FLATNESS matters here; the yaw differs per wall (the N plate faces about-face).
    assert.ok(Math.abs(Math.abs(p.rotation[0]) - Math.PI / 2) < 1e-6, `${p.id}: a plate lies flat`);
    const bottom = p.position[1] - p.actual.w / 12 / 2;
    assert.ok(Math.abs(bottom - slabTop) < 1e-6, `${p.id}: sits at ${bottom.toFixed(3)}, slab top ${slabTop.toFixed(3)}`);
  }

  // The stages a crew actually works through, in the plan's own words.
  assert.deepEqual(
    model.stagePlan.slice(1, 4).map((e) => e.label),
    ['Thickened edge poured', 'Slab poured', 'Slab cures'],
  );
  // Those rows keep their POSITIONS: the frozen wall generator stamps 5 and 6 as literals, so
  // dropping a row above them lands every wall member a stage late or past the plan entirely.
  assert.equal(model.stagePlan[4]!.key, 'walls');
  assert.equal(model.stagePlan[5]!.key, 'plates');
});

test('skids: runners under the floor, no posts, no pads', () => {
  const model = generateStructure(bldg({ foundation: { kind: 'skids' } }));
  const skids = model.members.filter((m) => m.role === 'skid');
  assert.ok(skids.length >= 2, `expected skid runners, got ${skids.length}`);
  assert.equal(model.members.filter((m) => m.role === 'post').length, 0, 'skids replace posts');
  assert.equal(model.members.filter((m) => m.role === 'footing').length, 0, 'and their footers');
  for (const s of skids) {
    assert.equal(s.nominal, '4x6');
    assert.ok(/chamfer|drift/i.test(s.nailing), `${s.id}: a skid is dragged — say how it is built`);
    assert.ok(Math.abs(s.cutLength / 12 - 20) < 1e-9, 'runners run the full length');
  }
  // The building still has a floor and walls on top of them.
  assert.ok(model.members.some((m) => m.role === 'joist'));
  assert.ok(model.members.some((m) => m.role === 'stud'));
});

test('slab: grade sits at the underside of the pour, with no crawl space below it', () => {
  const model = generateStructure(bldg({ foundation: { kind: 'slab' } }));
  assert.equal(model.members.filter((m) => m.role === 'post').length, 0);
  assert.equal(model.members.filter((m) => m.role === 'skid').length, 0);
  assert.ok(model.levels.gradeY < 0, 'grade sits just under the floor');
  assert.ok(model.levels.gradeY > -2, 'and not a crawl space away');
  // This used to end `assert.ok(members.some(m => m.role === 'joist'))` under the title "the
  // floor frames on grade" — which was the behaviour being asserted back when a slab emitted a
  // suspended wood floor and no concrete. It kept passing after that was fixed, for the wrong
  // reason: a gable roof's CEILING joists carry role 'joist' too. Grade is what this checks now.
  const slab = model.members.find((m) => m.role === 'slab')!;
  assert.ok(
    Math.abs(model.levels.gradeY - (slab.position[1] - slab.actual.d / 12 / 2)) < 1e-9,
    'the ground meets the slab where the slab ends',
  );
});

test('§3.2.2 small-plan rule: below 8 ft of width there is NO girder', () => {
  const narrow = generateStructure(bldg({ dims: { lengthFt: 12, widthFt: 6 }, foundation: { kind: 'skids' } }));
  assert.equal(narrow.members.filter((m) => m.role === 'girder').length, 0, 'a 6-ft-wide floor clear-spans');
  // FLOOR joists only — the roof's ceiling joists share the role but carry the RF prefix.
  const joists = narrow.members.filter((m) => m.role === 'joist' && m.id.startsWith('FL-'));
  assert.ok(joists.length > 0);
  assert.equal(joists[0]!.nominal, '2x6', 'a short clear span calls for a 2x6, not the house 2x8');
  // And the joists really do run wall to wall.
  for (const j of joists) {
    assert.ok(Math.abs(j.cutLength / 12 - (6 - 2 * (1.5 / 12))) < 1e-9, `${j.id}: full clear span`);
  }
});

test('the joist-size rule is stated once and agrees with the constant', () => {
  assert.equal(SMALL_PLAN_WIDTH_FT, 8);
  assert.equal(joistNominalFor(SMALL_PLAN_WIDTH_FT - 0.01), '2x6');
  assert.equal(joistNominalFor(SMALL_PLAN_WIDTH_FT), '2x8');
  assert.equal(joistNominalFor(24), '2x8');
});

test('the 4x4 skid preset generates green — the catalog envelope minimum really works', () => {
  const tiny = generateStructure(bldg({
    dims: { lengthFt: 4, widthFt: 4 },
    foundation: { kind: 'skids' },
    roof: { kind: 'shed', risePer12: 2, overhangFt: 0.5, highSide: 'N' },
    stories: [{ wallHeightFt: 7, openings: {} }],
  }));
  assert.ok(tiny.members.length > 20, `a 4x4 shack still frames: ${tiny.members.length} members`);
  assert.equal(tiny.members.filter((m) => m.role === 'girder').length, 0, 'no girder in a 4-ft plan');
  for (const m of tiny.members) {
    for (const v of [...m.position, ...m.rotation, m.cutLength]) assert.ok(Number.isFinite(v), m.id);
    assert.ok(m.cutLength > 0, `${m.id}: ${m.cutLength}`);
  }
});

test('openFront drops that wall\'s openings and says why (a wall that IS an opening)', () => {
  const spec = bldg({
    openFront: 'S',
    stories: [{ wallHeightFt: 8, openings: { S: [{ kind: 'door', offsetFt: 4, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }] } }],
  });
  const model = generateStructure(spec);
  assert.equal((model.spec as BuildingSpec).stories[0]!.openings.S, undefined);
  const issue = model.issues.find((i) => i.path.includes('openings.S'));
  assert.ok(issue && /open front/i.test(issue.message), 'the user is told, not silently corrected');
});

test('every foundation kind produces a finite, staged, uniquely-identified model', () => {
  const founds: FoundationSpec[] = [
    { kind: 'piers', crawlFt: 1.5 },
    { kind: 'wall', crawlFt: 2 },
    { kind: 'basement', depthFt: 7.5, stairs: true },
    { kind: 'slab' },
    { kind: 'skids' },
  ];
  for (const foundation of founds) {
    const model = generateStructure(bldg({ foundation }));
    const ids = new Set<string>();
    for (const m of model.members) {
      assert.ok(!ids.has(m.id), `${foundation.kind}: duplicate id ${m.id}`);
      ids.add(m.id);
      assert.ok(m.stage >= 1 && m.stage <= model.stagePlan.length, `${foundation.kind}/${m.id}: stage ${m.stage}`);
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${foundation.kind}/${m.id}: non-finite`);
      }
    }
  }
});

test('coverings compose with every foundation and roof without id collisions', () => {
  for (const foundation of [{ kind: 'skids' } as const, { kind: 'piers', crawlFt: 1.5 } as const]) {
    for (const roof of [
      { kind: 'gable', risePer12: 4, overhangFt: 1 } as const,
      { kind: 'shed', risePer12: 3, overhangFt: 1, highSide: 'N' } as const,
      { kind: 'flat', overhangFt: 0.5, drainPer12: 1 } as const,
    ]) {
      const model = generateStructure(bldg({
        foundation,
        roof,
        coverings: { wallSheathing: 'plywood', siding: 'boardAndBatten', roofDeck: 'plywood', roofing: 'roll' },
      }));
      const ids = new Set<string>();
      for (const m of model.members) {
        assert.ok(!ids.has(m.id), `${foundation.kind}/${roof.kind}: duplicate id ${m.id}`);
        ids.add(m.id);
      }
      assert.ok(model.members.some((m) => m.role === 'siding' || m.role === 'sidingBoard'), 'siding present');
      assert.ok(model.members.some((m) => m.role === 'roofingCourse'), 'roofing present');
    }
  }
});

// ── Skids: the runners a building is dragged on ──────────────────────────────

/**
 * A member's axis-aligned box, in feet.
 *
 * Spelled out because getting it wrong is how a sweep invents defects that are not there. Length
 * runs along LOCAL X; `actual.d` is the face width (local Y) and `actual.w` the thickness (local
 * Z). Then: ry = ±90° swings the length onto world Z; rz = ±90° stands the member up, so its
 * LENGTH becomes its vertical extent; rx = −90° lays it flat, so its thickness is vertical.
 */
function memberBox(m: Member): { lo: [number, number, number]; hi: [number, number, number] } {
  const [rx, ry, rz] = m.rotation;
  const len = m.cutLength / 12;
  const face = m.actual.d / 12;
  const thick = m.actual.w / 12;
  const alongZ = Math.abs(Math.sin(ry)) > 0.5;
  const vertical = Math.abs(Math.abs(rz) - Math.PI / 2) < 1e-6;
  const flat = Math.abs(Math.abs(rx) - Math.PI / 2) < 1e-6;
  const ext = vertical
    ? { x: alongZ ? thick : face, y: len, z: alongZ ? face : thick }
    : flat
      ? { x: alongZ ? thick : len, y: thick, z: alongZ ? len : face }
      : { x: alongZ ? thick : len, y: face, z: alongZ ? len : thick };
  return {
    lo: [m.position[0] - ext.x / 2, m.position[1] - ext.y / 2, m.position[2] - ext.z / 2],
    hi: [m.position[0] + ext.x / 2, m.position[1] + ext.y / 2, m.position[2] + ext.z / 2],
  };
}

const overlapFt = (a: ReturnType<typeof memberBox>, b: ReturnType<typeof memberBox>): number[] =>
  [0, 1, 2].map((k) => Math.min(a.hi[k]!, b.hi[k]!) - Math.max(a.lo[k]!, b.lo[k]!));

/** Every shipped configuration that puts a building on runners, plus the picker-only one. */
function skidCases(): { label: string; model: ReturnType<typeof generateStructure> }[] {
  const out: { label: string; model: ReturnType<typeof generateStructure> }[] = [];
  for (const fam of FAMILY_TABLE) {
    const model = generateStructure(fam.preset);
    if (model.members.some((m) => m.role === 'skid')) out.push({ label: fam.id, model });
  }
  const platform = FAMILY_TABLE.find((f) => f.id === 'platform');
  if (platform) {
    const onSkids = { ...(platform.preset as object), base: 'skids' } as unknown as Parameters<typeof generateStructure>[0];
    out.push({ label: 'platform/skids', model: generateStructure(onSkids) });
  }
  return out;
}

test('a skid lies ON the ground — it is a runner, not something buried under one', () => {
  // `generateSkids` assumed grade was y = 0 and hung the skid BELOW it, while the building branch
  // computed grade as `joistTop − joistDepth − skidDepth` — more than a foot lower — and the
  // scene drew the ground there. Two ideas of where the earth is, in one function. The skids came
  // out floating 8 in clear of it with the floor they carry buried underneath.
  const cases = skidCases();
  assert.ok(cases.length >= 4, `only ${cases.length} skid configurations found`);
  for (const { label, model } of cases) {
    const grade = model.levels?.gradeY ?? 0;
    for (const s of model.members.filter((m) => m.role === 'skid')) {
      const box = memberBox(s);
      assert.ok(
        Math.abs(box.lo[1]! - grade) < 1e-9,
        `${label} ${s.id}: underside at ${box.lo[1]}, grade at ${grade} — ${((box.lo[1]! - grade) * 12).toFixed(2)} in off the ground`,
      );
    }
  }
});

test('nothing runs through a skid, and something bears on every one of them', () => {
  for (const { label, model } of skidCases()) {
    const skids = model.members.filter((m) => m.role === 'skid');
    assert.ok(skids.length > 0);
    for (const s of skids) {
      const a = memberBox(s);
      for (const o of model.members) {
        if (o.role === 'skid' || o.id === s.id) continue;
        const ov = overlapFt(a, memberBox(o));
        assert.ok(
          !ov.every((v) => v > 1e-6),
          `${label}: ${o.role} ${o.id} runs through ${s.id} by ${ov.map((v) => (v * 12).toFixed(2) + ' in').join(' x ')}`,
        );
      }
      // A runner that carries nothing is not a foundation. Whatever the family puts on it —
      // joists on a hut, posts on a platform — must land exactly on its top.
      const carried = model.members.filter((o) => o.role !== 'skid' && Math.abs(memberBox(o).lo[1]! - a.hi[1]!) < 1e-9);
      assert.ok(carried.length > 0, `${label} ${s.id}: nothing bears on this runner`);
    }
  }
});

test('a building on skids stands above the earth, not in a trench dug for it', () => {
  // The whole floor — every joist, rim joist and bridging piece — was below y = 0 with the
  // subfloor's top exactly at ground level.
  for (const { label, model } of skidCases()) {
    const grade = model.levels?.gradeY ?? 0;
    const buried = model.members.filter((m) => memberBox(m).hi[1]! < grade - 1e-6);
    assert.deepEqual(
      buried.map((m) => `${m.role} ${m.id}`),
      [],
      `${label}: ${buried.length} members are underground`,
    );
  }
});

test('let-in bracing: steepened where the openings crowd it, and absent where it cannot fit', () => {
  // NOT A DEFECT — a STATED behaviour, written down because it was neither.
  //
  // The guard shack comes out of the engine with all four walls unbraced, and every other
  // shipped building gets eight braces. That looks alarming until you measure it: an 8 ft wall
  // with a 3 ft opening roughly centred leaves 2.0 ft of clear wall at each corner, and a brace
  // over a 2 ft run against a 7.1 ft rise stands at 74° — that is a stud, not a brace. The
  // generator drops it below a 3 ft run, steepens it from 45° up to about 62° above that, and
  // says nothing either way.
  //
  // This test does not decide whether the rule is right. It makes the rule VISIBLE, so that a
  // family which today has bracing cannot lose it to an opening someone moves, and so that the
  // guard shack's zero is a fact somebody chose rather than one nobody noticed.
  const MIN_RUN_FT = 3;
  const expectation: Record<string, number> = {
    'gp-frame': 6, // long walls take one each: the openings crowd the other corner
    'sea-hut': 8, 'swa-hut': 8, 'b-hut': 8, 'squad-hut': 8, 'latrine': 8, 'storage-shed': 8,
    'guard-shack': 0, // 2.0 ft of clear wall at every corner — below the rule's floor
  };
  for (const [id, want] of Object.entries(expectation)) {
    const fam = FAMILY_TABLE.find((f) => f.id === id);
    assert.ok(fam, `${id} is not in the catalog`);
    const model = generateStructure(fam.preset);
    const braces = model.members.filter((m) => m.role === 'brace');
    assert.equal(braces.length, want, `${id}: ${braces.length} let-in braces, expected ${want}`);
    // Every brace that IS placed leans within the range the rule allows: 45° at best, and never
    // steeper than the shortest run the rule permits would make it.
    const capTop = Math.max(...model.members.filter((m) => m.role === 'capPlate').map((m) => m.position[1] + m.actual.w / 24));
    const studLen = capTop - 3 * (1.5 / 12);
    const steepest = (Math.atan2(studLen, MIN_RUN_FT) * 180) / Math.PI;
    for (const b of braces) {
      const deg = (Math.abs(b.rotation[2]) * 180) / Math.PI;
      assert.ok(deg >= 44.9, `${id} ${b.id}: ${deg.toFixed(0)}° is shallower than 45°`);
      assert.ok(deg <= steepest + 0.1, `${id} ${b.id}: ${deg.toFixed(0)}° is steeper than the ${MIN_RUN_FT} ft run the rule floors at`);
    }
  }
});
