// TIMBER-2 T5 — what actually fills a rough opening.
//
// Every door and window in this toolkit was a HOLE. Not a modelling simplification — a hole: the
// siding is cut around the rough opening, so from outside you looked through the wall at the
// cripples and the rough sill behind it, on all fourteen shipped cards.
//
// Everything needed to notice was already in the tree, which is the interesting part:
//
//   · `OpeningSpec.fill` is written by every preset and by both "+ Door" / "+ Window" buttons,
//     as 'door-ledged' and 'window-shutter'. Nothing read it. Not one branch anywhere.
//   · `MemberRole` has carried 'doorBoard' | 'doorLedge' | 'doorBrace' | 'shutter' since T5.
//     Nothing emitted them.
//   · `labels.ts` has a plain-language name for 'shutter', for a member that never existed.
//   · The plan's T5 contents name `builtOpenings.ts` by filename, and its acceptance test —
//     "ledged door w/ brace-direction test" — was never written because the module never was.
//
// So the spec asked, the type system had a word for the answer, the UI could already name it,
// and the file the plan named did not exist. A field nothing reads is invisible; a field
// EVERYTHING writes and nothing reads is invisible in a way that looks finished.
//
// WHAT THIS BUILDS. A ledged-and-braced door is a real assembly and is built as one, because its
// geometry is the teaching point: boards, three ledges across the back, and two braces whose
// DIRECTION is load-bearing (see below). A shutter is built as its boards, so the cut list says
// what you would actually cut — nobody buys a 19-inch-wide 1x6. Screens are one panel in the
// opening, the same `screenPanel` the hut's screened band already uses.

import type { Member, WallId } from '../types';
import { DRESSED } from '../types';
import type { OpeningFill, OpeningSpec, WallOpenings } from '../spec';
import { makeEmitter } from '../emit';
import { OPENING, HUT, IN_PER_FT, citeOf } from '../doctrine';
import { wallTilePlacement, type WallSurface } from './coverings';
import { generateStair } from './access';

export interface BuiltOpeningsInput {
  surfaces: WallSurface[];
  /** The spec's openings, per wall — a cutout's `openingIndex` indexes into these. */
  openings: WallOpenings;
  stage: number;
  /** Everything nailed to the wall's outer face: sheathing plus siding. A shutter hangs on it. */
  skinThickFt: number;
  /** The hut's shutter mode. 'none' leaves the window open; anything else hangs the pair. */
  shutters?: 'none' | 'side' | 'propped';
}

const ft = (inches: number): number => inches / IN_PER_FT;

/** Widths of the boards that cover a run, last one ripped — what you would really cut. */
function boardRun(runFt: number, boardWFt: number): { u0: number; u1: number }[] {
  const out: { u0: number; u1: number }[] = [];
  for (let u = 0; u < runFt - 1e-9; u += boardWFt) out.push({ u0: u, u1: Math.min(u + boardWFt, runFt) });
  return out;
}

