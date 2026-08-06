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
