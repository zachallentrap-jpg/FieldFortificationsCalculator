// TIMBER-1 engine — foundation + floor generators (design doc §1.2 foundation.ts/floor.ts),
// stages 1–4. Pure: inputs + doctrine constants in, Member[] out.
//
// Vertical datum: y = 0 is the TOP OF SUBFLOOR (walls stand on it, floor structure hangs
// below, posts run down to grade). Everything derives from dressed sizes so a lumber change
// re-stacks the whole section.
//
// Horizontal datum: x/z = 0 is the OUTSIDE FACE of the floor frame (rim joist / sheathing
// plane). Sills, rims, and posts are inset so nothing overhangs the building line.
//
// Foundations (FM 5-426 foundations chapter, PH pages) come in three selectable types:
//   'piers'    — posts on concrete pad footers under the sills + girder (TO expedient).
//   'wall'     — continuous concrete wall on strip footings, sills anchored all around.
//   'basement' — the wall foundation carried down to a slab, girder on columns, and a
//                framed stair opening (double trimmers/headers, tail joists) with a
//                straight stair — FM 5-426's framing-at-openings and stair-layout lessons.
//
// ponytail: girder is sized as a fixed built-up 3-2x10 and joists as 2x8 @ input spacing —
// the Table 6-1 load-area method and Table 6-2 span checks bolt on here later as pure
// functions that pick `girderNominal`/`joistNominal` instead of these constants.

import type { Member, MemberRole, StageId } from './types';
import { DRESSED } from './types';
import { crossBridgingRise } from './bridgingRise';

const FT = 12;

export type FoundationType = 'piers' | 'wall' | 'basement';
export type BridgingType = 'cross' | 'solid';

export interface FloorInput {
  lengthFt: number; // building X
  widthFt: number; // building Z (joist span direction)
  joistSpacingIn: 16 | 24;
  crawlFt?: number; // grade to sill bottom (post/stem height at perimeter), default 1.5
  foundation?: FoundationType; // default 'piers'
  basementDepthFt?: number; // sill bottom to top of slab, default 7.5 (basement only)
  bridging?: BridgingType; // default 'cross' (FM 5-426 favors cross bridging)
  stairs?: boolean; // stair opening + stairs; default true for basement, else false
}

export interface FloorLevels {
  subfloorTop: number; // = 0 by definition
  joistTop: number;
  sillTop: number;
  gradeY: number; // where the ground plane sits
  slabTop?: number; // basement floor (basement foundation only)
}

// Concrete section constants, inches (PH pending foundation-chapter verification).
const CONC_WALL_T = 8;
const FOOTING_W = 16;
const FOOTING_H = 8;
const PAD_SIDE = 16;
const PAD_H = 8;
const SLAB_T = 4;

export function floorLevels(input: FloorInput): FloorLevels {
  const panelT = 0.75 / FT; // 3/4" subfloor
  const joistD = DRESSED['2x8']!.d / FT;
  const sillT = DRESSED['2x6']!.w / FT;
  const joistTop = -panelT;
  const sillTop = joistTop - joistD;
  const sillBottom = sillTop - sillT;
  const foundation = input.foundation ?? 'piers';
  if (foundation === 'basement') {
    const depth = input.basementDepthFt ?? 7.5;
    // Basement walls show ~1 ft of exposed concrete above grade; the slab sits `depth`
    // below the sill bottom.
    return { subfloorTop: 0, joistTop, sillTop, gradeY: sillBottom - 1.0, slabTop: sillBottom - depth };
  }
  return { subfloorTop: 0, joistTop, sillTop, gradeY: sillBottom - (input.crawlFt ?? 1.5) };
}

// Layout grid along a run: end members held at t/2 (edge-flush), interior members at exact
// OC multiples so panel edges land on member centers — the FM 5-426 plate/joist layout
// (first mark at 15 1/4" for 16" OC, then every 16").
export function layoutCenters(runFt: number, ocFt: number, tFt: number): number[] {
  const xs: number[] = [tFt / 2];
  for (let s = ocFt; s < runFt - 1.5 * tFt; s += ocFt) xs.push(s);
  xs.push(runFt - tFt / 2);
  return xs;
}

