// TIMBER-2 T4 — guardrails (plan §7 T4; EM 385-1-1 via `doctrine.RAIL`).
//
// Every number here is life-safety tagged, and the module is written so that the ONE decision a
// caller can get wrong — "does this edge need a rail?" — is not theirs to make. `railEdges`
// answers it from the deck height and the doctrine threshold, and `generateRailing` refuses to
// silently produce nothing: an edge above the threshold with no rail comes back as an issue the
// UI has to show, not as a missing member nobody notices.
//
// Shared by the tower's platform (T4) and the loading platform (T6) rather than written twice.

import type { Member } from '../types';
import { DRESSED } from '../types';
import { makeEmitter } from '../emit';
import { RAIL, IN_PER_FT, citeOf } from '../doctrine';

/**
 * Shorter than this and a rail run is a rounding artifact, not an edge — half an inch of deck
 * left over by a gap does not get its own three posts. Tolerance, not doctrine.
 */
const MIN_RUN_FT = 0.5 / IN_PER_FT;

/** "On this rail line" for the corner rule — a saw kerf, not doctrine. */
const TOL_ON_LINE = 1e-6;

/** One open edge, in plan. */
export interface RailEdge {
  id: string;
  from: [x: number, z: number];
  to: [x: number, z: number];
  /** Gaps along the run, as [start, end] distances from `from` — a stair head or a ladder. */
  gaps?: [number, number][];
}

export interface RailingInput {
  edges: RailEdge[];
  /**
   * POSTS THE FRAME ALREADY STANDS AT THESE SPOTS, which are not the railing's to emit.
   *
   * The de-duplication below only sees inside this pass. A guard tower's cab carries four 4x4
   * corner posts at the deck's own corners, emitted by `tower.ts` after the railing has run, and
   * the railing put its own 4x4 in every one of those holes: two posts entirely inside each other
   * over 3 ft 8 in of height, on every cab option including the shipped one, with each edge's top
   * rail, mid rail and toe board running 1 3/4 in into the post at both of its ends — 28 pairs.
   *
   * Told what is already standing, the railing puts no post there and lands its rails on the
   * faces of what is, which is the joint a rail nailed to a corner post actually makes.
   */
  standing?: { at: [x: number, z: number]; widthFt: number }[];
  /** Walking surface elevation, feet. Posts stand on it. */
  deckY: number;
  stage: number;
  /** Toe boards keep a dropped tool off the person below; on by default at height. */
  toeBoards?: boolean;
  /**
   * Member-id prefix. Defaults to 'RL', which is right while a structure has ONE railed surface.
   * A switchback stair has a landing at every turn and each one is a railed surface of its own —
   * and every call numbers its pieces from one, so without this two landings and a platform all
   * carry `RL-railPost-01`. Ids are what selection, the highlight and the packet's anchors key
   * on; the stair generator hit this exact thing with its own flights and it is the same fix.
   */
  idPrefix?: string;
}

/** True when EM 385-1-1's fall-protection threshold applies to a surface at this height. */
export function railRequired(deckHeightFt: number): boolean {
  return deckHeightFt >= (RAIL.requiredAboveFt.value as number);
}

const len = (e: RailEdge): number => Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]);