export function generateBuiltOpenings(input: BuiltOpeningsInput): Member[] {
  const emit = makeEmitter('BO');
  const { surfaces, openings, stage, skinThickFt } = input;

  const boardNominal = OPENING.doorBoardNominal.value as string;
  const boardT = ft(DRESSED[boardNominal]!.w); // 3/4 in
  const boardW = ft(DRESSED[boardNominal]!.d); // 5 1/2 in
  const ledgeNominal = OPENING.doorLedgeNominal.value as string;
  const ledgeT = ft(DRESSED[ledgeNominal]!.w);
  const ledgeD = ft(DRESSED[ledgeNominal]!.d);
  const clr = ft(OPENING.leafClearanceIn.value as number);
  const lap = ft(OPENING.shutterLapIn.value as number);
  const ledgeCount = OPENING.doorLedges.value as number;
  const braceCount = OPENING.doorBraces.value as number;

  for (const s of surfaces) {
    const list: OpeningSpec[] = openings[s.wall] ?? [];
    for (const cut of s.cutouts) {
      const o: OpeningSpec | undefined = list[cut.openingIndex];
      const fill: OpeningFill = o?.fill ?? 'rough';
      if (fill === 'rough') continue;

      const roW = cut.u1 - cut.u0;
      const roH = cut.v1 - cut.v0;
      if (roW <= 2 * clr || roH <= 2 * clr) continue;

      // ── The leaf that fills the opening itself ────────────────────────────
      if (fill === 'door-ledged') {
        emitLedgedDoor(s, cut, o!, roW, roH);
      } else if (fill === 'door-screen' || fill === 'window-screen'
        || fill === 'vent-screen' || fill === 'window-screen-shutter') {
        emitScreen(s, cut, roW, roH);
      }

      // ── And what hangs on the wall outside it ─────────────────────────────
      const wantsShutter = fill === 'window-shutter' || fill === 'window-screen-shutter';
      if (wantsShutter && (input.shutters ?? 'side') !== 'none') {
        emitShutterPair(s, cut, roW, roH);
      }
    }
  }

  /**
   * A LEDGED-AND-BRACED DOOR, and the brace direction is the whole of it.
   *
   * The leaf's weight hangs off the hinge jamb and tries to drop the latch edge. A brace that
   * runs DOWN from the hinge side to the latch side is then in TENSION across a nailed lap
   * joint, which is the one thing a nailed joint is bad at, and the door racks into a
   * parallelogram within a season. The brace has to run UP from the hinge side so the sag loads
   * it in COMPRESSION, straight down its length into the bottom hinge. Every carpentry text says
   * it and every field-built door gets it wrong at least once.
   *
   * The hinge jamb here is the u0 edge — the left one seen from outside — stated rather than
   * inferred, because with no hinge in the model the direction would otherwise be arbitrary and
   * a test could not tell right from wrong.
   */
  function emitLedgedDoor(s: WallSurface, cut: { u0: number; u1: number; v0: number; v1: number },
    o: OpeningSpec, roW: number, roH: number): void {
    const leafU0 = cut.u0 + clr;
    const leafW = roW - 2 * clr;
    const leafV0 = cut.v0 + clr;
    const leafH = roH - 2 * clr;
    // The boards' OUTER face lies in the wall's outer face, so the leaf is recessed behind the
    // sheathing and siding by exactly their thickness — which is where a door hung on jambs is.
    const boardStand = -boardT;
    const backStand = -(boardT + ledgeT);

    for (const b of boardRun(leafW, boardW)) {
      const p = wallTilePlacement(s, { u0: leafU0 + b.u0, u1: leafU0 + b.u1, v0: leafV0, v1: leafV0 + leafH }, boardStand, boardT);
      emit('doorBoard', boardNominal, {
        cutLengthFt: p.heightFt,
        position: p.position,
        rotation: [0, p.rotation[1]!, Math.PI / 2],
        stage,
        wall: s.wall,
        actual: { w: DRESSED[boardNominal]!.w, d: p.widthFt * IN_PER_FT },
        nailing: `${2 * ledgeCount}-6d clenched through the ledges (PH)`,
        doctrineRef: citeOf(OPENING.doorBoardNominal),
      });
    }

    // Ledges: top, bottom, and the rest shared out evenly between them.
    const ledgeVs: number[] = [];
    for (let i = 0; i < ledgeCount; i++) {
      const t = ledgeCount === 1 ? 0.5 : i / (ledgeCount - 1);
      ledgeVs.push(leafV0 + ledgeD / 2 + t * (leafH - ledgeD));
    }
    for (const v of ledgeVs) {
      const p = wallTilePlacement(s, { u0: leafU0, u1: leafU0 + leafW, v0: v - ledgeD / 2, v1: v + ledgeD / 2 }, backStand, ledgeT);
      emit('doorLedge', ledgeNominal, {
        cutLengthFt: p.widthFt,
        position: p.position,
        rotation: p.rotation,
        stage,
        wall: s.wall,
        actual: { w: DRESSED[ledgeNominal]!.w, d: p.heightFt * IN_PER_FT },
        nailing: 'boards are nailed through it and clenched over — counted on the boards (PH)',
        doctrineRef: citeOf(OPENING.doorLedges),
      });
    }

    // Braces: one in each bay between consecutive ledges, rising toward the latch.
    for (let i = 0; i < Math.min(braceCount, ledgeVs.length - 1); i++) {
      const vLo = ledgeVs[i]! + ledgeD / 2;
      const vHi = ledgeVs[i + 1]! - ledgeD / 2;
      const rise = vHi - vLo;
      if (rise <= ledgeD / 4) continue;
      const run = leafW;
      // CUT TO FIT, which is what its own nailing note says and what the first cut did not do.
      // A brace is a stick with WIDTH, and a rectangle of width w laid on a diagonal overhangs
      // the corners of the bay it is in by half that width in each direction — so a brace cut to
      // the full diagonal stood 3 5/8 in outside the leaf, past the jamb, in the wall. Shortening
      // it by the width's own projection brings both ends inside the bay; the larger of the two
      // ratios is the binding one, since the bay is not square.
      const diag = Math.hypot(run, rise);
      const len = Math.max(ledgeD, diag - ft(DRESSED[ledgeNominal]!.d) * Math.max(rise / run, run / rise));
      const p = wallTilePlacement(s, { u0: leafU0, u1: leafU0 + leafW, v0: vLo, v1: vHi }, backStand, ledgeT);
      emit('doorBrace', ledgeNominal, {
        cutLengthFt: len,
        position: p.position,
        // +rz tilts the local X axis up in the direction of increasing u — away from the u0
        // hinge jamb. That sign IS the compression direction; a test asserts it.
        rotation: [0, p.rotation[1]!, Math.atan2(rise, run)],
        stage,
        wall: s.wall,
        actual: { w: DRESSED[ledgeNominal]!.w, d: DRESSED[ledgeNominal]!.d },
        nailing: '2-6d ea end into the ledges (PH)',
        doctrineRef: citeOf(OPENING.doorBraces),
      });
    }
    void o;
  }

  /** A screen insert: one panel in the plane of the opening. */
  function emitScreen(s: WallSurface, cut: { u0: number; u1: number; v0: number; v1: number },
    roW: number, roH: number): void {
    const t = ft(HUT.screenClothThickIn.value as number);
    const p = wallTilePlacement(s, cut, -t, t);
    emit('screenPanel', 'screen cloth', {
      cutLengthFt: p.widthFt,
      position: p.position,
      rotation: p.rotation,
      stage,
      wall: s.wall,
      actual: { w: HUT.screenClothThickIn.value as number, d: p.heightFt * IN_PER_FT },
      nailing: 'staples @ 4" + batten (PH)',
      doctrineRef: citeOf(HUT.screenClothThickIn),
    });
    void roW; void roH;
  }

  /**
   * A PAIR OF SHUTTERS, closed, hung on the outside of the finished wall.
   *
   * They lap the opening rather than fitting it — a shutter that stopped at the rough opening
   * would leave a light gap all round, which is the one thing a blackout shutter must not do.
   *
   * Built as its boards AND its battens, because a leaf of loose boards is not a shutter: the
   * two cross-pieces are what hold it together and what the hinges screw to.
   *
   * Both carry the `shutter` role, including the battens. The first cut gave the battens the
   * `batten` role — the right carpentry word — and that was wrong for a reason worth keeping:
   * `batten` already means the vertical strip over a board-and-batten SIDING joint, so on the
   * storage-shed card the two would have been indistinguishable, and the first probe written
   * against it duly reported 117 built-opening members on a card that has none. A role is a
   * question the model gets asked; two answers to it is a role that cannot be filtered on.
   */
  function emitShutterPair(s: WallSurface, cut: { u0: number; u1: number; v0: number; v1: number },
    roW: number, roH: number): void {
    const leafW = roW / 2 + lap;
    const leafH = roH + 2 * lap;
    const v0 = cut.v0 - lap;
    const stand = skinThickFt; // it hangs ON the siding, not in the wall
    const battens = OPENING.shutterBattens.value as number;
    for (const side of [0, 1]) {
      const u0 = side === 0 ? cut.u0 - lap : cut.u0 + roW / 2;
      for (const b of boardRun(leafW, boardW)) {
        const p = wallTilePlacement(s, { u0: u0 + b.u0, u1: u0 + b.u1, v0, v1: v0 + leafH }, stand, boardT);
        emit('shutter', boardNominal, {
          cutLengthFt: p.heightFt,
          position: p.position,
          rotation: [0, p.rotation[1]!, Math.PI / 2],
          stage,
          wall: s.wall,
          actual: { w: DRESSED[boardNominal]!.w, d: p.widthFt * IN_PER_FT },
          nailing: '2-6d ea batten, clenched (PH)',
          doctrineRef: citeOf(OPENING.shutterLapIn),
        });
      }
      // The battens go on the OUTSIDE of a closed shutter, where a hinge can reach them.
      for (let i = 0; i < battens; i++) {
        const t = battens === 1 ? 0.5 : i / (battens - 1);
        const v = v0 + ledgeD / 2 + t * (leafH - ledgeD);
        const p = wallTilePlacement(s, { u0, u1: u0 + leafW, v0: v - ledgeD / 2, v1: v + ledgeD / 2 }, stand + boardT, ledgeT);
        emit('shutter', ledgeNominal, {
          cutLengthFt: p.widthFt,
          position: p.position,
          rotation: p.rotation,
          stage,
          wall: s.wall,
          actual: { w: DRESSED[ledgeNominal]!.w, d: p.heightFt * IN_PER_FT },
          nailing: 'boards are nailed through it and clenched over — counted on the boards (PH)',
          doctrineRef: citeOf(OPENING.shutterBattens),
        });
      }
    }
  }

  return emit.members;
}

