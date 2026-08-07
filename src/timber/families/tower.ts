// TIMBER-2 T4 — the guard tower (plan §7 T4). The owner's first-named type.
//
// A tower is the first structure in this tool where getting it wrong drops someone, so the
// module is arranged around that rather than around the framing:
//
//   · Every magnitude it uses is LS-tagged in `doctrine.TOWER` / RAIL / LADDER / STAIR, which
//     means changing one is not a quiet edit — it moves a row in the life-safety register.
//   · `normalizeSpec` FORCES a stair above the fixed-ladder cage threshold and says so as a
//     visible issue. This module does not second-guess that; it builds what it is handed.
//   · The platform is railed on every edge the access does not occupy, from `railRequired`, not
//     from a flag someone could forget to set.
//
// GEOMETRY. Four legs on a square plan, battered inward so the base is wider than the cab —
// that batter is what makes a tall timber tower stand up, and it is why nothing here can assume
// the legs are vertical. Bays of girts up the legs, an X-brace in every bay on every face, a
// framed platform, and a cab on top.

import type { Member } from '../types';
import { DRESSED } from '../types';
import type { TowerSpec } from '../spec';
import { makeEmitter } from '../emit';
import { TOWER, RAIL, PANEL, HUT, LUMBER, STAIR, TOLERANCE, IN_PER_FT, citeOf } from '../doctrine';
import { stagePlan, requireOrdinal, type StagePlanEntry } from '../stagePlan';
import { generateRailing, railRequired, type RailEdge } from '../subsystems/railings';
import { generateLadder, generateStair } from '../subsystems/access';
import { pyramidPlanes, type RoofPlane } from '../subsystems/roofFamilies';
import { generateRoofCovering } from '../subsystems/coverings';
import type { FloorLevels } from '../floor';

/** Guard against a divide-by-zero on a degenerate height. Arithmetic, not doctrine. */
const EPS_FT = 1e-6;

/**
 * The cab's corner posts. Named because TWO passes have to agree on them: the guardrail is told
 * they are standing so it does not put its own post in the same hole, and the cab emits them.
 */
const CAB_POST_NOMINAL = '4x4';

export interface TowerResult {
  members: Member[];
  levels: FloorLevels;
  stagePlan: StagePlanEntry[];
}

export function towerStagePlan(): StagePlanEntry[] {
  return stagePlan([
    { key: 'layout', label: 'Layout & footings', detail: 'Four footings set square to each other — a tower out of square cannot be braced true.' },
    { key: 'foundation', label: 'Legs raised', detail: 'Legs stood on the footings, battered inward so the base is wider than the top.' },
    { key: 'walls', label: 'Girts & bracing', detail: 'Girts tie the legs at every bay and the X-braces triangulate each face. This is what carries wind, not the legs.' },
    { key: 'platform', label: 'Platform framed', detail: 'Joists across the legs at working height, decked solid.' },
    { key: 'railings', label: 'Guardrails', detail: 'Top rail, midrail and toe board around every open edge (EM 385-1-1).' },
    { key: 'stairs-access', label: 'Access', detail: 'The way up: a ladder with its rails run past the landing, or a switchback stair.' },
    { key: 'plates', label: 'Cab framed', detail: 'Cab walls on the platform — open rail, half-wall, or half-wall with screen above.' },
    { key: 'roof-frame', label: 'Cab roof framed', detail: 'Hips to a peak, or a single slope, over the cab.' },
    { key: 'roofing', label: 'Cab roofed', detail: 'Covering over the cab roof, laid from the eave up.' },
  ]);
}

/**
 * Plan half-width of the leg square at a given height, from the batter.
 *
 * `baseY` is where the LEGS start, which is not always grade: a timber mudsill is a footing that
 * lies ON the ground, so the legs it carries begin at its top. The batter is a property of the
 * legs — "the base is wider than the cab by this much per side", and the base of a leg is its
 * foot — so it is measured over the leg's own climb. Left at 0 this is the old formula exactly,
 * which is what a concrete pad wants: the pad is poured below grade, the legs start on grade.
 */
function halfAt(spec: TowerSpec, y: number, baseY = 0, topY: number = spec.platformHeightFt): number {
  const top = spec.cabPlanFt / 2;
  const batter = TOWER.batterPerSideFt.value as number;
  // OVER THE LEG'S OWN CLIMB, top AND bottom. `baseY` moved the bottom of that span when a mudsill
  // raised the feet; `topY` moves the top now that a leg stops under the platform frame rather
  // than at the deck. Left at the platform height it is the old formula exactly. Measure it over
  // the wrong span and the leg simply does not batter what the card locks: 1.4417 ft per side
  // against the doctrinal 1.5, which the LS register's own test catches.
  const h = Math.max(EPS_FT, topY - baseY);
  // Linear batter: widest at the leg's foot, narrowing to the cab plan at the platform.
  return top + batter * (1 - Math.min(1, Math.max(0, (y - baseY) / h)));
}

/** The four legs' plan positions at a height, in a fixed corner order. */
function cornersAt(spec: TowerSpec, y: number, baseY = 0, topY: number = spec.platformHeightFt): [number, number][] {
  const h = halfAt(spec, y, baseY, topY);
  const c = spec.cabPlanFt / 2 + (TOWER.batterPerSideFt.value as number);
  // Origin at the base square's front-left corner keeps the tower in the same +X/+Z quadrant
  // every other family uses, so one camera rig frames all of them.
  return [
    [c - h, c - h], [c + h, c - h], [c + h, c + h], [c - h, c + h],
  ];
}

type V3 = [number, number, number];

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * The outward unit normal of one FACE of a battered frame — the plane through the two legs that
 * bound it. It is not horizontal: the legs rake, so the face leans in with them, and a member laid
 * on that face has to be offset along this rather than along the horizontal. Offsetting sideways
 * instead leaves `cos(batter)` of the intended clearance, which on this tower is 0.39 in of a
 * brace still inside its leg.
 */
