// What fills a rough opening — the doors and shutters that were never built.
//
// `OpeningSpec.fill` was written by every preset and by both "+ Door" / "+ Window" buttons and
// read by nothing, so every door and window on all fourteen cards was a hole you could see the
// cripples through. These tests pin the pieces that fill them, and the first two are the ones the
// plan named in T5's acceptance list and that were never written because the module never was.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById, FAMILY_TABLE } from '../src/timber/catalog';
import { fastenerTakeoff } from '../src/timber/fasteners';
import { OPENING, IN_PER_FT } from '../src/timber/doctrine';
import { DRESSED } from '../src/timber/types';
import type { Member, MemberRole } from '../src/timber/types';
import type { StructureSpec } from '../src/timber/spec';

type V3 = [number, number, number];

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

const DOOR_ROLES: MemberRole[] = ['doorBoard', 'doorLedge', 'doorBrace'];
const BUILT_ROLES: MemberRole[] = [...DOOR_ROLES, 'shutter'];

const modelOf = (id: string) =>
  generateStructure(JSON.parse(JSON.stringify(familyById(id as never)!.preset)) as StructureSpec);

/** Every opening on a spec, flattened with its wall — the same source the cutouts come from. */
function openingsOf(spec: StructureSpec): { wall: string; kind: string; fill: string }[] {
  const s = spec as unknown as { stories?: { openings?: Record<string, unknown[]> }[]; openings?: Record<string, unknown[]> };
  const walls = s.stories?.[0]?.openings ?? s.openings ?? {};
  const out: { wall: string; kind: string; fill: string }[] = [];
  for (const [wall, list] of Object.entries(walls)) {
    for (const o of (list ?? []) as { kind: string; fill?: string }[]) {
      out.push({ wall, kind: o.kind, fill: o.fill ?? 'rough' });
    }
  }
  return out;
}

test('EVERY OPENING THAT SAYS IT IS FILLED GETS FILLED, on every shipped card', () => {
  // Before: zero doorBoards, zero doorLedges, zero doorBraces and zero shutters in the entire
  // catalog, while ten of the fourteen cards asked for 'door-ledged' and 'window-shutter'.
  let cardsWithFills = 0;
  for (const fam of FAMILY_TABLE) {
    const m = modelOf(fam.id);
    const built = m.members.filter((x) => BUILT_ROLES.includes(x.role));
    const filled = openingsOf(m.spec).filter((o) => o.fill !== 'rough');
    const hasClosingIn = m.stagePlan.some((p) => p.key === 'siding');
    if (filled.length === 0 || !hasClosingIn) {
      assert.equal(built.length, 0,
        `${fam.id} built ${built.length} pieces for ${filled.length} filled openings and closing-in=${hasClosingIn}`);
      continue;
    }
    cardsWithFills++;
    const doors = filled.filter((o) => o.fill === 'door-ledged').length;
    const shuttered = filled.filter((o) => o.fill.includes('shutter')).length;
    if (doors > 0) {
      assert.ok(m.members.some((x) => x.role === 'doorBoard'), `${fam.id}: ${doors} ledged doors, no boards`);
      assert.equal(m.members.filter((x) => x.role === 'doorLedge').length, doors * (OPENING.doorLedges.value as number),
        `${fam.id}: ledge count`);
      assert.equal(m.members.filter((x) => x.role === 'doorBrace').length, doors * (OPENING.doorBraces.value as number),
        `${fam.id}: brace count`);
    }
    if (shuttered > 0) {
      assert.ok(m.members.some((x) => x.role === 'shutter'), `${fam.id}: ${shuttered} shuttered windows, no shutter`);
    }
  }
  assert.ok(cardsWithFills >= 7, `only ${cardsWithFills} cards exercised this`);
});

test('THE BRACES RUN IN COMPRESSION — the one thing a ledged door can get wrong', () => {
  // A brace running DOWN from the hinge jamb to the latch is in TENSION across nailed lap
  // joints, and the door racks into a parallelogram. It has to rise AWAY from the hinge so the
  // leaf's sag loads it lengthwise. The hinge jamb is the u0 edge, and rising away from it is a
  // POSITIVE rz in the wall's own frame — which is the sign this asserts, on every brace of
  // every card, rather than on one door somebody looked at.
  let n = 0;
  for (const fam of FAMILY_TABLE) {
    for (const b of modelOf(fam.id).members.filter((x) => x.role === 'doorBrace')) {
      assert.ok(b.rotation[2]! > 0.1,
        `${fam.id}/${b.id} leans ${(b.rotation[2]! * 180 / Math.PI).toFixed(1)}° — a brace that does not rise from the hinge is in tension`);
      assert.ok(b.rotation[2]! < Math.PI / 2 - 0.1, `${fam.id}/${b.id} is vertical, not a brace`);
      n++;
    }
  }
  assert.ok(n >= 8, `only ${n} braces checked`);
});

