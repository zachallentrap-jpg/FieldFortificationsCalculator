// TIMBER-2 T7 — the crib bunker (plan §7 T7, §2.7 boundary NORMATIVE).
//
// ═══ READ THIS BEFORE CHANGING ANYTHING IN THIS FILE ═══
//
// This family sits on the boundary between two tools, and the boundary is the point:
//
//   THE SURVIVABILITY TOOL (SAP-2) owns how much earth defeats what, and every output a reader
//   could take as "you are protected." Those answers carry a commissioning ceremony — an
//   operator enters, cites, verifies and signs for every number — and a carpentry tool that
//   produces one has end-run that ceremony for free.
//
//   THIS FAMILY owns the WOOD. Posts, caps, stringers, lagging, the entrance: sized to carry a
//   USER-STATED depth of soil as dead load, exactly the way a roof is sized for a stated snow
//   load. `designCoverDepthFt` is an INPUT this module consumes. It is never an output this
//   module computes, and there is no code path here that could make it one.
//
// Three mechanisms keep that true rather than merely intended:
//   1. `COVER_DEPTH_NOTE` — one sentence, one definition, rendered on the card, on the soil
//      ghost's label, and on the BOM header. Never paraphrased at a call site.
//   2. The stringer table is CAPPED at its last reviewed row. Past that the family reports that
//      nobody has checked it instead of extrapolating a curve through unreviewed territory.
//   3. The soil ghost is a 0-board-foot member. It is massing, so a person can see what the
//      structure is under; it is not material, so it never reaches a bill.
//
// The boundary gate (plan §6.4) scans this file's string literals for protection vocabulary.
// If you find yourself wanting a word it rejects, the sentence belongs in the other tool.

import type { Member } from '../types';
import { DRESSED } from '../types';
import type { BunkerSpec } from '../spec';
import { makeEmitter } from '../emit';
import { BUNKER, LUMBER, TOLERANCE, IN_PER_FT, citeOf, COVER_DEPTH_NOTE } from '../doctrine';
import { stagePlan, requireOrdinal, type StagePlanEntry } from '../stagePlan';
import { generateCribWall } from '../subsystems/cribwork';
import type { FloorLevels } from '../floor';

/**
 * Clear width of the doorway, in feet. Geometry, not doctrine: the header used to be cut to a
 * flat 4 ft with no stated opening at all, so there was no number anywhere saying how wide the
 * way in was. Four feet is that same figure, named — wide enough for a man with a casualty on a
 * litter, which is the load that sets a bunker entrance.
 */
const ENTRY_WIDTH_FT = 4;

export interface BunkerResult {
  members: Member[];
  levels: FloorLevels;
  stagePlan: StagePlanEntry[];
  /** Dead load the wood was sized for, stated in the open so nobody has to infer it. */
  deadLoadPsf: number;
  /** Set when the stated depth needs a span past the last reviewed table row. */
  pastReviewedTable: string | null;
}

export function bunkerStagePlan(wallType: BunkerSpec['wallType'], showSoil: boolean): StagePlanEntry[] {
  const rows: Parameters<typeof stagePlan>[0] = [
    // The hole itself is not modelled — staking its lines is real work that puts no member in
    // the model, which is what `noMembers` declares. Without it this row is indistinguishable
    // from a stage nothing was ever written for.
    { key: 'layout', label: 'Layout & excavation lines', detail: 'The hole is a survivability task; what is staked here is the wood that goes in it.', noMembers: true },
    wallType === 'crib'
      ? { key: 'cribwork', label: 'Cribwork', detail: 'Courses laid at right angles to each other so every log bears across the two below it. The corner is the whole idea.' }
      : { key: 'walls', label: 'Posts & lagging', detail: 'Posts on the spacing, lagging behind them holding the face.' },
    { key: 'plates', label: 'Caps', detail: 'Caps across the post tops, spreading the load off the stringers into the walls.' },
    { key: 'roof-frame', label: 'Overhead stringers', detail: 'Stringers across the clear span, sized for the stated depth of soil as a dead load.' },
    { key: 'roof-deck', label: 'Lagging over', detail: 'Lagging over the stringers, so nothing above falls between them.' },
    { key: 'openings-built', label: 'Entrance', detail: 'Straight through, or offset so the way in is not a straight line.' },
  ];
  if (showSoil) {
    rows.push({ key: 'soil-ghost', label: 'Cover (massing only)', detail: COVER_DEPTH_NOTE });
  }
  return stagePlan(rows);
}