/** Which fills put something in or on an opening — the rest are holes on purpose. */
export function fillBuildsSomething(fill: OpeningFill | undefined): boolean {
  return fill !== undefined && fill !== 'rough' && fill !== 'ac-sleeve';
}

export type { WallId };

// ── Getting to the door ──────────────────────────────────────────────────────

export interface EntryStepsInput {
  surfaces: WallSurface[];
  openings: WallOpenings;
  stage: number;
  /** Top of the finished floor — where a threshold is. */
  thresholdY: number;
  /** Where the ground is, under this building. */
  gradeY: number;
  /** Everything on the wall's outer face, so the bottom tread clears the siding. */
  skinThickFt: number;
}

/**
 * STEPS AT EVERY DOOR THE FLOOR HAS LIFTED OUT OF REACH.
 *
 * `BuildingSpec.entrySteps` was declared, set to `true` by every hut, and read by nothing — the
 * same shape as `OpeningSpec.fill`, found the same way and in the same file. The plan's §2.6 says
 * it in one line: "Entry steps: stair math reused at every door when floor raised >= 1.5 ft."
 *
 * Measured on the shipped cards: a piered building's threshold stands 2 ft 3 1/2 in above grade
 * and a skid building's 1 ft 1 1/2 in. So five cards had a door you could not use — the leaf, now
 * that there is one, opens onto clear air down to the pier footings — and two are below the
 * threshold where a long step up is the honest answer and no steps belong.
 *
 * The stair math is `generateStair`'s, not a second copy: same riser rule, same stringers, same
 * treads, same LS-tagged figures. What this adds is only WHERE it goes — and `arriveAt` is the
 * reason that is one line rather than a guess, because a flight is positioned by where you step
 * off it. You step off an entry stair at the threshold, facing in.
 */