function faceNormal(bot: readonly [number, number], botB: readonly [number, number],
  top: readonly [number, number], climb: number, centre: number): V3 {
  const along: V3 = [botB[0] - bot[0], 0, botB[1] - bot[1]];
  const up: V3 = [top[0] - bot[0], climb, top[1] - bot[1]];
  const n = unit(cross(along, up));
  const mid: V3 = [(bot[0] + botB[0]) / 2 - centre, 0, (bot[1] + botB[1]) / 2 - centre];
  return dot3(n, mid) < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/**
 * How far a leg's section reaches from its own axis along a direction — half its width only when
 * the two are square to each other. A battered leg carries rotation `[rx, 0, rz]`, which tilts the
 * section with it, so the reach is the support of the rotated box along `n`: with `ry = 0` the
 * section's own axes are `Rx·Rz·(0,1,0)` and `Rx·Rz·(0,0,1)`.
 */
function legReach([rx, rz]: readonly [number, number], n: V3, widthFt: number): number {
  const eY: V3 = [-Math.sin(rz), Math.cos(rz) * Math.cos(rx), Math.cos(rz) * Math.sin(rx)];
  const eZ: V3 = [0, -Math.sin(rx), Math.cos(rx)];
  return (widthFt / 2) * (Math.abs(dot3(eY, n)) + Math.abs(dot3(eZ, n)));
}

/**
 * How far along `dir` a ray leaving a leg's own axis travels before it comes out through the side
 * of the leg — which is where a member BUTTING that leg has to stop.
 *
 * Not the same figure as `legReach`, and the difference is the whole reason a shortened girt was
 * still 0.29 in inside its leg. `legReach` is the support of the box, which is the right answer for
 * standing something OFF a face square to it; a girt runs horizontally into a RAKED leg, so its
 * direction has a component along the leg's own length, and the ray leaves through a side face that
 * is tilted to it. For a square section the exit is `(w/2) / max(|dir·e_y|, |dir·e_z|)`, which is
 * the support again whenever `dir` is square to the leg and larger whenever it is not.
 */
function legFaceAlong([rx, rz]: readonly [number, number], dir: V3, widthFt: number): number {
  const eY: V3 = [-Math.sin(rz), Math.cos(rz) * Math.cos(rx), Math.cos(rz) * Math.sin(rx)];
  const eZ: V3 = [0, -Math.sin(rx), Math.cos(rx)];
  const face = Math.max(Math.abs(dot3(eY, dir)), Math.abs(dot3(eZ, dir)), EPS_FT);
  return widthFt / 2 / face;
}

/** Everything that makes up the tower's own frame — what an access route has to stand clear of. */
const FRAME_ROLES: string[] = ['towerLeg', 'girt', 'towerBrace', 'sill', 'footing'];

/**
 * How far a member reaches along world Z, `dir` being -1 for its nearest face and +1 for its
 * farthest. Used to read the frame's outermost line off the members ACTUALLY EMITTED rather than
 * re-deriving it from the batter — the bracing's standoff and the legs' own section are part of
 * that line, and a second derivation of it is a second thing to keep in step.
 */
function planReach(m: Member, dir: -1 | 1): number {
  const [rx, ry, rz] = m.rotation;
  const half: V3 = [m.cutLength / IN_PER_FT / 2, m.actual.d / IN_PER_FT / 2, m.actual.w / IN_PER_FT / 2];
  let reach = 0;
  for (const [i, h] of half.entries()) {
    const v: V3 = [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0];
    // Rotate the unit axis by the scene's YXZ euler and take its Z part.
    let [x, y, z] = v;
    let a = x * Math.cos(rz) - y * Math.sin(rz);
    let b = x * Math.sin(rz) + y * Math.cos(rz);
    x = a; y = b;
    a = y * Math.cos(rx) - z * Math.sin(rx);
    b = y * Math.sin(rx) + z * Math.cos(rx);
    y = a; z = b;
    reach += h * Math.abs(-x * Math.sin(ry) + z * Math.cos(ry));
  }
  return m.position[2] + dir * reach;
}

export function generateTower(spec: TowerSpec): TowerResult {
  const emit = makeEmitter('TW');
  const plan = towerStagePlan();
  const sLayout = requireOrdinal(plan, 'layout');
  const sLegs = requireOrdinal(plan, 'foundation');
  const sBrace = requireOrdinal(plan, 'walls');
  const sPlatform = requireOrdinal(plan, 'platform');
  const sRail = requireOrdinal(plan, 'railings');
  const sAccess = requireOrdinal(plan, 'stairs-access');
  const sCab = requireOrdinal(plan, 'plates');
  const sRoof = requireOrdinal(plan, 'roof-frame');
  const sRoofing = requireOrdinal(plan, 'roofing');

  const H = spec.platformHeightFt;
  const legNominal = TOWER.legNominal.value as string;
  const girtNominal = TOWER.girtNominal.value as string;
  const braceNominal = TOWER.braceNominal.value as string;
  const joistNominal = TOWER.platformJoistNominal.value as string;
  const bay = TOWER.bayHeightFt.value as number;
  const legW = DRESSED[legNominal]!.d / IN_PER_FT;
  const girtD = DRESSED[girtNominal]!.d / IN_PER_FT;
  /** Hoisted out of the platform block: the top girt is what the joists bear on. */
  const joistDepth = DRESSED[joistNominal]!.d / IN_PER_FT;
  /** The tower's centre in plan — `cornersAt` strikes the base square from the same figure. */
  const planCentre = spec.cabPlanFt / 2 + (TOWER.batterPerSideFt.value as number);

  // ── Footings
  //
  // A LEG STANDS ON ITS FOOTING; IT IS NOT DRIVEN THROUGH IT. The two footings this family offers
  // put their bearing surface in different places, and the legs only ever knew about one of them.
  // A concrete pad is poured BELOW grade, so its top is grade and a leg starting at y = 0 lands on
  // it. A timber mudsill is bedded ON the ground — that is what a mudsill is for, spreading the
  // load over tamped fill rather than a hole — so its top is a 6x8's thickness up. Starting the
  // legs at grade regardless put 5 7/8 in of every leg inside the sill it was supposed to bear on,
  // with the tower standing on the earth between four timbers it passed straight through.
  //
  // The same fault, and the same fix, as the loading platform's posts on skids.
  const mudNominal = TOWER.mudsillNominal.value as string;
  const legBaseY = spec.footing === 'concrete-pad' ? 0 : DRESSED[mudNominal]!.w / IN_PER_FT;
  // A LEG STOPS UNDER THE PLATFORM IT CARRIES. It was run to `H`, which is the DECK SURFACE, so
  // the top 7¼ in of every leg stood in the same space as the platform joists — the two outermost
  // joists sit on the leg lines by construction and each ran through two corner legs, 2.74 in a
  // piece. Stopped at the joists' undersides, which is where the top girt now tops out as well,
  // the whole platform frame sits ON the legs instead of inside them; and because the batter is
  // struck over the leg's own climb, the frame still opens out by exactly what the card locks.
  const legTopY = H - joistDepth;
  // The base square in PLAN is unchanged by this: the batter is measured over the leg's own
  // climb, so a leg's foot is `batterPerSideFt` wider than the cab wherever that foot sits.
  const base = cornersAt(spec, legBaseY, legBaseY, legTopY);
  if (spec.footing === 'concrete-pad') {
    for (const [x, z] of base) {
      const side = (TOWER.padSideIn.value as number) / IN_PER_FT;
      const depth = (TOWER.padDepthIn.value as number) / IN_PER_FT;
      emit('footing', `conc pad ${TOWER.padSideIn.value}x${TOWER.padSideIn.value}x${TOWER.padDepthIn.value}`, {
        cutLengthFt: side,
        position: [x, -depth / 2, z],
        rotation: [-Math.PI / 2, 0, 0], // flat: pad depth is the VERTICAL dimension

        stage: sLayout,
        actual: { w: TOWER.padDepthIn.value as number, d: TOWER.padSideIn.value as number },
        nailing: 'poured on undisturbed soil (PH)',
        doctrineRef: 'TM 5-302 tower footing (PH)',
      });
    }
  } else {
    const mudLen = TOWER.mudsillLengthFt.value as number;
    for (const [x, z] of base) {
      emit('sill', mudNominal, {
        cutLengthFt: mudLen,
        // A mudsill spreads load, so it lies on its BROAD face — the whole point of the piece.
        // On edge it was a 7 1/4-in fin under each leg, bearing on 1 1/2 in of dirt.
        position: [x, legBaseY / 2, z],
        rotation: [-Math.PI / 2, 0, 0],
        stage: sLayout,
        nailing: 'bedded on tamped fill; leg drift-pinned (PH)',
        doctrineRef: citeOf(TOWER.mudsillNominal),
      });
    }
  }

  // ── Legs. Battered, so each is a raked member: length is the hypotenuse and the tilt is
  // toward the tower's centre.
  // The legs' own climb, which is the platform height less whatever the footing holds them up
  // by. Everything framed BETWEEN the legs — the girts, the braces, the bays they divide — is
  // measured over this, not over the height above grade. Left on grade, the bottom bay's girt
  // and both its diagonals ended 5 7/8 in below the feet they were supposed to be bolted to.
  const climb = legTopY - legBaseY;
  const topCorners = cornersAt(spec, legTopY, legBaseY, legTopY);
  /** Each leg's [rx, rz], kept so the bracing knows where the face of the leg it lands on is. */
  const legRot: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = base[i]!;
    const [x1, z1] = topCorners[i]!;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const lenFt = Math.hypot(Math.hypot(dx, dz), climb);
    // A LEG'S SECTION IS SQUARE TO THE FRAME. It used to be yawed onto the lean direction and
    // then pitched up, which puts the axis in the right place and takes the SECTION with it: a
    // corner leg leans diagonally, so its 6x6 came out turned 45° in plan, presenting its 7¾-in
    // diagonal along the tower's own axes with an arris facing every girt. The girts and braces
    // are square to the frame (`yaw` 0 or a right angle) and are bolted to the legs, and you
    // cannot bolt a flat 2x6 to an edge. It reads as a diamond post with a line down its middle
    // and a step where every girt lands.
    //
    // Under YXZ the yaw is the term that spins the section, so the fix is to do the lean with
    // the OTHER two and leave the yaw at zero. Solving R·(1,0,0) = (dx, climb, dz)/len for
    // ry = 0 gives one answer:
    //
    //     rx = atan2(dz, climb)                     — the lean across
    //     rz = atan2(hypot(climb, dz), dx)          — the lean along, and the rake
    //
    // which sends local Z to (0, −sin rx, cos rx) and local Y to (−sin rz, …) — both faces
    // square to the frame, tilted only by the lean itself. With no batter it degenerates to
    // [0, 0, PI/2], a plumb post, which is what it should be.
    const rx = Math.atan2(dz, climb);
    const rz = Math.atan2(Math.hypot(climb, dz), dx);
    legRot.push([rx, rz]);
    // A LEG'S AXIS RUNS CORNER TO CORNER, and its square end cut is an artifact this file already
    // owns: `timber2-tower-footing` states in so many words that the axis starts on the bearing
    // plane and that a square cut at this pitch leaves 0.547 in below it. The same 0.547 in stands
    // proud at the HEAD, where it clips the two outermost joists by 0.149 in once they run out to
    // the girts. Trimming either end was tried and is wrong twice over: the batter the card locks
    // is measured between the axis ENDS, so a trimmed leg batters 1.4954 ft per side instead of
    // 1.5, and the foot then floats over the sill it is supposed to stand on.
    emit('towerLeg', legNominal, {
      cutLengthFt: lenFt,
      position: [(x0 + x1) / 2, (legBaseY + legTopY) / 2, (z0 + z1) / 2],
      rotation: [rx, 0, rz],
      stage: sLegs,
      nailing: 'drift-pinned at the sill; bolted at every girt (PH)',
      doctrineRef: citeOf(TOWER.legNominal),
    });
  }

  // ── Girts and X-braces, bay by bay, on all four faces.
  const bays = Math.max(1, Math.round(climb / bay));
  for (let b = 1; b <= bays; b++) {
    const yTop = legBaseY + (climb * b) / bays;
    const yBot = legBaseY + (climb * (b - 1)) / bays;
    const top = cornersAt(spec, yTop, legBaseY, legTopY);
    const bot = cornersAt(spec, yBot, legBaseY, legTopY);
    for (let f = 0; f < 4; f++) {
      const a = top[f]!;
      const c = top[(f + 1) % 4]!;
      const run = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const yaw = Math.atan2(-(c[1] - a[1]), c[0] - a[0]);
      // A GIRT IS FRAMED BETWEEN THE LEGS. It was cut to the distance between the two leg
      // CENTRES and centred on that line, so both of its ends were buried in a leg — 3.02 in
      // of a 5½-in leg — and the girts of two adjacent faces, both running to the same corner,
      // were inside each other there as well. The bracing is what goes ON the face; the girt is
      // the piece it is applied over, so it stops at the wood.
      //
      // The stop is the LEG's reach along the girt's own run, not half the leg's width: the legs
      // are battered, so their sections are tilted and the inner face is further along the run
      // than a plumb post's would be.
      //
      // AND THE TOP ONE CARRIES THE PLATFORM. It sat at the leg tops, which is the DECK SURFACE,
      // so on every tower it ran through all 16 platform joists, the decking over them, the four
      // cab posts, and the railing's posts and toe boards standing on the deck — 37 pairs of
      // solid members in the same space. It is the bearing line for the joists, so its top edge
      // belongs at their undersides.
      const yGirt = b === bays ? H - joistDepth - girtD / 2 : yTop;
      // A board is CUT SQUARE, and the gap it has to fit narrows as it goes up: the legs splay
      // downward, so the tightest place on a 5½-in-deep girt is its TOP arris, not its centre.
      // Struck at the centre, every girt still bit 0.27 in into both legs along its bottom edge —
      // the same shape of mistake as a rafter's plumb cut measured to the centre line.
      const tight = cornersAt(spec, yGirt + girtD / 2, legBaseY, legTopY);
      const tA = tight[f]!;
      const tC = tight[(f + 1) % 4]!;
      const tRun = Math.hypot(tC[0] - tA[0], tC[1] - tA[1]);
      const u: V3 = [(tC[0] - tA[0]) / (tRun || 1), 0, (tC[1] - tA[1]) / (tRun || 1)];
      const cutA = legFaceAlong(legRot[f]!, u, legW);
      const cutC = legFaceAlong(legRot[(f + 1) % 4]!, u, legW);
      const clear = tRun - cutA - cutC;
      if (clear > TOLERANCE.minSliverFt) {
        emit('girt', girtNominal, {
          cutLengthFt: clear,
          position: [
            (tA[0] + tC[0]) / 2 + (u[0] * (cutA - cutC)) / 2,
            yGirt,
            (tA[1] + tC[1]) / 2 + (u[2] * (cutA - cutC)) / 2,
          ],
          rotation: [0, yaw, 0],
          stage: sBrace,
          nailing: 'bolted to each leg (PH)',
          doctrineRef: citeOf(TOWER.girtNominal),
        });
      }
      // The X: two diagonals per face, corner to opposite corner of the bay.
      //
      // A BRACE IS BOLTED TO THE FACE OF THE FRAME, so it cannot be IN the frame. Both diagonals
      // were drawn on the legs' own centre plane, corner centre to corner centre, which put every
      // one of them inside the two legs it braces — 3.85 in of a 5½-in leg at the worst corner,
      // 32 pairs — and, since the two of them share that plane, inside EACH OTHER at the crossing:
      // 40 pairs, 2.67 in. The render shows the X as two sticks fighting for the same pixels in
      // the middle of every bay, on all four faces of every bay of the tower.
      //
      // Laid on the face: the first diagonal's inner face lands on the legs' outer faces and the
      // second lies on the first, which is what bolting two 2x6 diagonals over a leg actually
      // makes. `legReach` is what settles it — a BATTERED leg's section is tilted, so how far it
      // stands out from its own axis is not half its width but the support of a raked box along
      // the face normal, and reading it off the leg's own rotation keeps the two together if the
      // batter ever changes.
      const braceT = DRESSED[braceNominal]!.w / IN_PER_FT;
      const aB = bot[f]!;
      const cB = bot[(f + 1) % 4]!;
      const n = faceNormal(aB, cB, a, yTop - yBot, planCentre);
      const stand = Math.max(legReach(legRot[f]!, n, legW), legReach(legRot[(f + 1) % 4]!, n, legW));
      for (const [k, [p, q]] of ([[aB, c], [cB, a]] as const).entries()) {
        const dRise = yTop - yBot;
        const off = stand + braceT / 2 + k * braceT;
        // AND IT LIES FLAT ON THE FACE. The rotation was built from the PLAN run and the rise
        // alone, which leaves the board on edge in a VERTICAL plane; the face it is bolted to
        // leans with the legs, and the two diagonals of one X lean opposite ways in plan, so
        // their two vertical planes cross at about 10° and no amount of offsetting separates
        // them. Built from the face's own frame — length along the true 3D run, thickness along
        // the face normal — the board is where a bolted brace is, and stacking the second one on
        // the first is then just one thickness along that normal.
        //
        // The Euler triple that does it, for R = Ry·Rx·Rz with the third column equal to `n` and
        // the first equal to the unit run: rx = asin(-n_y), ry = atan2(n_x, n_z), and
        // rz = atan2(t_y, b_y) where b = n x t. With no batter n is horizontal and it collapses
        // to the old [0, yaw, rake] exactly.
        const t = unit([q[0] - p[0], dRise, q[1] - p[1]]);
        const b3 = unit(cross(n, t));
        emit('towerBrace', braceNominal, {
          cutLengthFt: Math.hypot(Math.hypot(q[0] - p[0], q[1] - p[1]), dRise),
          position: [(p[0] + q[0]) / 2 + n[0] * off, (yBot + yTop) / 2 + n[1] * off, (p[1] + q[1]) / 2 + n[2] * off],
          rotation: [Math.asin(-n[1]), Math.atan2(n[0], n[2]), Math.atan2(t[1], b3[1])],
          stage: sBrace,
          nailing: 'bolted at both ends and where the diagonals cross (PH)',
          doctrineRef: citeOf(TOWER.braceNominal),
        });
      }
    }
  }

  // ── Platform: joists across the leg square, decked.
  const deckHalf = spec.cabPlanFt / 2;
  const cx = planCentre;
  const deckY = H;
  const joistY = deckY - joistDepth / 2;
  const joistSpacing = spec.spacing.joistSpacingIn / IN_PER_FT;
  const span = spec.cabPlanFt;
  // A JOIST IS AS LONG AS THE THING IT BEARS ON. Cut to the cab plan, which is the leg square at
  // the DECK, every joist stopped 0.05 in inside the girt beneath it — the girts are struck a
  // joist's depth lower, where the batter has already carried the frame 0.7 in further out, so a
  // joist's end kissed the girt's inner arris instead of sitting on it. Run to the girts' outer
  // faces it has the full 1½ in.
  const girtT = DRESSED[girtNominal]!.w / IN_PER_FT;
  const joistLen = 2 * (halfAt(spec, legTopY, legBaseY, legTopY) + girtT / 2);
  const nJoists = Math.max(2, Math.floor(span / joistSpacing) + 1);
  for (let i = 0; i < nJoists; i++) {
    const z = cx - deckHalf + (span * i) / (nJoists - 1);
    emit('joist', joistNominal, {
      cutLengthFt: joistLen,
      position: [cx, joistY, z],
      rotation: [0, 0, 0],
      stage: sPlatform,
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: citeOf(TOWER.platformJoistNominal),
    });
  }
  // THE PLATFORM DECK IS SHEETS, NOT ONE SLAB. It used to be emitted as a single panel the full
  // size of the platform, standing on edge — which is both the plywood slab the owner found
  // hanging under the cab and a bill that ordered one sheet for a deck that takes two or more.
  // Tiled at the real sheet size, it bills what a working party actually draws from supply.
  const deckThick = PANEL.subfloorThickIn.value as number;
  const sheetW = PANEL.widthFt.value as number;
  const sheetL = PANEL.lengthFt.value as number;
  const deck0 = cx - deckHalf;
  for (let dx = 0; dx < spec.cabPlanFt - 1e-6; dx += sheetL) {
    const cw = Math.min(sheetL, spec.cabPlanFt - dx);
    for (let dz = 0; dz < spec.cabPlanFt - 1e-6; dz += sheetW) {
      const cd = Math.min(sheetW, spec.cabPlanFt - dz);
      emit('subfloor', `${sheetW}x${sheetL} panel`, {
        cutLengthFt: cw,
        position: [deck0 + dx + cw / 2, deckY + deckThick / IN_PER_FT / 2, deck0 + dz + cd / 2],
        rotation: [-Math.PI / 2, 0, 0],
        stage: sPlatform,
        actual: { w: deckThick, d: cd * IN_PER_FT },
        nailing: '8d @ 6" edges / 12" field (PH)',
        doctrineRef: 'TM 5-302 tower platform decking (PH)',
      });
    }
  }

  /** Open edges of the stair's top landing, railed with the platform's own pass. */
  const bridgeEdges: RailEdge[] = [];
  // ── Access. Which edge it lands on is fixed (the front, -Z), so the railing knows where the
  // gap goes without a second convention to keep in sync.
  const accessWidth = TOWER.accessWidthFt.value as number;
  const accessEdgeGap: [number, number] = [spec.cabPlanFt / 2 - accessWidth / 2, spec.cabPlanFt / 2 + accessWidth / 2];
  if (spec.access === 'ladder') {
    // CLEAR OF THE FRAME AT EVERY HEIGHT, not just at the deck. The clearance used to be measured
    // off the deck edge alone — right arithmetic, wrong datum. The deck edge is the narrowest
    // point of a BATTERED frame; the legs rake out to the base, so a plumb ladder set 0.6 ft
    // inside that sweep crosses the leg plane partway up. Measured on this preset: the ladder
    // stood at z = 0.90 between legs running z = 0.0 at the ground and z = 1.5 at the deck, and
    // ran through the brace diagonals with 8.9 in of overlap, crossing at about 9.6 ft.
    //
    // Standing it outside the widest point would clear the frame and leave the climber reaching
    // 2.1 ft across open air at the top. Raking it at the frame's own batter is what a ladder
    // bolted to a battered face actually does, and it holds the clearance constant: the foot
    // sits `ladderClearanceFt` outside the leg BASE, and every rung above it keeps that gap.
    const clearance = TOWER.ladderClearanceFt.value as number;
    const batter = TOWER.batterPerSideFt.value as number;
    // `halfAt` is the frame's own batter curve; reading the base off it means the ladder cannot
    // drift from the legs if the batter ever changes.
    const legBaseZ = cx - halfAt(spec, legBaseY, legBaseY, legTopY);
    // The rake is the LEGS' rake, which is the batter over their own climb — and the ladder's
    // foot is on the GROUND while theirs is on the footing, so its base is set back by the lean
    // it would have picked up over that difference. Both halves matter: take the rake off the
    // height above grade and the gap opens with height; skip the setback and it closes to
    // 6 5/8 in at the bottom, under the figure this whole block exists to hold.
    const lean = climb > 0 ? batter / climb : 0;
    const { members } = generateLadder({
      base: [cx, legBaseZ - clearance - legBaseY * lean],
      facing: [0, 1],
      baseY: 0,
      landingY: deckY,
      widthFt: accessWidth,
      stage: sAccess,
      leanPerFt: lean,
    });
    emit.members.push(...members);
  } else {
    // A SWITCHBACK STAIR IN A WELL OFF THE FRONT FACE, arriving on the platform's front edge —
    // the same edge the ladder uses and the same edge the guardrail opens. It used to be aimed
    // by guessing a start corner and turning a quarter at each landing, which walked it around
    // two faces of the tower and finished four feet PAST the back corner at deck height, over
    // open ground. Stating the arrival instead of the departure is what fixes that, and 180°
    // landings keep the whole run two stair-widths wide instead of marching around the building.
    // CLEAR OF THE FRAME, WHICH IS NOT THE DECK EDGE — the ladder's lesson, applied to the other
    // way up. The well was struck off the platform's front edge, and a battered tower's base is
    // two feet wider than its deck on every side, so the stair stood INSIDE its own tower: on
    // this preset the lowest flight's foot sat at the deck-edge line at ground level, where the
    // frame reaches 23.94 in further out, and the run crossed the front face's bracing on the way
    // down. Measured: stringer through a brace 3.46 in, through the mudsill 1.19, and the top
    // flight through the platform's own edge girt 6.28 and its rim joist 4.91.
    //
    // The datum is read off the FRAME AS BUILT rather than re-derived, so the batter, the leg
    // section and the bracing's standoff cannot drift away from it — the same reason the ladder
    // reads its own base off `halfAt`.
    const frameFace = Math.min(...emit.members.filter((m) => FRAME_ROLES.includes(m.role))
      .map((m) => planReach(m, -1)));
    const clear = TOWER.ladderClearanceFt.value as number;
    const runAt = (z: number) => generateStair({
      base: [cx, z],
      up: [0, 1],
      baseY: 0,
      topY: deckY,
      widthFt: accessWidth,
      stage: sAccess,
      // Keep each flight to a bay; a straight run to 32 ft would need 40 ft.
      maxFlightRiseFt: bay,
      turn: 'switchback',
      arriveAt: { at: [cx, z], dir: [0, 1] },
    });
    // TWO PASSES, because a switchback is deeper than its arrival. Every landing runs FORWARD
    // from where its two flights meet by at least the stair's own width, so on a three-flight
    // run — a 24-ft tower — the first turn reaches back under the tower even when the arrival
    // is clear: 3.75 in of its toe board inside the bay-1 girt. Laid out once, measured against
    // the frame's own widest line, and moved back by whatever still reaches past it.
    let arriveZ = Math.min(cx - deckHalf, frameFace - clear);
    let stair = runAt(arriveZ);
    const intrude = Math.max(...stair.members.map((m) => planReach(m, 1))) - (frameFace - clear);
    if (intrude > TOLERANCE.minSliverFt) {
      arriveZ -= intrude;
      stair = runAt(arriveZ);
    }
    const bridge = cx - deckHalf - arriveZ;
    emit.members.push(...stair.members);
    // AND A LANDING BRIDGES BACK TO THE DECK. Standing the well outside the frame leaves that
    // much air between the top nosing and the platform, and a stair that stops short of what it
    // serves is not one. Decked in the same planks the stair's own landings use, and railed on
    // its two open sides by the pass below — a walking surface at height is railed whatever
    // carries it (EM 385-1-1).
    if (bridge > TOLERANCE.minSliverFt) {
      const plankNominal = STAIR.treadNominal.value as string;
      const plankW = DRESSED[plankNominal]!.d / IN_PER_FT;
      const plankT = DRESSED[plankNominal]!.w / IN_PER_FT;
      for (let z = arriveZ; z < cx - deckHalf - EPS_FT; z += plankW) {
        const cut = Math.min(plankW, cx - deckHalf - z);
        emit('deckPlank', plankNominal, {
          cutLengthFt: accessWidth,
          // LEVEL WITH THE DECK YOU STEP ONTO, which is the platform's decking and not its frame:
          // `deckY` is the joists' top and the subfloor lies on it, so planking the bridge to
          // `deckY` would leave a ¾-in step at the threshold.
          position: [cx, deckY + deckThick / IN_PER_FT - plankT / 2, z + cut / 2],
          rotation: [-Math.PI / 2, 0, 0],
          stage: sAccess,
          actual: { w: DRESSED[plankNominal]!.w, d: cut * IN_PER_FT },
          nailing: '2-16d ea bearer (PH)',
          doctrineRef: citeOf(STAIR.treadNominal),
        });
      }
      bridgeEdges.push(
        { id: 'bridge-w', from: [cx - accessWidth / 2, cx - deckHalf], to: [cx - accessWidth / 2, arriveZ] },
        { id: 'bridge-e', from: [cx + accessWidth / 2, arriveZ], to: [cx + accessWidth / 2, cx - deckHalf] },
      );
    }
  }

  // ── Guardrails on every open platform edge, minus the access gap.
  if (railRequired(H)) {
    const corners: [number, number][] = [
      [cx - deckHalf, cx - deckHalf], [cx + deckHalf, cx - deckHalf],
      [cx + deckHalf, cx + deckHalf], [cx - deckHalf, cx + deckHalf],
    ];
    const edges: RailEdge[] = corners.map((from, i) => ({
      id: `deck-${i}`,
      from,
      to: corners[(i + 1) % 4]!,
      // The way up lands on edge 0 whether it is a ladder or a stair, so the rail opens there
      // either way. Gating this on 'ladder' left a stair delivering people into a closed rail.
      ...(i === 0 ? { gaps: [accessEdgeGap] } : {}),
    }));
    // The cab's four corner posts stand on these same corners — `tower.ts` emits them below,
    // after this pass has run, so the railing's own de-duplication cannot see them. Told about
    // them, it leaves those holes alone and butts its rails on their faces.
    emit.members.push(...generateRailing({
      edges: [...edges, ...bridgeEdges],
      deckY: deckY + deckThick / IN_PER_FT,
      stage: sRail,
      standing: corners.map((at) => ({ at, widthFt: DRESSED[CAB_POST_NOMINAL]!.w / IN_PER_FT })),
    }));
  }

  // ── Cab.
  //
  // CLADDING GOES ON THE OUTSIDE OF A FRAME. Every cab panel used to be centred on the corner
  // LINE — which is the corner posts' own centreline — so each one ran 1¾ in into the post at
  // both of its ends, its outer face sat 1½ in INSIDE the posts' outer faces, and all four
  // posts stood proud of the wall they were supposed to be behind. `wallTilePlacement` gets this
  // right for every other wall in the toolkit by starting from the surface's `faceOffsetFt`;
  // the cab is hand-rolled and started from nothing.
  //
  // The corner also has to be closed. Four panels each spanning corner to corner would meet in
  // an L that leaves the post's arris showing, so the two z-walls run the full outer width and
  // the two x-walls butt into them: the ordinary sheathing lap, and the reason `cutLengthFt` is
  // not simply the corner-to-corner run.
  const cabCorners: [number, number][] = [
    [cx - deckHalf, cx - deckHalf], [cx + deckHalf, cx - deckHalf],
    [cx + deckHalf, cx + deckHalf], [cx - deckHalf, cx + deckHalf],
  ];
  const cabPostHalfFt = DRESSED['4x4']!.w / 2 / IN_PER_FT;
  const cabPanel = (f: number, thickFt: number): { cutLengthFt: number; x: number; z: number; yaw: number } => {
    const p = cabCorners[f]!;
    const q = cabCorners[(f + 1) % 4]!;
    const run = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // Outward normal of a face wound this way is the run direction turned a quarter right.
    const nx = (q[1] - p[1]) / run;
    const nz = -(q[0] - p[0]) / run;
    const out = cabPostHalfFt + thickFt / 2;
    const overrun = cabPostHalfFt + (f % 2 === 0 ? thickFt : 0);
    return {
      cutLengthFt: run + 2 * overrun,
      x: (p[0] + q[0]) / 2 + nx * out,
      z: (p[1] + q[1]) / 2 + nz * out,
      yaw: Math.atan2(-(q[1] - p[1]), q[0] - p[0]),
    };
  };
  const cabWallH = spec.cab.walls === 'open-rail'
    ? 0
    : spec.cab.walls === 'half-wall' ? (TOWER.cabHalfWallFt.value as number) : (TOWER.cabWallHeightFt.value as number);
  const cabBaseY = deckY + deckThick / IN_PER_FT;
  if (cabWallH > 0) {
    const halfW = spec.cab.walls === 'half-wall-screen' ? (TOWER.cabHalfWallFt.value as number) : cabWallH;
    const sidingT = (PANEL.sidingThickIn.value as number) / IN_PER_FT;
    const screenT = (HUT.screenClothThickIn.value as number) / IN_PER_FT;
    const screenH = (TOWER.cabWallHeightFt.value as number) - halfW;
    for (let f = 0; f < 4; f++) {
      const w = cabPanel(f, sidingT);
      emit('siding', `${PANEL.widthFt.value}x${PANEL.lengthFt.value} panel`, {
        cutLengthFt: w.cutLengthFt,
        position: [w.x, cabBaseY + halfW / 2, w.z],
        rotation: [0, w.yaw, 0],
        stage: sCab,
        actual: { w: PANEL.sidingThickIn.value as number, d: halfW * IN_PER_FT },
        nailing: '8d @ 6" edges / 12" field (PH)',
        doctrineRef: citeOf(TOWER.cabHalfWallFt),
      });
      if (spec.cab.walls === 'half-wall-screen') {
        const s = cabPanel(f, screenT);
        emit('screenPanel', 'screen cloth', {
          cutLengthFt: s.cutLengthFt,
          position: [s.x, cabBaseY + halfW + screenH / 2, s.z],
          rotation: [0, s.yaw, 0],
          stage: sCab,
          actual: { w: HUT.screenClothThickIn.value as number, d: screenH * IN_PER_FT },
          nailing: 'staples @ 4" + batten (PH)',
          doctrineRef: citeOf(TOWER.cabWallHeightFt),
        });
      }
    }
  }

  // Corner posts carry the cab roof whether or not the cab has walls.
  const postTopY = cabBaseY + (TOWER.cabWallHeightFt.value as number);
  for (const [x, z] of [
    [cx - deckHalf, cx - deckHalf], [cx + deckHalf, cx - deckHalf],
    [cx + deckHalf, cx + deckHalf], [cx - deckHalf, cx + deckHalf],
  ] as [number, number][]) {
    emit('post', CAB_POST_NOMINAL, {
      cutLengthFt: TOWER.cabWallHeightFt.value as number,
      position: [x, (cabBaseY + postTopY) / 2, z],
      rotation: [0, 0, Math.PI / 2],
      stage: sCab,
      nailing: 'bolted to the platform frame (PH)',
      doctrineRef: citeOf(TOWER.cabWallHeightFt),
    });
  }

  // ── Cab roof: four hips to a peak, or one slope.
  //
  // THE FRAMING IS BUILT HERE; THE SURFACE IS NOT. This block's job is to state the roof as
  // planes and cut the sticks that hold them up. Sheathing and roofing then go on through the
  // one covering path every other roof in the toolkit uses, which is what makes the cab's
  // triangular faces come out as triangles and — not incidentally — is the only reason the
  // roofing the operator selected reaches the cab at all. The hand-rolled version emitted four
  // full-width rectangles and no roofing whatsoever.
  const overhang = TOWER.cabOverhangFt.value as number;
  const rise = ((TOWER.cabRisePer12.value as number) / IN_PER_FT) * (spec.cabPlanFt / 2 + overhang);
  const eaveY = postTopY;
  let roofPlanes: RoofPlane[];
  if (spec.cab.roof === 'pyramid') {
    const peak: [number, number, number] = [cx, eaveY + rise, cx];
    const eaveCorners: [number, number][] = [
      [cx - deckHalf - overhang, cx - deckHalf - overhang], [cx + deckHalf + overhang, cx - deckHalf - overhang],
      [cx + deckHalf + overhang, cx + deckHalf + overhang], [cx - deckHalf - overhang, cx + deckHalf + overhang],
    ];
    for (const [x, z] of eaveCorners) {
      const run = Math.hypot(peak[0] - x, peak[2] - z);
      emit('hipRafter', '2x6', {
        cutLengthFt: Math.hypot(run, rise),
        position: [(x + peak[0]) / 2, (eaveY + peak[1]) / 2, (z + peak[2]) / 2],
        rotation: [0, Math.atan2(-(peak[2] - z), peak[0] - x), Math.atan2(rise, Math.max(1e-6, run))],
        stage: sRoof,
        nailing: '3-16d at the peak, toenail 3-8d at the plate (PH)',
        doctrineRef: citeOf(TOWER.cabRisePer12),
      });
    }
    roofPlanes = pyramidPlanes([cx, cx], spec.cabPlanFt / 2 + overhang, eaveY, rise);
  } else {
    // Shed: one slope over the whole cab, high side to the rear (+Z).
    const half = spec.cabPlanFt / 2 + overhang;
    const fall = rise * 2; // eave-to-eave, since a shed has no peak in the middle
    const slopeLen = Math.hypot(half * 2, fall);
    const sn = fall / slopeLen;
    const cs = (half * 2) / slopeLen;
    roofPlanes = [{
      id: 'cab-shed',
      origin: [cx - half, eaveY, cx - half],
      alongEave: [1, 0, 0],
      upSlope: [0, sn, cs],
      normal: [0, cs, -sn],
      eaveLengthFt: half * 2,
      slopeLengthFt: slopeLen,
    }];
    // ── THE HIGH SIDE HAS TO STAND ON SOMETHING.
    //
    // A shed is one slope, so its high edge is a WALL: the pyramid gets away without one because
    // its four hips lean on each other at a peak, and this branch was written as if the same were
    // true. Measured on the shipped cab, the rafters ran from 22.845 up to 26.613 while every
    // post and screen panel in the cab topped out at 23.063 — three and a half feet of roof
    // carried on nothing at all, over the heads of the two observers the card is sized for.
    //
    // The building's own shed roof has framed a pony wall for this since T2, and an earlier pass
    // through this sweep had to give that pony wall the plate it was missing. The cab gets the
    // same two pieces: posts up the rear corners, and a plate across them for the rafters to land
    // on.
    // The plate's top is the roof plane AT THE WALL, which is not the same as the plane at the
    // high edge: the rafters run past the wall by the cab's overhang, exactly as they do at the
    // eave. `eaveY + fall` is the height over the overhang's far edge and put the plate 4 in
    // above the bearing line the rafters actually cross.
    const highY = eaveY + (fall * (deckHalf * 2 + overhang)) / (half * 2);
    const plateNom = LUMBER.plateNominal.value as string;
    const plateD = DRESSED[plateNom]!.d / IN_PER_FT;
    for (const x of [cx - deckHalf, cx + deckHalf]) {
      emit('post', '4x4', {
        // Up to the UNDERSIDE of the plate, not to the top of the wall: a plate sits ON its
        // posts, and running them both to the same height buries it in them.
        cutLengthFt: highY - plateD - eaveY,
        position: [x, (eaveY + highY - plateD) / 2, cx + deckHalf],
        rotation: [0, 0, Math.PI / 2],
        stage: sRoof,
        nailing: 'bolted to the cab post below (PH)',
        doctrineRef: citeOf(TOWER.cabRisePer12),
      });
    }
    emit('capPlate', plateNom, {
      cutLengthFt: deckHalf * 2,
      position: [cx, highY - plateD / 2, cx + deckHalf],
      rotation: [0, 0, 0],
      stage: sRoof,
      nailing: '2-16d ea post (PH)',
      doctrineRef: citeOf(TOWER.cabRisePer12),
    });
    // Rafters span the slope, so they are spaced ACROSS it — along X — and run toward +Z going
    // up, matching the plane. They used to be spaced along Z, which is the direction they RUN,
    // so all three were laid end to end down the same line instead of across the roof.
    //
    // AND THERE WERE THREE OF THEM, at the two edges and the middle: 48 in on centre across an
    // 8-ft cab, on a card whose own `spacing.rafterSpacingIn` says 16. Hardcoding the count is
    // how a spacing becomes a coincidence.
    const rafterOc = spec.spacing.rafterSpacingIn / IN_PER_FT;
    const bays = Math.max(1, Math.ceil((deckHalf * 2) / rafterOc));
    for (let i = 0; i <= bays; i++) {
      emit('rafter', '2x6', {
        cutLengthFt: slopeLen,
        position: [cx - deckHalf + (deckHalf * 2 * i) / bays, eaveY + rise, cx],
        rotation: [0, -Math.PI / 2, Math.atan2(fall, half * 2)],
        stage: sRoof,
        nailing: 'toenail 3-8d ea plate (PH)',
        doctrineRef: citeOf(TOWER.cabRisePer12),
      });
    }
  }

  emit.members.push(...generateRoofCovering({
    planes: roofPlanes,
    deck: spec.coverings.roofDeck === 'none' ? 'none' : 'plywood',
    roofing: spec.coverings.roofing,
    stageDeck: sRoofing,
    stageRoofing: sRoofing,
    rafterHalfFt: DRESSED['2x6']!.d / IN_PER_FT / 2,
  }));

  return {
    members: emit.members,
    levels: { subfloorTop: deckY, joistTop: joistY, sillTop: 0, gradeY: 0 },
    stagePlan: plan,
  };
}

/** Exported for the catalog's lock rows and the tower test. */
export const TOWER_HEIGHTS = TOWER.platformHeightsFt.value as readonly TowerSpec['platformHeightFt'][];
export { RAIL };