test('the leaf fits its rough opening — inside it, not through it', () => {
  // The plan's other named acceptance: "shutter/door assemblies fit ROs". A door piece must sit
  // within the opening it fills, with the fitting clearance and no more.
  const m = modelOf('gp-frame');
  const clr = (OPENING.leafClearanceIn.value as number) / IN_PER_FT;
  const door = m.members.filter((x) => DOOR_ROLES.includes(x.role));
  assert.ok(door.length > 0);
  // The E-wall door: a 3 ft x 6 ft 8 in RO. Its pieces span the opening less the clearance.
  const east = door.filter((x) => x.wall === 'E');
  assert.ok(east.length > 0, 'the east door exists');
  const ys = east.flatMap((x) => box(x).y);
  const zs = east.flatMap((x) => box(x).z);
  // Measured against the opening THIS CARD asks for, not against the doctrine figure: the
  // gp-frame preset writes 6.7 ft where `OPENING.doorHeightFt` is 6 ft 8 in, and a test that
  // silently prefers one would be asserting something the model was never asked to do.
  const spec = openingsOf(m.spec);
  void spec;
  const ro = ((m.spec as unknown as { stories: { openings: { E?: { widthFt: number; heightFt: number }[] } }[] })
    .stories[0]!.openings.E ?? [])[0]!;
  const roH = ro.heightFt;
  const roW = ro.widthFt;
  assert.ok(Math.abs((Math.max(...ys) - Math.min(...ys)) - (roH - 2 * clr)) < 1e-6,
    `leaf is ${(Math.max(...ys) - Math.min(...ys)).toFixed(4)} ft tall against a ${roH.toFixed(4)} ft opening`);
  assert.ok(Math.abs((Math.max(...zs) - Math.min(...zs)) - (roW - 2 * clr)) < 1e-6,
    `leaf is ${(Math.max(...zs) - Math.min(...zs)).toFixed(4)} ft wide against a ${roW} ft opening`);
});

test('the door is hung IN the wall and the shutter hangs ON it', () => {
  // Two different jobs and two different planes. A door leaf sits in the rough opening, its face
  // in the wall's outer face, so the sheathing and siding lap past it; a shutter is fastened to
  // the finished wall and stands proud of the siding. Getting either backwards buries a member
  // in something else — which is exactly what the tower cab did with its own cladding.
  const m = modelOf('gp-frame');
  const boardT = DRESSED[OPENING.doorBoardNominal.value as string]!.w / IN_PER_FT;
  // The E wall's outer face is at x = length; the door's boards must end exactly there.
  const boards = m.members.filter((x) => x.role === 'doorBoard' && x.wall === 'E');
  assert.ok(boards.length > 0);
  const outer = Math.max(...boards.flatMap((b) => box(b).x));
  const L = (m.spec as unknown as { dims: { lengthFt: number } }).dims.lengthFt;
  assert.ok(Math.abs(outer - L) < 1e-6, `the leaf's face is at x=${outer.toFixed(4)}, the wall's is at ${L}`);
  assert.ok(Math.abs(Math.min(...boards.flatMap((b) => box(b).x)) - (L - boardT)) < 1e-6, 'and it is one board thick');
  // Every shutter on the S wall stands OUTSIDE the wall face (z < 0 is outboard there).
  const shutters = m.members.filter((x) => x.role === 'shutter' && x.wall === 'S');
  assert.ok(shutters.length > 0);
  for (const s of shutters) {
    assert.ok(box(s).z[1]! <= 0 + 1e-9, `${s.id} reaches z=${box(s).z[1]!.toFixed(4)} — it is inside the wall`);
  }
});