// The basement stair: doctrinal riser/tread math (FM 5-426 stairway section, PH page —
// riser ~7-8", tread ~9-12"), plus the floor opening sized so a person clears the floor
// structure with ~80" of headroom on the way down. Returns null when the plan is too small
// to fit a straight run.
export interface StairPlan {
  risers: number;
  unitRiseIn: number;
  unitRunIn: number;
  treads: number;
  totalRiseFt: number;
  runFt: number;
  // Rough opening in plan: x from x0 (west, foot of stair) to x1 (east, top nosing);
  // z from z1 (south face, along the girder) to z2 (north face).
  x0: number; x1: number; z1: number; z2: number;
}

export function stairPlan(input: FloorInput): StairPlan | null {
  const foundation = input.foundation ?? 'piers';
  const wantStairs = input.stairs ?? foundation === 'basement';
  if (!wantStairs || foundation !== 'basement') return null;
  const lv = floorLevels(input);
  if (lv.slabTop === undefined) return null;
  const t = 1.5 / FT;
  const totalRiseFt = 0 - lv.slabTop; // subfloor top to slab top
  const risers = Math.max(2, Math.round((totalRiseFt * FT) / 7.5));
  const unitRiseIn = (totalRiseFt * FT) / risers;
  const unitRunIn = 10;
  const treads = risers - 1;
  const runFt = (treads * unitRunIn) / FT;
  // Opening length: risers needed to clear headroom (80") plus the floor structure (8").
  const floorDepthIn = 0.75 + DRESSED['2x8']!.d;
  const openLenFt = (((80 + floorDepthIn) / unitRiseIn) * unitRunIn) / FT;
  const x1 = input.lengthFt - 4; // top nosing 4 ft off the east wall
  const x0 = x1 - openLenFt;
  const z1 = input.widthFt / 2 + 2 * t; // south face just north of the girder plies
  const z2 = Math.min(z1 + 3.33, input.widthFt - 1.0);
  if (x0 < 1.0 || z2 - z1 < 2.5) return null; // no room for a straight run
  return { risers, unitRiseIn, unitRunIn, treads, totalRiseFt, runFt, x0, x1, z1, z2 };
}

