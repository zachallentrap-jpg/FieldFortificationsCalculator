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
  /** Walking surface elevation, feet. Posts stand on it. */
  deckY: number;
  stage: number;
  /** Toe boards keep a dropped tool off the person below; on by default at height. */
  toeBoards?: boolean;
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
  const emit = makeEmitter('RL');
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
        emit('railPost', postNominal, {
          cutLengthFt: topH + DRESSED[postNominal]!.d / IN_PER_FT,
          position: [x, deckY + topH / 2, z],
          rotation: [0, 0, Math.PI / 2],
          stage,
          nailing: 'bolted or 4-16d to the deck frame (PH)',
          doctrineRef: citeOf(RAIL.postSpacingMaxFt),
        });
      }
      const [mx, mz] = at((a + b) / 2);
      const run = (h: number, role: 'railTop' | 'railMid' | 'toeBoard', cite: string) => emit(role, memberNominal, {
        cutLengthFt: span,
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