test('a closed shutter pair covers the whole window and the two leaves do not overlap', () => {
  // A shutter that stopped at the rough opening leaves a light gap all round, and two that
  // overlap are two that will not both close.
  const m = modelOf('gp-frame');
  const lap = (OPENING.shutterLapIn.value as number) / IN_PER_FT;
  const boards = m.members.filter((x) => x.role === 'shutter' && x.wall === 'S'
    && x.nominal === (OPENING.doorBoardNominal.value as string)
    && x.rotation[2]! > 1); // the vertical boards, not the battens
  assert.ok(boards.length > 0);
  // Group the boards of one window by their x band, then check that band's coverage.
  const byWindow = new Map<number, Member[]>();
  for (const b of boards) {
    const key = Math.round(box(b).y[0]! * 1e6);
    (byWindow.get(key) ?? byWindow.set(key, []).get(key)!).push(b);
  }
  assert.ok(byWindow.size >= 1);
  for (const group of byWindow.values()) {
    const spans = group.map((b) => box(b).x).sort((a, b) => a[0]! - b[0]!);
    const wide = Math.max(...spans.map((s) => s[1]!)) - Math.min(...spans.map((s) => s[0]!));
    assert.ok(wide >= (OPENING.windowWidthFt.value as number) + 2 * lap - 1e-6,
      `the pair covers ${wide.toFixed(4)} ft of a ${OPENING.windowWidthFt.value} ft window plus lap`);
    for (let i = 1; i < spans.length; i++) {
      assert.ok(spans[i]![0]! >= spans[i - 1]![1]! - 1e-6,
        `boards overlap at x=${spans[i]![0]!.toFixed(4)}`);
    }
  }
});

test('the boards, the ledges and the braces are in three different planes', () => {
  // The assembly is boards, then ledges on the back, then braces BETWEEN the ledges — so the
  // braces share the ledges' plane and neither shares the boards'. Two solids in one place is
  // the defect this sweep keeps finding.
  const m = modelOf('gp-frame');
  const pick = (r: MemberRole) => m.members.filter((x) => x.role === r && x.wall === 'E');
  const face = (ms: Member[]) => [Math.min(...ms.flatMap((x) => box(x).x)), Math.max(...ms.flatMap((x) => box(x).x))];
  const b = face(pick('doorBoard'));
  const l = face(pick('doorLedge'));
  const br = face(pick('doorBrace'));
  assert.ok(l[1]! <= b[0]! + 1e-9, `the ledges (to ${l[1]!.toFixed(4)}) run into the boards (from ${b[0]!.toFixed(4)})`);
  assert.ok(Math.abs(br[0]! - l[0]!) < 1e-9 && Math.abs(br[1]! - l[1]!) < 1e-9,
    'the braces sit between the ledges, in their plane');
});

test('a card with nothing closing it in gets no doors', () => {
  // `custom` is the bare-frame teaching card: no sheathing, no siding, and therefore no
  // closing-in stage. Its openings are meant to read as holes, and hanging a door on a stage
  // that does not exist would have thrown.
  const m = modelOf('custom');
  assert.ok(!m.stagePlan.some((p) => p.key === 'siding'), 'the premise: no closing-in stage');
  assert.equal(m.members.filter((x) => BUILT_ROLES.includes(x.role)).length, 0);
});

test('every nailing schedule on a built opening is one the take-off can read', () => {
  // The hardware bill fails loudly on a schedule it does not understand, which is the only
  // reason it can be trusted. A new member class is a new chance to write one it cannot.
  for (const id of ['gp-frame', 'sea-hut', 'guard-shack', 'latrine', 'squad-hut']) {
    const take = fastenerTakeoff(modelOf(id).members);
    assert.deepEqual(take.unparsed, [], `${id}: ${take.unparsed.map((u) => u.schedule).join(' | ')}`);
  }
});

test('the ledges are counted once, on the boards that are nailed through them', () => {
  // The boards are nailed through the ledges and clenched over: one joint, bought once. If the
  // ledge billed its own nails the door would carry them twice.
  const m = modelOf('gp-frame');
  const ledge = m.members.find((x) => x.role === 'doorLedge')!;
  assert.match(ledge.nailing, /^boards\b/, 'the ledge names the boards as the thing fastened');
  const board = m.members.find((x) => x.role === 'doorBoard')!;
  assert.match(board.nailing, new RegExp(`^${2 * (OPENING.doorLedges.value as number)}-6d\\b`),
    `the board buys two nails per ledge; got "${board.nailing}"`);
});

// ── Getting to the door ──────────────────────────────────────────────────────
//
// `BuildingSpec.entrySteps` was declared, set to `true` by every hut, and read by nothing —
// the same shape as `fill` above, found the same way in the same file. Measured before the fix:
// a piered building's threshold stands 2 ft 3 1/2 in above grade, so five cards had a door
// opening onto clear air down to the pier footings.

import { STAIR } from '../src/timber/doctrine';
import { generateStair } from '../src/timber/subsystems/access';
import { stringerEndProfile } from '../src/timber/stringerCuts';