export function generateFloor(input: FloorInput): Member[] {
  const members: Member[] = [];
  const L = input.lengthFt;
  const W = input.widthFt;
  const lv = floorLevels(input);
  const foundation = input.foundation ?? 'piers';
  const bridging = input.bridging ?? 'cross';
  const counters: Partial<Record<MemberRole, number>> = {};

  const emit = (
    role: MemberRole,
    nominal: string,
    cutLenFt: number,
    position: [number, number, number],
    rotation: [number, number, number],
    stage: StageId,
    extras?: Partial<Member>,
  ): void => {
    const n = (counters[role] = (counters[role] ?? 0) + 1);
    members.push({
      id: `FL-${role}-${String(n).padStart(2, '0')}`,
      role,
      nominal,
      actual: DRESSED[nominal] ?? { w: 1.5, d: 3.5 },
      cutLength: cutLenFt * FT,
      position,
      rotation,
      stage,
      grade: 'No. 2 common',
      nailing: extras?.nailing ?? '16d common (PH)',
      doctrineRef: extras?.doctrineRef ?? 'FM 5-426 ch. 6 (PH page)',
      ...extras,
    });
  };

  const t = 1.5 / FT;
  const sillT = DRESSED['2x6']!.w / FT;
  const sillD = DRESSED['2x6']!.d / FT; // sill face width, horizontal
  const sillBottom = lv.sillTop - sillT;
  const joistD = DRESSED['2x8']!.d / FT;
  const girderD = DRESSED['2x10']!.d / FT;
  const girderBottom = lv.sillTop - girderD;
  const concT = CONC_WALL_T / FT;

  const stair = stairPlan(input);

  // ── Stage 1: foundation ──────────────────────────────────────────────────────
  const postAt = (x: number, z: number, len: number, yBase: number, extras?: Partial<Member>): void =>
    emit('post', '4x4', len, [x, yBase + len / 2, z], [0, 0, Math.PI / 2], 1, {
      doctrineRef: 'FM 5-426 post & footer spacing 6-10 ft (PH page)',
      ...extras,
    });
  const padAt = (x: number, z: number, topY: number): void =>
    emit('footing', 'conc pad 16x16x8', PAD_SIDE / FT, [x, topY - PAD_H / FT / 2, z], [0, 0, 0], 1, {
      actual: { w: PAD_SIDE, d: PAD_H },
      nailing: 'poured on undisturbed soil (PH)',
      doctrineRef: 'FM 5-426 post footers (PH page)',
    });

  // Support line positions: sills inset so their outside face is flush with the frame line.
  const sillCtr = sillD / 2;
  const postCount = Math.max(2, Math.ceil((L - 2 * sillCtr) / 8) + 1);
  const postXs: number[] = [];
  for (let i = 0; i < postCount; i++) postXs.push(sillCtr + (i / (postCount - 1)) * (L - 2 * sillCtr));

  if (foundation === 'piers') {
    // A slab-on-grade or very-low-pier building (crawlFt <= 0 — an ordinary real input)
    // drives these lengths to zero or negative, which used to emit "post" members with no
    // floor beneath them to stand on. Pads still go in; the post above a pad is skipped
    // when there is no height for one. Audit fix, kept through the FM 5-426 merge.
    const postLen = sillBottom - lv.gradeY;
    for (const x of postXs) {
      for (const z of [sillCtr, W - sillCtr]) {
        padAt(x, z, lv.gradeY);
        if (postLen > 0.1) postAt(x, z, postLen, lv.gradeY);
      }
    }
    const girderPostLen = girderBottom - lv.gradeY;
    for (const x of postXs) {
      padAt(x, W / 2, lv.gradeY);
      if (girderPostLen > 0.1) postAt(x, W / 2, girderPostLen, lv.gradeY);
    }
  } else {
    // Continuous wall (crawl or basement): outside face flush with the frame line, so the
    // sill sits on the outer part of the wall and a ledge remains inside.
    const wallBottom = foundation === 'basement' ? (lv.slabTop ?? lv.gradeY) - 4 / FT : lv.gradeY - 1.0;
    const wallH = sillBottom - wallBottom;
    const wallCtr = concT / 2;
    const wallRuns: { len: number; pos: [number, number, number]; rot: [number, number, number] }[] = [
      { len: L, pos: [L / 2, sillBottom - wallH / 2, wallCtr], rot: [0, 0, 0] },
      { len: L, pos: [L / 2, sillBottom - wallH / 2, W - wallCtr], rot: [0, 0, 0] },
      { len: W - 2 * concT, pos: [wallCtr, sillBottom - wallH / 2, W / 2], rot: [0, -Math.PI / 2, 0] },
      { len: W - 2 * concT, pos: [L - wallCtr, sillBottom - wallH / 2, W / 2], rot: [0, -Math.PI / 2, 0] },
    ];
    for (const wr of wallRuns) {
      emit('foundationWall', `conc wall ${CONC_WALL_T}"`, wr.len, wr.pos, wr.rot, 1, {
        actual: { w: CONC_WALL_T, d: wallH * FT },
        nailing: '1/2" anchor bolts @ 6 ft max o.c. into sill, min 2 per plate, within 12" of each end (IRC R403.1.6)',
        doctrineRef: 'FM 5-426 continuous-wall foundation (PH ch./page)',
      });
      emit('footing', `conc footing ${FOOTING_W}x${FOOTING_H}`, wr.len, [wr.pos[0], wallBottom - FOOTING_H / FT / 2, wr.pos[2]], wr.rot, 1, {
        actual: { w: FOOTING_W, d: FOOTING_H },
        nailing: 'poured on undisturbed soil (PH)',
        doctrineRef: 'FM 5-426 wall footing: width ~2x wall, depth ~wall thickness (PH page)',
      });
    }
    if (foundation === 'basement') {
      const slabTop = lv.slabTop ?? lv.gradeY;
      emit('slab', `conc slab ${SLAB_T}"`, L - 2 * concT, [L / 2, slabTop - SLAB_T / FT / 2, W / 2], [0, 0, 0], 1, {
        actual: { w: (W - 2 * concT) * FT, d: SLAB_T },
        nailing: 'poured against walls over vapor barrier (PH)',
        doctrineRef: 'FM 5-426 basement slab (PH ch./page)',
      });
      // Girder columns bear on the slab (footing thickened below, not modeled); girder
      // ENDS bear in pockets cast into the end walls.
      const colLen = girderBottom - slabTop;
      for (const x of postXs.slice(1, -1)) {
        postAt(x, W / 2, colLen, slabTop, {
          doctrineRef: 'girder column on slab footing — steel column typical (PH); girder ends bear in wall pockets',
        });
      }
    } else {
      const girderPostLen = girderBottom - lv.gradeY;
      for (const x of postXs.slice(1, -1)) {
        padAt(x, W / 2, lv.gradeY);
        postAt(x, W / 2, girderPostLen, lv.gradeY);
      }
    }
  }

  // ── Stage 2: sills (2x6 flat, outside face flush with the frame line) + center girder
  // (built-up 3-2x10 on edge, top flush with the sills so joists bear level everywhere).
  // The end distance and the two-per-piece minimum are the parts that actually get missed in
  // the field, so the schedule says them rather than leaving the spacing to imply them.
  const sillAnchor =
    foundation === 'piers'
      ? 'anchor/drift per post cap (PH)'
      : '1/2" anchor bolts @ 6 ft max o.c., min 2 per plate, within 12" of each end (IRC R403.1.6)';
  for (const z of [sillCtr, W - sillCtr]) {
    emit('sill', '2x6', L, [L / 2, lv.sillTop - sillT / 2, z], [-Math.PI / 2, 0, 0], 2, { nailing: sillAnchor });
  }
  if (foundation !== 'piers') {
    // Continuous foundations carry sills on all four sides (end joists bear too).
    for (const x of [sillCtr, L - sillCtr]) {
      emit('sill', '2x6', W - 2 * sillD, [x, lv.sillTop - sillT / 2, W / 2], [-Math.PI / 2, Math.PI / 2, 0], 2, { nailing: sillAnchor });
    }
  }
  for (const lat of [-t, 0, t]) {
    emit('girder', '2x10', L, [L / 2, lv.sillTop - girderD / 2, W / 2 + lat], [0, 0, 0], 2, {
      nominal: '2x10',
      doctrineRef: 'FM 5-426 Table 6-1 built-up girder (PH: fixed 3-2x10, load-area method pending)',
      nailing: '16d @ 16" staggered, both faces (PH)',
    });
  }

  // ── Stage 3: joists (2x8 on edge spanning front-to-rear over the girder) between rim
  // joists, plus the framed stair opening (double trimmers/headers + tail joists) when the
  // basement stair is in play.
  const oc = input.joistSpacingIn / FT;
  const joistY = lv.joistTop - joistD / 2;
  const joistLen = W - 2 * t; // fits between the front/rear rim joists
  const joistXs = layoutCenters(L, oc, t);

  // Every spanning member emitted at stage 3 — plain joists, tail joists AND the doubled
  // trimmers — registers its run here as it is placed. Bridging (below) is derived from this
  // list and nothing else, so a change to the framing moves the bay boundaries and the
  // bridging re-derives itself instead of having to be patched in parallel.
  // `bearings` is where the run is carried: its two ends, plus the center girder when it
  // crosses one — that is what decides whether a span segment is long enough to need a row.
  interface JoistRun { x: number; z0: number; z1: number; bearings: number[] }
  const joistRuns: JoistRun[] = [];
  const joistAt = (x: number, z0: number, z1: number, role: MemberRole, extras?: Partial<Member>): void => {
    const overGirder = z0 < W / 2 - 0.01 && z1 > W / 2 + 0.01;
    joistRuns.push({ x, z0, z1, bearings: overGirder ? [z0, W / 2, z1] : [z0, z1] });
    emit(role, '2x8', z1 - z0, [x, joistY, (z0 + z1) / 2], [0, -Math.PI / 2, 0], 3, {
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: 'FM 5-426 Table 6-2 joist span (PH: 2x8 fixed, span check pending)',
      ...extras,
    });
  };

  for (const x of joistXs) {
    if (stair) {
      // Grid positions at/near the opening faces are absorbed by the double trimmers.
      if (Math.abs(x - stair.x0) < oc / 2 || Math.abs(x - stair.x1) < oc / 2) continue;
      if (x > stair.x0 && x < stair.x1) {
        // Interrupted joists become tail joists each side of the opening.
        const southEnd = stair.z1 - 2 * t;
        const northStart = stair.z2 + 2 * t;
        if (southEnd - t > 0.2) {
          joistAt(x, t, southEnd, 'tailJoist', {
            doctrineRef: 'tail joist at stair opening, bears on girder — FM 5-426 framing at openings (PH page)',
          });
        }
        if (W - t - northStart > 0.2) {
          joistAt(x, northStart, W - t, 'tailJoist', {
            doctrineRef: 'tail joist at stair opening, hangs on double header — FM 5-426 framing at openings (PH page)',
          });
        }
        continue;
      }
    }
    joistAt(x, t, W - t, 'joist');
  }
  if (stair) {
    // Double trimmer joists run full span just outside each opening face.
    for (const edge of [stair.x0, stair.x1]) {
      const dir = edge === stair.x0 ? -1 : 1;
      for (const k of [0.5, 1.5]) {
        joistAt(edge + dir * k * t, t, W - t, 'trimmerJoist', {
          nailing: '16d @ 12" staggered to mate (PH)',
          doctrineRef: 'double trimmer joist at stair opening — FM 5-426 framing at openings (PH page)',
        });
      }
    }
    // Double headers across the opening ends carry the tails; the south pair bears on the
    // girder below it. PH: verify doubled-2x8 header span against Table 6-2.
    for (const [face, dir] of [[stair.z1, -1], [stair.z2, 1]] as const) {
      for (const k of [0.5, 1.5]) {
        emit('headerJoist', '2x8', stair.x1 - stair.x0, [(stair.x0 + stair.x1) / 2, joistY, face + dir * k * t], [0, 0, 0], 3, {
          nailing: '3-16d ea tail joist + 16d @ 12" to mate (PH)',
          doctrineRef:
            dir === -1
              ? 'double header at stair opening, bears on girder — FM 5-426 framing at openings (PH; verify span)'
              : 'double header at stair opening, carried by trimmers — FM 5-426 framing at openings (PH; verify span)',
        });
      }
    }
  }
  for (const z of [t / 2, W - t / 2]) {
    emit('rimJoist', '2x8', L, [L / 2, joistY, z], [0, 0, 0], 3, { nailing: '3-16d ea joist end (PH)' });
  }

  // Bridging rows at each half-span midpoint once a span segment reaches ~8 ft
  // (FM 5-426: rows not more than 8 ft apart). Cross bridging is the default; solid
  // bridging (full-depth blocking) is the alternative.
  //
  // Design principle: a bay is whatever sits between two ADJACENT RUNS THAT WERE ACTUALLY
  // FRAMED at that row line — never the nominal layout grid. The grid is only a proposal;
  // the stair opening edits it (suppressing grid positions, adding doubled trimmers just
  // outside each face, cutting joists down to tails that stop at a header), and bridging read
  // off the grid could not see any of that. It drove one 2'-6" block straight through both
  // trimmer plies at each end of the stairwell and out the far side. Deriving the bays from
  // `joistRuns` means the opening — or any future change to the layout — fixes the bridging
  // by construction rather than needing a matching edit here.
  {
    // Two separate questions, and conflating them is what put a stick of lumber through the
    // trimmers in the first place:
    //   crosses() — is this run physically present at the row line? Present runs bound the
    //     bays, whether or not they want bridging themselves. Bridging can never jump one.
    //   holdsRow() — does the row land inside one of THIS run's own span segments, and is
    //     that segment long enough to want bridging? The >=8 ft rule applied per run, so the
    //     short tail joists hung between a header and the near wall are left alone instead of
    //     collecting a line of blocking a couple of inches off their header.
    // A bay is bridged only when BOTH of the runs bounding it hold the row. There is no
    // separate building-wide size gate: a narrow building simply has no segment that
    // qualifies, so this measures one thing (the clear run between bearings) in one place.
    const ROW_SPAN_FT = 7.5; // (PH) a segment shorter than this wants no row
    const crosses = (r: JoistRun, z: number): boolean => z > r.z0 + 0.01 && z < r.z1 - 0.01;
    const holdsRow = (r: JoistRun, z: number): boolean => {
      for (let k = 0; k < r.bearings.length - 1; k++) {
        const a = r.bearings[k]!;
        const b = r.bearings[k + 1]!;
        if (z > a + 0.01 && z < b - 0.01) return b - a >= ROW_SPAN_FT;
      }
      return false; // the row misses this run entirely, or lands on a bearing
    };
    for (const zMid of [W / 4, (3 * W) / 4]) {
      const rowRuns = joistRuns.filter((r) => crosses(r, zMid)).sort((a, b) => a.x - b.x);
      const rowInOpening = stair !== null && zMid > stair.z1 && zMid < stair.z2;
      for (let i = 0; i < rowRuns.length - 1; i++) {
        const xa = rowRuns[i]!.x;
        const xb = rowRuns[i + 1]!.x;
        if (!holdsRow(rowRuns[i]!, zMid) || !holdsRow(rowRuns[i + 1]!, zMid)) continue;
        // Mated plies of a doubled trimmer are face to face — there is no bay between them.
        const gap = xb - xa - t;
        if (gap < 0.15) continue;
        // At a row that crosses the stairwell, the bay between the two trimmer pairs is the
        // opening itself: nothing to bridge to.
        if (rowInOpening && stair && xb > stair.x0 + 0.01 && xa < stair.x1 - 0.01) continue;
        // Bays that die against the stairwell trimmers are odd-width fillers, not field
        // bridging — say so on the card so the short cut in the BOM explains itself.
        const atTrimmer =
          stair !== null &&
          [stair.x0, stair.x1].some((f) => Math.abs(xa - f) < 2 * t || Math.abs(xb - f) < 2 * t);
        const xc = (xa + xb) / 2;
        if (bridging === 'cross') {
          // The rise is what fits the BOARD between the joists, not just its centreline — see
          // `bridgingRise.ts`. Pitching the centreline across the whole depth hung every piece
          // 0.78 in below the soffit and drove it through the subfloor above.
          const rise = crossBridgingRise(gap, DRESSED['1x3']!.d / FT, joistD - 0.06);
          if (rise <= 0) continue;
          const len = Math.hypot(gap, rise);
          const ang = Math.atan2(rise, gap);
          for (const s of [-1, 1] as const) {
            emit('bridging', '1x3', len, [xc, joistY, zMid + s * 0.04], [0, 0, s * ang], 3, {
              nailing: '2-8d ea end; bottom ends nailed after subfloor (PH)',
              doctrineRef: atTrimmer
                ? 'FM 5-426 cross bridging — short bay cut to the stairwell trimmer (PH page)'
                : 'FM 5-426 cross bridging at midspan, rows <=8 ft apart (PH page)',
            });
          }
        } else {
          emit('bridging', '2x8', gap, [xc, joistY, zMid + (i % 2 === 0 ? 0.125 : -0.125)], [0, 0, 0], 3, {
            nailing: '3-16d ea end, staggered line (PH)',
            doctrineRef: atTrimmer
              ? 'FM 5-426 solid bridging — short block cut to the stairwell trimmer (PH page)'
              : 'FM 5-426 solid bridging (full-depth blocking), rows <=8 ft apart (PH page)',
          });
        }
      }
    }
  }

  // ── Stage 4: subfloor panels, 4x8 laid across the joists, courses staggered half a panel.
  // Rows clamp to the building edge (no overlapping final course). Rows that cross the
  // stairwell are decked up to the opening faces and left open across it — the framed
  // opening below stays visible, which is the whole lesson.
  const panelT = 0.75 / FT;
  const rows = Math.ceil(W / 4);
  const panelAt = (xC: number, wPanel: number, zC: number, rowW: number, note?: string): void =>
    emit('subfloor', '4x8 panel', wPanel, [xC, -panelT / 2, zC], [-Math.PI / 2, 0, 0], 4, {
      actual: { w: 0.75, d: rowW * FT },
      nailing: '8d @ 6" edges / 12" field (PH)',
      doctrineRef: note ?? 'FM 5-426 subfloor, staggered joints (PH page)',
    });
  for (let r = 0; r < rows; r++) {
    const rowW = Math.min(4, W - r * 4);
    if (rowW < 0.05) continue;
    const zC = r * 4 + rowW / 2;
    const rowInStair = stair && zC + rowW / 2 > stair.z1 + 0.01 && zC - rowW / 2 < stair.z2 - 0.01;
    if (rowInStair && stair) {
      // Deck the row in two runs, stopping at the opening's trimmer faces.
      for (const [a, b] of [[0, stair.x0], [stair.x1, L]] as const) {
        let x = a;
        while (b - x > 0.05) {
          const w = Math.min(8, b - x);
          panelAt(x + w / 2, w, zC, rowW, 'FM 5-426 subfloor, cut to the stairwell trimmers/headers (PH page)');
          x += w;
        }
      }
      continue;
    }
    const stagger = r % 2 === 1 ? 4 : 0;
    // Single left-to-right sweep: each panel starts exactly where the previous one ended,
    // so a row can never overlap or gap. (Computing centers from BOTH edges independently
    // — a staggered grid plus a separate trailing-remainder push — let the trailing panel
    // entirely contain the previous one whenever L wasn't a multiple of 8. Audit fix, kept
    // through the FM 5-426 merge.)
    let xPos = 0;
    if (stagger > 0) {
      const w = Math.min(stagger, L);
      panelAt(w / 2, w, zC, rowW);
      xPos = w;
    }
    while (xPos < L - 0.01) {
      const w = Math.min(8, L - xPos);
      panelAt(xPos + w / 2, w, zC, rowW);
      xPos += w;
    }
  }

  // Stairs (stage 4, after the deck): three 2x12 stringers + 2x10 treads, straight run
  // descending west under the opening. Housed-stringer look; cut-stringer layout math is
  // on the member card.
  if (stair && lv.slabTop !== undefined) {
    const urFt = stair.unitRiseIn / FT;
    const urunFt = stair.unitRunIn / FT;
    const rise = stair.totalRiseFt;
    const beta = Math.atan2(urFt, urunFt);
    const strD = DRESSED['2x12']!.d / FT;
    // A STRINGER RUNS FLOOR TO FLOOR, and this one ran through the basement slab into the
    // earth — about nine inches of 2x12 below a four-inch floor. Two mistakes compounded:
    //
    //   The LENGTH came from `hypot(runFt, totalRise)`, which mixes the opening's run (TREADS
    //   unit runs) with the full rise (RISERS unit rises). A flight always has one more riser
    //   than treads — the top nosing is the floor above — so those two numbers describe a line
    //   at a different pitch than `beta`, the pitch the board is actually rotated to. Length
    //   and angle disagreed, and nothing downstream could notice.
    //
    //   The board was then dropped half its depth square to the run, which is right at the TOP
    //   (the first nosing IS the floor) and wrong at the bottom, where the cut is level and
    //   the board sits ON the slab.
    //
    // Both go away by placing the board off its two real ends instead: the axis length that
    // puts the LOWER corner on the slab while the UPPER corner stays at the floor above. The
    // upper edge still runs past the last tread, which is the sawtooth this rectangle stands
    // in for.
    const strLen = (rise - strD * Math.cos(beta)) / Math.sin(beta);
    const cx = stair.x1 - (strLen / 2) * Math.cos(beta) + (strD / 2) * Math.sin(beta);
    const cy = -(strLen / 2) * Math.sin(beta) - (strD / 2) * Math.cos(beta);
    const zs = [stair.z1 + 0.1, (stair.z1 + stair.z2) / 2, stair.z2 - 0.1];
    for (const z of zs) {
      emit('stringer', '2x12', strLen, [cx, cy, z], [0, 0, beta], 4, {
        nailing: 'top plumb cut to trimmer + kicker at slab (PH)',
        doctrineRef: `FM 5-426 stair layout (PH page): ${stair.risers} risers @ ${stair.unitRiseIn.toFixed(2)}", ${stair.treads} treads @ ${stair.unitRunIn}"`,
      });
    }
    for (let k = 1; k <= stair.treads; k++) {
      emit('tread', '2x10', stair.z2 - stair.z1 - 0.3, [stair.x1 - (k - 0.5) * urunFt, -k * urFt - t / 2, (stair.z1 + stair.z2) / 2], [-Math.PI / 2, -Math.PI / 2, 0], 4, {
        nailing: '3-16d per stringer (PH)',
        doctrineRef: 'FM 5-426 stair treads on stringers (PH page)',
      });
    }
  }

  return members;
}