export function generateEntrySteps(input: EntryStepsInput): Member[] {
  const { surfaces, openings, stage, thresholdY, gradeY, skinThickFt } = input;
  const minRise = OPENING.entryStepMinRiseFt.value as number;
  const out: Member[] = [];
  let flight = 0;
  for (const s of surfaces) {
    const list: OpeningSpec[] = openings[s.wall] ?? [];
    for (const cut of s.cutouts) {
      const o = list[cut.openingIndex];
      if (!o || o.kind !== 'door') continue;
      const sillY = thresholdY + cut.v0;
      const rise = sillY - gradeY;
      if (rise < minRise) continue;
      // The landing is the threshold: on the wall's outer face, centred on the opening, and the
      // last step is INTO the building — so the travel direction is the wall's inward normal.
      const uMid = (cut.u0 + cut.u1) / 2;
      const face = s.faceOffsetFt + skinThickFt;
      const at: [number, number] = [
        s.origin[0] + s.along[0] * uMid + s.normal[0] * face,
        s.origin[1] + s.along[1] * uMid + s.normal[1] * face,
      ];
      out.push(...generateStair({
        base: at,
        up: [-s.normal[0], -s.normal[1]],
        baseY: gradeY,
        topY: sillY,
        widthFt: cut.u1 - cut.u0,
        stage,
        arriveAt: { at, dir: [-s.normal[0], -s.normal[1]] },
        // The threshold is the top tread. See `omitTopTread`.
        omitTopTread: true,
        // One prefix per door: a building with two of them had two flights both numbering their
        // pieces from `AC-stringer-01`, and an id is what selection and the packet key on.
        idPrefix: `ES${++flight}`,
      }).members);
    }
  }
  return out;
}
