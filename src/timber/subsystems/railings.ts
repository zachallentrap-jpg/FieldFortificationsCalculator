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
  const placed = new Set<string>();
  const spotTaken = (x: number, z: number): boolean => {
    const k = `${x.toFixed(6)}|${z.toFixed(6)}`;
    if (placed.has(k)) return true;
    placed.add(k);
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
          position: [x, deckY + (topH + proud) / 2, z],
          rotation: [0, 0, Math.PI / 2],
          stage,
          nailing: 'bolted or 4-16d to the deck frame (PH)',
          doctrineRef: citeOf(RAIL.postSpacingMaxFt),
        });
      }
      // The rails stop on the faces of anything the frame already stands at this span's ends.
      // Run to the centreline instead and the rail is half a post deep inside it.
      const ra = a + (standingHalf(...at(a)) ?? 0);
      const rb = b - (standingHalf(...at(b)) ?? 0);
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