/** Stringer nominal for a clear span, and whether the table had a reviewed row for it. */
export function stringerFor(clearSpanFt: number): { nominal: string; reviewed: boolean; rowFt: number } {
  const table = BUNKER.stringerBySpan.value as Record<number, string>;
  const maxRow = BUNKER.maxReviewedSpanFt.value as number;
  const rows = Object.keys(table).map(Number).sort((a, b) => a - b);
  const row = rows.find((r) => r >= clearSpanFt);
  if (row !== undefined) return { nominal: table[row]!, reviewed: true, rowFt: row };
  // Past the last row: hand back the deepest reviewed member and SAY it is past the table.
  const last = rows[rows.length - 1]!;
  return { nominal: table[last]!, reviewed: clearSpanFt <= maxRow, rowFt: last };
}

export function generateBunker(spec: BunkerSpec): BunkerResult {
  const emit = makeEmitter('BK');
  const plan = bunkerStagePlan(spec.wallType, spec.showSoilCover !== false);
  const sLayout = requireOrdinal(plan, 'layout');
  const sWall = spec.wallType === 'crib' ? requireOrdinal(plan, 'cribwork') : requireOrdinal(plan, 'walls');
  const sCap = requireOrdinal(plan, 'plates');
  const sStringer = requireOrdinal(plan, 'roof-frame');
  const sLag = requireOrdinal(plan, 'roof-deck');
  const sEntry = requireOrdinal(plan, 'openings-built');

  const L = spec.interiorLengthFt;
  const W = spec.interiorWidthFt;
  const H = spec.clearHeightFt;
  const postNominal = BUNKER.postNominal.value as string;
  const capNominal = BUNKER.capNominal.value as string;
  const lagNominal = BUNKER.laggingNominal.value as string;
  const postSpacing = BUNKER.postSpacingFt.value as number;
  const wallThick = spec.wallType === 'crib'
    ? DRESSED[BUNKER.cribLogNominal.value as string]!.w / IN_PER_FT * 3
    : DRESSED[postNominal]!.w / IN_PER_FT;

  // The clear span the overhead has to cross is the interior width, and the stated depth of
  // soil is what it carries. Both are printed rather than assumed.
  const stringer = stringerFor(W);
  const deadLoadPsf = spec.designCoverDepthFt * (BUNKER.soilPcf.value as number);
  const pastReviewedTable = stringer.reviewed
    ? null
    : `A ${W} ft clear span is past the last reviewed row of the stringer table (${stringer.rowFt} ft). `
      + `The ${stringer.nominal} shown is the deepest reviewed member, NOT a sized answer — this span needs review before it is built.`;

  // ── Floor plane: nothing is built, so nothing is emitted. Stated here so the absence reads
  // as a decision rather than an omission — a bunker floor is graded, not framed.

  // ── Walls
  const outerL = L + 2 * wallThick;
  const outerW = W + 2 * wallThick;
  const corners: [number, number][] = [
    [0, 0], [outerL, 0], [outerL, outerW], [0, outerW],
  ];

  // ── THE DOORWAY IS A HOLE, and the wall pass has to be told so.
  //
  // Resolved here rather than fifty lines down where it is framed, because the framing was the
  // only thing that knew about it. Jambs, a header and a baffle were all placed correctly around
  // an opening that was then LAGGED SHUT: eleven full-width courses ran straight across it, and
  // two of the wall's own posts stood inside the clear span, each overlapping a jamb by 0.6 in.
  // Every point sampled inside the doorway rectangle came back solid. The bunker had no way in.
  const doorWidth = Math.min(ENTRY_WIDTH_FT, outerW - 2 * wallThick);
  const doorZ0 = outerW / 2 - doorWidth / 2;
  const doorZ1 = outerW / 2 + doorWidth / 2;
  const jambNominal = postNominal;
  const jambT = DRESSED[jambNominal]!.w / IN_PER_FT;
  /** What the wall must leave clear, in world z: the opening plus the jambs that frame it. */
  const doorClear: [number, number] = [doorZ0 - jambT, doorZ1 + jambT];
  if (spec.wallType === 'crib') {
    // ONE POST PER CORNER. Each side runs its posts inclusive of both ends, so every corner of
    // the crib got a 6x6 from the side arriving and another from the side leaving — four doubled
    // posts, 65 board feet of heavy timber on the cut list that does not exist.
    const setPosts = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 4]!;
      emit.members.push(...generateCribWall({
        from: [a[0], a[1]],
        to: [b[0], b[1]],
        baseY: 0,
        heightFt: H,
        depthFt: wallThick,
        stage: sWall,
        prefix: `BKC${i}`,
      }));
    }
  } else {
    // ONE POST PER CORNER. Each side runs its posts inclusive of both ends, so every corner of
    // the crib got a 6x6 from the side arriving and another from the side leaving — four doubled
    // posts, 65 board feet of heavy timber on the cut list that does not exist.
    const setPosts = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 4]!;
      const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ux = (b[0] - a[0]) / run;
      const uz = (b[1] - a[1]) / run;
      // The entrance is in the -X end wall, so that is the side with something to leave out.
      const onEntryWall = Math.abs(a[0]) < 1e-9 && Math.abs(b[0]) < 1e-9;
      const uOf = (pz: number): number => (pz - a[1]) * uz;
      const gap: [number, number] | null = onEntryWall
        ? (uOf(doorClear[0]) < uOf(doorClear[1])
          ? [uOf(doorClear[0]), uOf(doorClear[1])]
          : [uOf(doorClear[1]), uOf(doorClear[0])])
        : null;
      const halfPost = DRESSED[postNominal]!.d / IN_PER_FT / 2;
      const n = Math.max(2, Math.round(run / postSpacing) + 1);
      for (let k = 0; k < n; k++) {
        const d = (run * k) / (n - 1);
        // A post that would stand in the doorway is not built; the jamb is its replacement.
        if (gap && d + halfPost > gap[0] + 1e-9 && d - halfPost < gap[1] - 1e-9) continue;
        const px = a[0] + ux * d;
        const pz = a[1] + uz * d;
        const spot = `${px.toFixed(6)}|${pz.toFixed(6)}`;
        if (setPosts.has(spot)) continue;
        setPosts.add(spot);
        emit('post', postNominal, {
          cutLengthFt: H,
          position: [px, H / 2, pz],
          rotation: [0, 0, Math.PI / 2],
          stage: sWall,
          nailing: 'set against the cut face; capped and drift-pinned (PH)',
          doctrineRef: citeOf(BUNKER.postNominal),
        });
      }
      // Lagging behind the posts, holding the face between them.
      const lagH = DRESSED[lagNominal]!.d / IN_PER_FT;
      // One course is one board unless the doorway interrupts it, in which case it is the two
      // boards either side of the opening — which is what you would cut, and what leaves a hole.
      const spans: [number, number][] = gap
        ? ([[0, gap[0]], [gap[1], run]] as [number, number][]).filter((sp) => sp[1] - sp[0] > TOLERANCE.minSliverFt)
        : [[0, run]];
      for (let y = lagH / 2; y < H; y += lagH) {
        for (const [u0, u1] of spans) {
          const mid = (u0 + u1) / 2;
          emit('lagging', lagNominal, {
            cutLengthFt: u1 - u0,
            position: [a[0] + ux * mid, y, a[1] + uz * mid],
            rotation: [0, Math.atan2(-uz, ux), 0],
            stage: sWall,
            nailing: 'spiked to each post (PH)',
            doctrineRef: citeOf(BUNKER.laggingNominal),
          });
        }
      }
    }
  }

  // ── Caps along the two long walls, carrying the stringers.
  const capD = DRESSED[capNominal]!.d / IN_PER_FT;
  const capY = H + capD / 2;
  for (const z of [wallThick / 2, outerW - wallThick / 2]) {
    emit('capBeam', capNominal, {
      cutLengthFt: outerL,
      position: [outerL / 2, capY, z],
      rotation: [0, 0, 0],
      stage: sCap,
      nailing: 'drift-pinned to every post or crib course (PH)',
      doctrineRef: citeOf(BUNKER.capNominal),
    });
  }

  // ── Overhead stringers across the clear span, then lagging over them.
  const stringerD = DRESSED[stringer.nominal]!.d / IN_PER_FT;
  const stringerY = capY + capD / 2 + stringerD / 2;
  const stringerSpacing = BUNKER.stringerSpacingFt.value as number;
  const nStringers = Math.max(2, Math.floor(outerL / stringerSpacing) + 1);
  for (let i = 0; i < nStringers; i++) {
    emit('ohcStringer', stringer.nominal, {
      cutLengthFt: outerW,
      position: [(outerL * i) / (nStringers - 1), stringerY, outerW / 2],
      rotation: [0, Math.PI / 2, 0],
      stage: sStringer,
      nailing: 'bearing on the caps both ends; drift-pinned (PH)',
      doctrineRef: citeOf(BUNKER.stringerBySpan),
    });
  }
  const lagW = DRESSED[lagNominal]!.d / IN_PER_FT;
  const lagT = DRESSED[lagNominal]!.w / IN_PER_FT;
  const lagY = stringerY + stringerD / 2 + lagT / 2;
  for (let z = lagW / 2; z < outerW; z += lagW) {
    emit('lagging', lagNominal, {
      cutLengthFt: outerL,
      position: [outerL / 2, lagY, Math.min(z, outerW - lagW / 2)],
      // Lagging is the roof DECK — laid flat, edge to edge. The spacing loop steps by face
      // width and the height by thickness, so at [0,0,0] the two disagreed and the roof came
      // out as a rank of boards on edge with daylight between them.
      rotation: [-Math.PI / 2, 0, 0],
      stage: sLag,
      nailing: 'spiked to every stringer (PH)',
      doctrineRef: citeOf(BUNKER.laggingNominal),
    });
  }

  // ── Entrance: straight through, or offset so the way in turns.
  //
  // The doorway is in the -X end wall, on the centreline. Two pieces frame it and both used to
  // be placed by hand against no datum at all:
  //
  //   THE BAFFLE was one 6x6, eight feet long, rotated so its LENGTH stood vertical — a single
  //   post out in the open two feet clear of the bunker, a quarter of it underground and a foot
  //   of it over the cap. A baffle is a WALL you have to walk around, and a wall is posts with
  //   something spanning them, standing on the ground and no taller than what it shields.
  //   THE HEADER spanned the doorway a foot and a half inboard of it, bearing on nothing. Over
  //   a crib bunker — whose ends are open by construction — it hung in mid-air.
  // Jambs first: the header has to land on something, and on a crib bunker there is no end wall
  // for it to land on.
  for (const z of [doorZ0 - jambT / 2, doorZ1 + jambT / 2]) {
    emit('post', jambNominal, {
      cutLengthFt: H,
      position: [wallThick / 2, H / 2, z],
      rotation: [0, 0, Math.PI / 2],
      stage: sEntry,
      nailing: 'set against the end of the wall run; capped (PH)',
      doctrineRef: citeOf(BUNKER.postNominal),
    });
  }
  const headerNominal = LUMBER.headerNominal.value as string;
  emit('header', headerNominal, {
    cutLengthFt: doorWidth + 2 * jambT,
    position: [wallThick / 2, H + DRESSED[headerNominal]!.d / IN_PER_FT / 2, outerW / 2],
    rotation: [0, Math.PI / 2, 0],
    stage: sEntry,
    nailing: '3-16d ea end (PH)',
    doctrineRef: 'FM 5-426 header table by span (PH)',
  });

  if (spec.entrance === 'baffle') {
    const offset = BUNKER.baffleOffsetFt.value as number;
    // A short wall standing off the doorway, overlapping it far enough that you cannot see or
    // shoot straight in. Posts to the ground, lagging across them — the same two pieces the
    // bunker's own walls are made of, so it reads as part of the same structure.
    //
    // IT STARTED AT THE DOORWAY'S CENTRE. `outerW / 2` is the middle of the opening, not its
    // edge, so the baffle covered the outer half and left the inner half — two feet of a
    // five-foot doorway — with a clear straight line in from outside. The comment above has said
    // "you cannot see or shoot straight in" since the day it was written, and you could.
    //
    // The rule now, stated so it can be tested: cover the doorway from JAMB to JAMB, and run
    // past the far jamb by the standoff distance so the 45° sightline round the far end is shut
    // too. The near end stays open — that is not a gap, that is the way in: you come down the
    // slot between the baffle and the wall and turn through the door.
    const baffleZ0 = outerW / 2 - doorWidth / 2 - jambT;
    const baffleZ1 = outerW / 2 + doorWidth / 2 + jambT + offset;
    const run = baffleZ1 - baffleZ0;
    const posts = Math.max(2, Math.round(run / postSpacing) + 1);
    for (let i = 0; i < posts; i++) {
      emit('baffleWall', postNominal, {
        cutLengthFt: H,
        position: [-offset, H / 2, baffleZ0 + (run * i) / (posts - 1)],
        rotation: [0, 0, Math.PI / 2],
        stage: sEntry,
        nailing: 'free-standing: set in the ground and braced back to the entrance (PH)',
        doctrineRef: citeOf(BUNKER.baffleOffsetFt),
      });
    }
    const lagH = DRESSED[lagNominal]!.d / IN_PER_FT;
    for (let y = lagH / 2; y < H; y += lagH) {
      emit('baffleWall', lagNominal, {
        cutLengthFt: run,
        position: [-offset - DRESSED[postNominal]!.w / IN_PER_FT / 2, Math.min(y, H - lagH / 2), (baffleZ0 + baffleZ1) / 2],
        rotation: [0, Math.PI / 2, 0],
        stage: sEntry,
        nailing: 'spiked to each post (PH)',
        doctrineRef: citeOf(BUNKER.baffleOffsetFt),
      });
    }
  }

  // ── Soil, as MASSING. Zero board-feet, never material: it is here so a person can see what
  // the structure sits under, and its label is the boundary sentence itself.
  if (spec.showSoilCover !== false && spec.designCoverDepthFt > 0) {
    emit('soilGhost', 'earth cover (massing)', {
      cutLengthFt: outerL,
      position: [outerL / 2, lagY + lagT / 2 + spec.designCoverDepthFt / 2, outerW / 2],
      rotation: [0, 0, 0],
      stage: requireOrdinal(plan, 'soil-ghost'),
      // THE SAME CONVENTION AS EVERY OTHER MEMBER: `d` is the face width — local Y, and with
      // rotation [0,0,0] that is the VERTICAL one — and `w` is the thickness on local Z. These
      // two were swapped, and the 3D viewer carried a private swap of its own to undo it, so the
      // pair looked right and nothing else did. `thumbnails.ts` reads the convention straight, so
      // the picker card drew the earth cover 10.92 ft tall and 2 ft deep instead of 2 ft tall and
      // 10.92 deep: a monolith standing on edge on the bunker's roof, engulfing the structure,
      // on the first thing anyone sees of this family.
      actual: { w: outerW * IN_PER_FT, d: spec.designCoverDepthFt * IN_PER_FT },
      nailing: 'not built — massing only (PH)',
      doctrineRef: COVER_DEPTH_NOTE,
    });
  }

  return {
    members: emit.members,
    levels: { subfloorTop: 0, joistTop: 0, sillTop: 0, gradeY: 0 },
    stagePlan: plan,
    deadLoadPsf: Math.round(deadLoadPsf),
    pastReviewedTable,
  };
}