/**
 * World-space sample points of a stringer AS CUT — not of the raw stick it is cut from.
 *
 * The distinction is the whole of this section. A stringer's ends are cut level and plumb, so the
 * board's corners are not the piece's corners, and neither its bounding box nor its centreline
 * describes what is actually drawn. Sampling the cut profile does.
 */
function cutSamples(m: Member): V3[] {
  const prof = stringerEndProfile(m);
  const hz = m.actual.w / 24;
  const out: V3[] = [];
  const inside = (px: number, py: number): boolean => {
    // Even-odd test against the profile polygon.
    let hit = false;
    for (let i = 0, j = prof.length - 1; i < prof.length; j = i++) {
      const [xi, yi] = prof[i]!; const [xj, yj] = prof[j]!;
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  // The corners first, and exactly: an even-odd test is ambiguous ON the boundary, so a grid
  // alone misses the very points that decide where the piece starts and stops.
  for (const [px, py] of prof) {
    for (const pz of [-hz, hz]) {
      const r = rotate(m, [px, py, pz]);
      out.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
    }
  }
  const xs = prof.map((q) => q[0]); const ys = prof.map((q) => q[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  for (let a = 0; a <= 80; a++) {
    for (let b = 0; b <= 6; b++) {
      const px = x0 + ((x1 - x0) * a) / 80;
      const py = y0 + ((y1 - y0) * b) / 6;
      if (!inside(px, py)) continue;
      for (const pz of [-hz, hz]) {
        const r = rotate(m, [px, py, pz]);
        out.push([m.position[0]! + r[0], m.position[1]! + r[1], m.position[2]! + r[2]]);
      }
    }
  }
  return out;
}

/** Rotate the member's own long axis into world space — for sampling a RAKED piece. */
const axis = (m: Member): V3 => {
  const [rx, ry, rz] = m.rotation;
  let [x, y, z] = [1, 0, 0] as V3;
  let a = x * Math.cos(rz) - y * Math.sin(rz);
  let b = x * Math.sin(rz) + y * Math.cos(rz);
  x = a; y = b;
  a = y * Math.cos(rx) - z * Math.sin(rx);
  b = y * Math.sin(rx) + z * Math.cos(rx);
  y = a; z = b;
  a = x * Math.cos(ry) + z * Math.sin(ry);
  b = -x * Math.sin(ry) + z * Math.cos(ry);
  return [a, y, b];
};

/** Entry flights carry an `ES<n>` id prefix — one per door, so two doors cannot collide. */
const entryStair = (m: ReturnType<typeof modelOf>) =>
  m.members.filter((x) => (x.role === 'stringer' || x.role === 'tread') && /^ES\d/.test(x.id));

test('EVERY DOOR THE FLOOR LIFTED OUT OF REACH HAS STEPS — and no others do', () => {
  const minRise = OPENING.entryStepMinRiseFt.value as number;
  let withSteps = 0, without = 0;
  for (const fam of FAMILY_TABLE) {
    const m = modelOf(fam.id);
    const openings = openingsOf(m.spec).filter((o) => o.kind === 'door');
    const hasClosingIn = m.stagePlan.some((p) => p.key === 'siding');
    if (openings.length === 0 || !hasClosingIn) continue;
    const rise = (m.levels.subfloorTop ?? 0) - (m.levels.gradeY ?? 0);
    const treads = m.members.filter((x) => x.role === 'tread');
    if (rise >= minRise) {
      withSteps++;
      assert.ok(treads.length > 0,
        `${fam.id}: threshold stands ${rise.toFixed(3)} ft above grade and there is nothing to stand on`);
    } else {
      without++;
      assert.equal(treads.length, 0,
        `${fam.id}: only ${rise.toFixed(3)} ft up — that is a step, not a stair`);
    }
  }
  assert.ok(withSteps >= 5, `only ${withSteps} cards needed steps`);
  assert.ok(without >= 1, 'the threshold rule is exercised in both directions');
});

test('the steps reach the ground and stop at the threshold', () => {
  const m = modelOf('gp-frame');
  const stair = entryStair(m);
  assert.ok(stair.length > 0);
  // THE PIECE AS CUT sits flat on the ground: level cut at the foot, plumb at the head. Drawn as
  // a plain raked stick it did neither — its lower corner stabbed 4.04 in below the earth and its
  // upper corner stood the same distance above the landing, on every stair in the toolkit.
  const stringers = stair.filter((x) => x.role === 'stringer');
  const ys = stringers.flatMap((x) => cutSamples(x).map((p) => p[1]));
  assert.ok(Math.abs(Math.min(...ys) - m.levels.gradeY) < 1e-6,
    `the flight's foot is at y=${Math.min(...ys).toFixed(4)} and the ground is at ${m.levels.gradeY.toFixed(4)}`);
  const sill = Math.min(...m.members.filter((x) => x.role === 'doorBoard').flatMap((b) => box(b).y));
  assert.ok(Math.max(...ys) <= sill + 1e-6,
    `the flight's head reaches y=${Math.max(...ys).toFixed(4)}, above the threshold at ${sill.toFixed(4)}`);
  // The topmost TREAD is one riser below the threshold: the threshold is the last tread.
  const treads = m.members.filter((x) => x.role === 'tread');
  const topTread = Math.max(...treads.flatMap((t) => box(t).y));
  const doorSill = Math.min(...m.members.filter((x) => x.role === 'doorBoard').flatMap((b) => box(b).y));
  const riser = (STAIR.targetRiserIn.value as number) / IN_PER_FT;
  assert.ok(topTread < doorSill - riser / 2,
    `the top tread is at ${topTread.toFixed(4)} and the sill at ${doorSill.toFixed(4)} — that is not a riser apart`);
});

test('NO TREAD IS BURIED IN THE BUILDING', () => {
  // The regression. A flight normally puts a tread at every riser top including the last, flush
  // with the landing — right for a deck you step off sideways onto, wrong for a threshold with a
  // wall in it. Kept, it put 189 cubic inches of tread inside the sole plate and 27 inside the
  // siding, on every door of every raised card.
  //
  // Treads are FLAT and axis-aligned, so their boxes are exactly the piece. The stringers are
  // RAKED and theirs are not — a box round a leaning member spans its whole lean and answers
  // nothing, which is why they are sampled in the next test instead of boxed here.
  for (const id of ['gp-frame', 'sea-hut', 'latrine', 'b-hut', 'squad-hut', 'swa-hut']) {
    const m = modelOf(id);
    const treads = m.members.filter((x) => x.role === 'tread');
    assert.ok(treads.length > 0, `${id} has no treads`);
    const rest = m.members.filter((x) => x.role !== 'tread' && x.role !== 'stringer');
    for (const t of treads) {
      const a = box(t);
      for (const r of rest) {
        const b = box(r);
        const dx = Math.min(a.x[1]!, b.x[1]!) - Math.max(a.x[0]!, b.x[0]!);
        const dy = Math.min(a.y[1]!, b.y[1]!) - Math.max(a.y[0]!, b.y[0]!);
        const dz = Math.min(a.z[1]!, b.z[1]!) - Math.max(a.z[0]!, b.z[0]!);
        assert.ok(dx <= 1e-9 || dy <= 1e-9 || dz <= 1e-9,
          `${id}: ${t.id} runs into ${r.id} (${r.role}) by ${(dx * IN_PER_FT).toFixed(2)} x ${(dy * IN_PER_FT).toFixed(2)} x ${(dz * IN_PER_FT).toFixed(2)} in`);
      }
    }
  }
});

test('and no stringer passes through anything, sampled along its own lean', () => {
  for (const id of ['gp-frame', 'sea-hut', 'latrine']) {
    const m = modelOf(id);
    const stringers = m.members.filter((x) => x.role === 'stringer' && /^ES\d/.test(x.id));
    assert.ok(stringers.length > 0);
    const rest = m.members.filter((x) => x.role !== 'tread' && x.role !== 'stringer');
    for (const s of stringers) {
      for (const p of cutSamples(s)) {
        for (const r of rest) {
          const b = box(r);
          const inside = p[0] > b.x[0]! + 1e-6 && p[0] < b.x[1]! - 1e-6
            && p[1] > b.y[0]! + 1e-6 && p[1] < b.y[1]! - 1e-6
            && p[2] > b.z[0]! + 1e-6 && p[2] < b.z[1]! - 1e-6;
          assert.ok(!inside, `${id}: ${s.id} passes through ${r.id} (${r.role}) at (${p.map((v) => v.toFixed(3)).join(', ')})`);
        }
      }
    }
  }
});

test('the steps are centred on their door and as wide as it', () => {
  const m = modelOf('gp-frame');
  const treads = m.members.filter((x) => x.role === 'tread');
  const doorZ = m.members.filter((x) => x.role === 'doorBoard' && x.wall === 'W').flatMap((b) => box(b).z);
  const stairZ = treads.filter((t) => box(t).x[0]! < 1).flatMap((t) => box(t).z);
  assert.ok(doorZ.length > 0 && stairZ.length > 0);
  const mid = (v: number[]) => (Math.min(...v) + Math.max(...v)) / 2;
  assert.ok(Math.abs(mid(doorZ) - mid(stairZ)) < 0.02,
    `the stair is centred at ${mid(stairZ).toFixed(3)} and the door at ${mid(doorZ).toFixed(3)}`);
  const width = Math.max(...stairZ) - Math.min(...stairZ);
  assert.ok(Math.abs(width - (OPENING.doorWidthFt.value as number)) < 1e-6,
    `the stair is ${width.toFixed(3)} ft wide against a ${OPENING.doorWidthFt.value} ft door`);
});

test('entrySteps: false takes them away again', () => {
  // The flag exists so a card that genuinely wants none — a drawing of the frame, a building
  // against a loading dock — can say so. It defaults ON because a door out of reach is not a
  // design choice.
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame')!.preset)) as Record<string, unknown>;
  spec.entrySteps = false;
  const m = generateStructure(spec as unknown as StructureSpec);
  assert.equal(m.members.filter((x) => x.role === 'tread').length, 0);
  assert.ok(m.members.filter((x) => x.role === 'doorBoard').length > 0, 'the door is still hung');
});

test('A FLIGHT OF N RISERS HAS N−1 TREADS — the last surface is the landing', () => {
  // This started as an `omitTopTread` flag, opt-in, added when the entry stair's top tread turned
  // up buried in a sole plate. It was the general rule wearing a local name: every OTHER caller
  // put a tread at the landing too, and on the loading platform that tread sat inside the deck
  // planks it arrived at — 14 in³ of one solid inside another. Nobody steps on it; you step onto
  // the deck. The flag is gone and the rule is here.
  //
  // Checked on a plain flight — where the arithmetic is visible — and then on every family that
  // actually builds one.
  const flight = generateStair({
    base: [0, 0], up: [1, 0], baseY: 0, topY: 6, widthFt: 3, stage: 1,
  });
  const treads = flight.members.filter((x) => x.role === 'tread').length;
  const risers = flight.flights.reduce((n, f) => n + f.risers, 0);
  assert.equal(treads, risers - flight.flights.length,
    `${treads} treads for ${risers} risers over ${flight.flights.length} flight(s)`);
  assert.ok(treads > 1);
  for (const id of ['tower', 'platform']) {
    const m = modelOf(id);
    assert.ok(m.members.some((x) => x.role === 'tread' || x.role === 'ladderRung'), `${id} still has a way up`);
  }
});

test('EVERY TREAD SITS ON ITS OWN STEP — none of them hangs off the end of the flight', () => {
  // `base` is documented as "the nose of the lowest riser", and the generator CENTRED tread i on
  // the nose line (i−1) runs along from it. So every tread sat half its own depth downhill of the
  // step it belongs to, and the bottom one hung entirely clear of the stringers: measured on the
  // loading platform, the lowest two treads had 0% of their underside over stringer material, and
  // in a side elevation of a hut's entry steps the treads read as loose boards floating beside
  // the stringer with the lowest one detached in mid-air.
  //
  // Measured ALONG THE FLIGHT rather than in world x/z, because a stair can run any direction and
  // a switchback runs two.
  for (const id of ['gp-frame', 'platform', 'sea-hut']) {
    const m = modelOf(id);
    const treads = m.members.filter((x) => x.role === 'tread');
    assert.ok(treads.length > 0, `${id} has no treads`);
    const stringers = m.members.filter((x) => x.role === 'stringer');
    assert.ok(stringers.length > 0, `${id} has no stringers`);
    for (const t of treads) {
      // The flight this tread belongs to: the stringers at its own height band and heading.
      const dir = axis(t); // a tread's length runs ACROSS the stair
      const up: V3 = [-dir[2]!, 0, dir[0]!]; // so the direction of travel is square to it, in plan
      const mine = stringers.filter((s) => Math.abs(axis(s)[0]! * up[0]! + axis(s)[2]! * up[2]!) > 0.5);
      assert.ok(mine.length > 0, `${id}: no stringer runs the way ${t.id} is laid across`);
      // Project both onto the direction of travel and demand the tread lie within the run the
      // stringers cover. The stringers are sampled AS CUT — their raw boxes span the whole lean.
      const proj = (p: V3): number => p[0]! * up[0]! + p[2]! * up[2]!;
      const sPts = mine.flatMap((s) => cutSamples(s).map(proj));
      const lo = Math.min(...sPts);
      const hi = Math.max(...sPts);
      const th: V3 = [t.cutLength / 24, t.actual.d / 24, t.actual.w / 24];
      const tPts: number[] = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const r = rotate(t, [sx * th[0], sy * th[1], sz * th[2]]);
        tPts.push(proj([t.position[0] + r[0], t.position[1] + r[1], t.position[2] + r[2]]));
      }
      assert.ok(Math.min(...tPts) >= lo - 1e-6 && Math.max(...tPts) <= hi + 1e-6,
        `${id}: ${t.id} runs ${Math.min(...tPts).toFixed(4)}..${Math.max(...tPts).toFixed(4)} along a flight `
        + `that runs ${lo.toFixed(4)}..${hi.toFixed(4)} — ${(Math.max(lo - Math.min(...tPts), Math.max(...tPts) - hi) * IN_PER_FT).toFixed(2)} in of it is off the end`);
    }
  }
});

/** Undo a member's YXZ euler — world offset back into the board's own frame. */
function unrotate(m: Member, v: V3): V3 {
  const [rx, ry, rz] = m.rotation;
  let [x, y, z] = v;
  let a = x * Math.cos(-ry) + z * Math.sin(-ry);
  let b = -x * Math.sin(-ry) + z * Math.cos(-ry);
  x = a; z = b;
  a = y * Math.cos(-rx) - z * Math.sin(-rx);
  b = y * Math.sin(-rx) + z * Math.cos(-rx);
  y = a; z = b;
  a = x * Math.cos(-rz) - y * Math.sin(-rz);
  b = x * Math.sin(-rz) + y * Math.cos(-rz);
  return [a, b, z];
}

/** Is a world point inside the stringer AS CUT? Exact, against the profile polygon itself. */
function insideStringer(s: Member, p: V3): boolean {
  const l = unrotate(s, [p[0] - s.position[0], p[1] - s.position[1], p[2] - s.position[2]]);
  if (Math.abs(l[2]) > s.actual.w / 24) return false;
  const prof = stringerEndProfile(s);
  let hit = false;
  for (let i = 0, j = prof.length - 1; i < prof.length; j = i++) {
    const [xi, yi] = prof[i]!; const [xj, yj] = prof[j]!;
    if ((yi > l[1]) !== (yj > l[1]) && l[0] < ((xj - xi) * (l[1] - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

test('and every tread has stringer under it, not merely beside it', () => {
  // The other half of the same defect, and the one the render showed first: the bottom treads
  // were not short of bearing, they had NONE. Measured on the loading platform before the fix,
  // treads 1 and 2 had 0% of their underside over stringer material and tread 3 had 15%; on a
  // hut's entry steps the bottom tread was 0% and half of it stood past the end of the stringers.
  //
  // Asked exactly — a point either is or is not inside the cut profile — rather than by sampling
  // the stringer and hoping a sample lands in the thin band under a 1½-in board. The first
  // version of this test did the latter and failed on the FIXED model, reporting "no stringer
  // under any part of it" for a tread with 28% bearing.
  for (const id of ['gp-frame', 'platform', 'sea-hut']) {
    const m = modelOf(id);
    const treads = m.members.filter((x) => x.role === 'tread');
    const stringers = m.members.filter((x) => x.role === 'stringer');
    assert.ok(treads.length > 0 && stringers.length > 0, `${id} has no stair`);
    for (const t of treads) {
      const tb = box(t);
      const run = tb.x[1]! - tb.x[0]! < tb.z[1]! - tb.z[0]! ? 0 : 2;
      const [u0, u1] = run === 0 ? tb.x : tb.z;
      let on = 0;
      let total = 0;
      for (const s of stringers) {
        const across = s.position[run === 0 ? 2 : 0];
        if (across < (run === 0 ? tb.z[0]! : tb.x[0]!) || across > (run === 0 ? tb.z[1]! : tb.x[1]!)) continue;
        for (let k = 0; k <= 40; k++) {
          const u = u0! + ((u1! - u0!) * k) / 40;
          total++;
          const p: V3 = run === 0 ? [u, tb.y[0]! - 0.004, across] : [across, tb.y[0]! - 0.004, u];
          if (insideStringer(s, p)) on++;
        }
      }
      assert.ok(total > 0, `${id}: ${t.id} has no stringer across it at all`);
      assert.ok(on > 0,
        `${id}: ${t.id} has 0 of ${total} points of its underside over stringer material — it is standing in the air`);
    }
  }
});

test('A STRINGER IS CUT LEVEL AT THE FOOT AND PLUMB AT THE HEAD, on every stair in the toolkit', () => {
  // The shared fix, checked on every consumer of `generateStair` rather than on the one that
  // prompted it. A cut is "level" when its face is horizontal in the WORLD and "plumb" when it is
  // vertical — which for a pitched board means the cut is not square to the board, and is exactly
  // why a plain box got it wrong at both ends.
  const cases: [string, (s: Record<string, unknown>) => void][] = [
    ['gp-frame', () => {}],
    ['tower', (s) => { s.platformHeightFt = 24; }],
    ['platform', () => {}],
  ];
  let checked = 0;
  for (const [id, patch] of cases) {
    const spec = JSON.parse(JSON.stringify(familyById(id as never)!.preset)) as Record<string, unknown>;
    patch(spec);
    const m = generateStructure(spec as unknown as StructureSpec);
    // The frozen basement stair and the platform's RAMP are not `generateStair`'s — different
    // emitters, recorded separately, deliberately out of this change.
    for (const s of m.members.filter((x) => x.role === 'stringer' && !x.id.startsWith('FL-') && !x.id.startsWith('PF-'))) {
      checked++;
      const pts = cutSamples(s);
      const lo = Math.min(...pts.map((p) => p[1]));
      const hi = Math.max(...pts.map((p) => p[1]));
      // Level foot: every point at the bottom of the piece shares one height.
      const atFoot = pts.filter((p) => p[1] < lo + 1e-6);
      assert.ok(atFoot.length >= 4, `${id}/${s.id}: the foot is a point, not a level face`);
      // Plumb head: every point at the top shares one height too — the landing.
      const atHead = pts.filter((p) => p[1] > hi - 1e-6);
      assert.ok(atHead.length >= 2, `${id}/${s.id}: the head is a point, not a plumb face`);
      // And the piece spans exactly the flight: no corner outside the run it belongs to.
      const half = s.cutLength / 24;
      const d = axis(s);
      const ends = [s.position[1]! - d[1] * half, s.position[1]! + d[1] * half];
      const dropIn = ((Math.min(...ends) - lo) * IN_PER_FT);
      assert.ok(Math.abs(dropIn) < 1e-6 || dropIn < 0,
        `${id}/${s.id}: the cut foot still hangs ${dropIn.toFixed(3)} in below the flight`);
    }
  }
  assert.ok(checked >= 12, `only ${checked} stringers checked`);
});

test('and the profile is a plain rectangle when there is no pitch to cut against', () => {
  // A level "stair" is not a stair and neither cut is defined on one, so the honest answer is to
  // change nothing rather than to produce a degenerate shape.
  const flat = { cutLength: 60, actual: { w: 1.5, d: 11.25 }, rotation: [0, 0, 0] as [number, number, number] };
  assert.deepEqual(stringerEndProfile(flat), [[-2.5, -0.46875], [2.5, -0.46875], [2.5, 0.46875], [-2.5, 0.46875]]);
  // And it never eats so much of the board that the piece stops being one.
  const steep = { cutLength: 24, actual: { w: 1.5, d: 11.25 }, rotation: [0, 0, 1.5] as [number, number, number] };
  const p = stringerEndProfile(steep);
  const xs = p.map((q) => q[0]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0, 'the piece still has length');
  assert.ok(p.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])), 'no infinities from a near-vertical cut');
});

test('the top edge of a stringer IS the line of the nosings', () => {
  // Half the board belongs below the treads and none of it above. Centred on that line — which is
  // what it was — a 2x12 stood 4 in proud of every tread it carried.
  const m = modelOf('gp-frame');
  const stringers = m.members.filter((x) => x.role === 'stringer' && /^ES\d/.test(x.id));
  const treads = m.members.filter((x) => x.role === 'tread' && /^ES\d/.test(x.id));
  assert.ok(stringers.length > 0 && treads.length > 0);
  const stringerTop = Math.max(...stringers.flatMap((s) => cutSamples(s).map((p) => p[1])));
  const treadTop = Math.max(...treads.flatMap((t) => box(t).y));
  assert.ok(stringerTop >= treadTop - 1e-6, 'the stringers carry the treads');
  // No stringer point stands above the landing the flight arrives at.
  const sill = Math.min(...m.members.filter((x) => x.role === 'doorBoard').flatMap((b) => box(b).y));
  assert.ok(stringerTop <= sill + 1e-6,
    `a stringer reaches ${stringerTop.toFixed(4)}, above the threshold at ${sill.toFixed(4)}`);
});