/** Split a run into the covered spans, given its gaps. */
export function coveredSpans(edge: RailEdge): [number, number][] {
  const total = len(edge);
  const gaps = [...(edge.gaps ?? [])].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cursor = 0;
  for (const [a, b] of gaps) {
    if (a > cursor) out.push([cursor, Math.min(a, total)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < total) out.push([cursor, total]);
  return out.filter(([a, b]) => b - a > MIN_RUN_FT);
}

export function generateRailing(input: RailingInput): Member[] {
  const emit = makeEmitter(input.idPrefix ?? 'RL');
  // ONE POST PER HOLE. Every edge runs its posts inclusive of both ends, which is right for the
  // edge and wrong for the perimeter: at each corner the two edges meeting there each set a post,
  // and the model carried two 4x4s in the same place. Four of them on the platform and four on
  // the tower — 31 board feet of stock on the cut list that nobody would ever cut.
  //
  // De-duplicated by POSITION rather than by clever topology: `coveredSpans` can split an edge
  // around a gate or a ladder, so "is this the end of an edge" does not answer "is a post
  // already standing here". Where two posts land on the same spot, there is one post.
  //
  // WITHIN A POST'S WIDTH IS THE SAME SPOT. Exact equality answers the corner where two edges
  // meet at a point and nothing else: a bridge landing's rails deliberately stop half a rail's
  // thickness short of the deck's rail line so they butt its face, and its end post then landed
  // ¾ in from the deck's own — two 4x4s a quarter of an inch inside each other, twice, on every
  // tower tall enough to have a stair. Two posts cannot be closer together than one post is wide.
  const placed: [number, number][] = [];
  const spotTaken = (x: number, z: number): boolean => {
    const near = DRESSED[RAIL.postNominal.value as string]!.w / IN_PER_FT;
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < near - 1e-9)) return true;
    placed.push([x, z]);
    return false;
  };
  const standing = input.standing ?? [];
  /** Half the plan width of a frame post already standing here, or null if none is. */
  const standingHalf = (x: number, z: number): number | null => {
    const hit = standing.find((s) => Math.hypot(s.at[0] - x, s.at[1] - z) < 1e-6);
    return hit ? hit.widthFt / 2 : null;
  };
  const { edges, deckY, stage } = input;
  const postNominal = RAIL.postNominal.value as string;
  const memberNominal = RAIL.memberNominal.value as string;
  const topH = (RAIL.topHeightIn.value as number) / IN_PER_FT;
  const midH = (RAIL.midHeightIn.value as number) / IN_PER_FT;
  const toeH = (RAIL.toeBoardHeightIn.value as number) / IN_PER_FT;
  const maxSpacing = RAIL.postSpacingMaxFt.value as number;
  const toeBoards = input.toeBoards ?? true;

  // A RAIL IS NAILED TO A POST'S FACE, SO THE TWO CANNOT BE ON ONE LINE. This module already
  // knows it — `standingHalf` below stops a rail on the face of any post the FRAME stands at a
  // span's end, and says why: "run to the centreline instead and the rail is half a post deep
  // inside it". Its OWN posts, at every interval along a run, were passed straight through:
  //
  //   loading platform 53 pairs, worst 2.50 in      guard tower 6, worst 1.75
  //
  // The RAIL line is the one that cannot move — it is the deck edge, the toe board's line, the
  // gap the access opens, and on a tower the line the bridge landing's rails meet. So the POST
  // steps back off it by half of each, which is also where a post belongs: standing on the deck
  // edge it had half its own foot over the drop.
  const railT = DRESSED[memberNominal]!.w / IN_PER_FT;
  const inset = (DRESSED[postNominal]!.w / IN_PER_FT + railT) / 2;
  // WHICH WAY IS BACK is read off the run itself: the centroid of every edge in this pass is
  // inside whatever is being railed — a deck's loop, a landing's three sides, the two sides of a
  // bridge — so the post steps toward it. Nothing here has to be told which side the drop is on.
  const ends = edges.flatMap((e) => [e.from, e.to]);
  const centre: [number, number] = [
    ends.reduce((s, p) => s + p[0], 0) / Math.max(1, ends.length),
    ends.reduce((s, p) => s + p[1], 0) / Math.max(1, ends.length),
  ];
  /** Each edge's unit run and the step back off its rail line, precomputed for the corner rule. */
  const lines = edges.filter((e) => len(e) >= MIN_RUN_FT).map((e) => {
    const total = len(e);
    const u: [number, number] = [(e.to[0] - e.from[0]) / total, (e.to[1] - e.from[1]) / total];
    const m: [number, number] = [e.from[0] + u[0] * total / 2, e.from[1] + u[1] * total / 2];
    const side = (centre[0] - m[0]) * -u[1] + (centre[1] - m[1]) * u[0] >= 0 ? 1 : -1;
    return { from: e.from, u, total, back: [side * -u[1] * inset, side * u[0] * inset] as [number, number] };
  });
  /**
   * How far back a post at this spot has to step — off EVERY rail line it stands on, not just the
   * one that placed it. A CORNER post serves two runs at right angles, and stepping back from one
   * of them left the other's top rail, mid rail and toe board still running through it: 20 pairs
   * on the loading platform, the whole 2½ in. It steps back diagonally, off both.
   */
  const backAt = (x: number, z: number): [number, number] => {
    const out: [number, number] = [0, 0];
    for (const l of lines) {
      const d = (x - l.from[0]) * l.u[0] + (z - l.from[1]) * l.u[1];
      if (d < -TOL_ON_LINE || d > l.total + TOL_ON_LINE) continue;
      const off = Math.abs((x - l.from[0]) * -l.u[1] + (z - l.from[1]) * l.u[0]);
      if (off > TOL_ON_LINE) continue;
      out[0] += l.back[0];
      out[1] += l.back[1];
    }
    return out;
  };

  for (const edge of edges) {
    const total = len(edge);
    if (total < MIN_RUN_FT) continue;
    const ux = (edge.to[0] - edge.from[0]) / total;
    const uz = (edge.to[1] - edge.from[1]) / total;
    const yaw = Math.atan2(-uz, ux);
    const at = (d: number): [number, number] => [edge.from[0] + ux * d, edge.from[1] + uz * d];

    for (const [a, b] of coveredSpans(edge)) {
      const span = b - a;
      // Posts at or under the doctrine maximum, spaced evenly across the span rather than
      // marched from one end — an 8-ft maximum with a 9-ft run means two 4.5-ft bays, not an
      // 8-ft bay and a 1-ft stub.
      const bays = Math.max(1, Math.ceil(span / maxSpacing));
      for (let i = 0; i <= bays; i++) {
        const [x, z] = at(a + (span * i) / bays);
        if (standingHalf(x, z) !== null || spotTaken(x, z)) continue;
        // A POST STANDS ON THE DECK AND FINISHES FLUSH WITH THE TOP RAIL. Both ends were set by
        // one arithmetic slip: the length was `topH + the POST's own face`, centred on `topH / 2`,
        // which is right at the top by coincidence — a 4x4 and a 2x4 are both 3½ in, so half of
        // the post's face happens to equal half the RAIL's depth — and wrong at the bottom, where
        // the other half of that extra put the foot 1¾ in BELOW the walking surface. There it ran
        // through the edge board of every deck and stopped in mid-air, landing on neither the deck
        // nor the frame it is nailed to:
        //
        //   platform 34 pairs (worst 3½ x 1½ x 1¾ in)      guard tower 4
        //
        // What the post has to clear above the rail is half the RAIL's depth, so that is what it
        // is measured from — the coincidence is not a reason to keep asking the wrong piece.
        const proud = DRESSED[memberNominal]!.d / IN_PER_FT / 2;
        emit('railPost', postNominal, {
          cutLengthFt: topH + proud,
          position: [x + backAt(x, z)[0], deckY + (topH + proud) / 2, z + backAt(x, z)[1]],
          rotation: [0, 0, Math.PI / 2],
          stage,
          nailing: 'bolted or 4-16d to the deck frame (PH)',
          doctrineRef: citeOf(RAIL.postSpacingMaxFt),
        });
      }
      // The rails stop on the faces of anything the frame already stands at this span's ends.
      // Run to the centreline instead and the rail is half a post deep inside it.
      //
      // AND ON EACH OTHER, AT A CORNER. Two runs meeting at one both ran to the corner POINT, so
      // each was half its own thickness inside the other — 12 pairs on the loading platform, top
      // rail, mid rail and toe board alike, at every corner the frame does not already stand a
      // post in. Trimmed by half a thickness apiece they meet on the arris, which is the joint
      // two boards butting round a corner actually make.
      const cornerTrim = (x: number, z: number): number =>
        lines.some((l) => {
          const d = (x - l.from[0]) * l.u[0] + (z - l.from[1]) * l.u[1];
          const perp = Math.abs((x - l.from[0]) * -l.u[1] + (z - l.from[1]) * l.u[0]);
          // Another run, not this one: a point ON this edge's own line is not a corner.
          return perp <= TOL_ON_LINE && d >= -TOL_ON_LINE && d <= l.total + TOL_ON_LINE
            && Math.abs(l.u[0] * ux + l.u[1] * uz) < 1 - TOL_ON_LINE;
        }) ? railT / 2 : 0;
      const ra = a + Math.max(standingHalf(...at(a)) ?? 0, cornerTrim(...at(a)));
      const rb = b - Math.max(standingHalf(...at(b)) ?? 0, cornerTrim(...at(b)));
      const rSpan = rb - ra;
      if (rSpan < MIN_RUN_FT) continue;
      const [mx, mz] = at((ra + rb) / 2);
      const run = (h: number, role: 'railTop' | 'railMid' | 'toeBoard', cite: string) => emit(role, memberNominal, {
        cutLengthFt: rSpan,
        position: [mx, deckY + h, mz],
        rotation: [0, yaw, 0],
        stage,
        nailing: '2-16d ea post (PH)',
        doctrineRef: cite,
      });
      run(topH, 'railTop', citeOf(RAIL.topHeightIn));
      run(midH, 'railMid', citeOf(RAIL.midHeightIn));
      if (toeBoards) run(toeH / 2, 'toeBoard', citeOf(RAIL.toeBoardHeightIn));
    }
  }
  return emit.members;
}
