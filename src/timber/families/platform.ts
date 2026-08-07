// TIMBER-2 T6a — the loading platform and the tent frame (plan §7 T6).
//
// Two families in one file because they are the same idea seen twice: a framed deck on a base,
// with something on top. The platform's "something" is a railing and a ramp; the tent frame's
// is a rank of bents carrying canvas. Both reuse the subsystems the tower already needed
// (`railings`, `access`), which is the point of having split them out.
//
// WHAT THE PLATFORM IS FOR. A loading platform is a working surface at truck-bed height that
// people walk on with their hands full. Every open edge above the fall-protection threshold is
// railed, and the ramp is generated from the doctrine slope rather than drawn to fit — a ramp
// that "looks about right" is a ramp somebody drops a pallet down.
//
// THE TENT FRAME is a floor and a skeleton, not a tent: the canvas is not a member and is not
// billed. What the tool generates is what a section actually cuts and nails, which is the deck,
// the bents, and the ridge that ties them.

import type { Member } from '../types';
import { DRESSED } from '../types';
import type { PlatformSpec, TentFrameSpec } from '../spec';
import type { WallId } from '../types';
import { makeEmitter } from '../emit';
import { TENT, LUMBER, OPENING, PANEL, RAMP, PLATFORM, RAIL, IN_PER_FT, citeOf } from '../doctrine';
import { stagePlan, requireOrdinal, type StagePlanEntry } from '../stagePlan';
import { generateRailing, railRequired, type RailEdge } from '../subsystems/railings';
import { generateStair } from '../subsystems/access';
import { generateSkids } from '../subsystems/coverings';
import { headerForSpan } from '../normalize';
import type { FloorLevels } from '../floor';

/** A remainder thinner than this is not a board. Mirrors `TOLERANCE.epsFt`, stated once here. */
const EPS_FT = 1e-6;

export interface FamilyResult {
  members: Member[];
  levels: FloorLevels;
  stagePlan: StagePlanEntry[];
}

// ── Platform ─────────────────────────────────────────────────────────────────

export function platformStagePlan(hasRamp: boolean, hasSteps: boolean): StagePlanEntry[] {
  const rows: { key: Parameters<typeof stagePlan>[0][number]['key']; label: string; detail: string }[] = [
    { key: 'layout', label: 'Layout & base', detail: 'Piers or skids set to the deck lines — a platform out of level is a platform nothing sits flat on.' },
    { key: 'floor', label: 'Deck framed', detail: 'Sills, then joists across them at the framing spacing.' },
    { key: 'platform', label: 'Decked', detail: 'Planks or panels over the joists, laid tight.' },
    { key: 'railings', label: 'Guardrails', detail: 'Top rail, midrail and toe board on every open edge (EM 385-1-1).' },
  ];
  if (hasRamp || hasSteps) {
    rows.push({ key: 'stairs-access', label: 'Ramp & steps', detail: 'The way up, at the doctrine slope — never eyeballed to fit the space left over.' });
  }
  return stagePlan(rows);
}

export function generatePlatform(spec: PlatformSpec): FamilyResult {
  const emit = makeEmitter('PF');
  const plan = platformStagePlan(!!spec.ramp, !!spec.steps);
  const sBase = requireOrdinal(plan, 'layout');
  const sFrame = requireOrdinal(plan, 'floor');
  const sDeck = requireOrdinal(plan, 'platform');
  const sRail = requireOrdinal(plan, 'railings');

  const L = spec.dims.lengthFt;
  const W = spec.dims.widthFt;
  const deckY = spec.deckHeightFt;
  // THE DECK SITS ON THE JOISTS, AND `deckHeightFt` IS THE SURFACE YOU WALK ON. Everything under
  // the deck was hung off `deckY` with the JOISTS' TOPS at it, and then the decking was laid with
  // ITS top at the same figure — so the boards were buried in the top 1½ in of every joist, over
  // the platform's whole 20 by 12 ft. (A panel deck did the same in the top ¾.) The tent frame in
  // this very file has it right: it stacks skid + joist + deck and calls the TOP of that `deckY`.
  //
  // Which of the two moves is settled by what `deckHeightFt` means everywhere else — the rail pass
  // asks `railRequired(deckY)` about a fall from it, and the stair lands on it — so the walking
  // surface stays at the height the operator asked for and the frame drops by the deck's thickness.
  const deckThick = spec.deck === 'plank'
    ? DRESSED[TENT.deckNominal.value as string]!.w / IN_PER_FT
    : (PANEL.subfloorThickIn.value as number) / IN_PER_FT;
  const frameTopY = deckY - deckThick;
  const joistNominal = LUMBER.joistNominal.value as string;
  const sillNominal = LUMBER.sillNominal.value as string;
  const postNominal = LUMBER.postNominal.value as string;
  const joistDepth = DRESSED[joistNominal]!.d / IN_PER_FT;
  const sillDepth = DRESSED[sillNominal]!.d / IN_PER_FT;

  // ── Base
  //
  // SKIDS AND PIERS BOTH CARRY POSTS, and getting that wrong was a visible defect: choosing
  // skids used to emit the runners and skip the posts entirely, so a 4-ft platform hung in
  // mid-air over three timbers lying on the ground. The two bases differ in what is UNDER the
  // post — a concrete pad you pour, or a timber runner you can drag the whole thing on — not
  // in whether the deck is held up.
  // Grade is y = 0 for a platform, so the runners lie on it and the posts bear on their TOPS.
  // Standing the posts at 0 alongside a buried skid is what the pier base does, and on skids it
  // left the runners underground with the platform resting on the earth between them.
  const skidTop = spec.base === 'skids' ? DRESSED[LUMBER.skidNominal.value as string]!.d / IN_PER_FT : 0;
  if (spec.base === 'skids') emit.members.push(...generateSkids(L, W, sBase, 0));

  const bays = Math.max(1, Math.round(L / (PLATFORM.pierSpacingFt.value as number)));
  for (let i = 0; i <= bays; i++) {
    const x = (L * i) / bays;
    for (const z of [sillDepth / 2, W - sillDepth / 2]) {
      if (spec.base === 'piers') {
        const padSide = PLATFORM.padSideIn.value as number;
        const padDepth = PLATFORM.padDepthIn.value as number;
        emit('footing', `conc pad ${padSide}x${padSide}x${padDepth}`, {
          cutLengthFt: padSide / IN_PER_FT,
          position: [x, -padDepth / IN_PER_FT / 2, z],
          // Flat, like every other horizontal piece — at [0,0,0] the pad stood on end, 16 in
          // tall and 8 in across, poking a third of itself up through the ground.
          rotation: [-Math.PI / 2, 0, 0],
          stage: sBase,
          actual: { w: padDepth, d: padSide },
          nailing: 'poured on undisturbed soil (PH)',
          doctrineRef: 'FM 5-426 post footers (PH page)',
        });
      }
      const postLen = frameTopY - joistDepth - sillDepth - skidTop;
      // Below this a 'post' is a shim, not a member — the same guard floor.ts uses.
      if (postLen > (PLATFORM.minPostFt.value as number)) {
        emit('post', postNominal, {
          cutLengthFt: postLen,
          position: [x, skidTop + postLen / 2, z],
          rotation: [0, 0, Math.PI / 2],
          stage: sBase,
          nailing: spec.base === 'skids'
            ? 'toenailed and cleated to the skid (PH)'
            : 'drift-pinned to the pad; capped by the sill (PH)',
          doctrineRef: citeOf(LUMBER.postNominal),
        });
      }
    }
  }

  // ── Sills and joists
  const sillY = frameTopY - joistDepth - sillDepth / 2;
  for (const z of [sillDepth / 2, W - sillDepth / 2]) {
    emit('sill', sillNominal, {
      cutLengthFt: L,
      position: [L / 2, sillY, z],
      rotation: [0, 0, 0],
      stage: sFrame,
      nailing: 'anchored to each post cap (PH)',
      doctrineRef: citeOf(LUMBER.sillNominal),
    });
  }
  const spacing = spec.spacing.joistSpacingIn / IN_PER_FT;
  const joists = Math.max(2, Math.floor(L / spacing) + 1);
  for (let i = 0; i < joists; i++) {
    emit('joist', joistNominal, {
      cutLengthFt: W,
      position: [(L * i) / (joists - 1), frameTopY - joistDepth / 2, W / 2],
      rotation: [0, Math.PI / 2, 0],
      stage: sFrame,
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: citeOf(LUMBER.joistNominal),
    });
  }

  // ── Deck
  //
  // FLAT IS A ROTATION, NOT A POSITION. The canonical member frame runs length along local X,
  // face width along local Y and thickness along local Z, so a piece emitted at [0,0,0] stands
  // ON EDGE with its face width vertical. Every flat-lying piece in the toolkit is therefore
  // `[-PI/2, 0, 0]` (see floor.ts, which is frozen and got it right) — that quarter turn drops
  // the face width into world Z and stands the thickness up in Y. Left at zero, the position
  // math here (which spaces by face width and sinks by thickness) described a flat deck while
  // the rotation drew a comb of boards on edge, and a panel deck came out as a 4-ft plywood
  // wall standing on the joists. Both were visible in the shipped app.
  if (spec.deck === 'plank') {
    const nominal = TENT.deckNominal.value as string;
    const w = DRESSED[nominal]!.d / IN_PER_FT;
    // THE LAST BOARD IS RIPPED TO FIT. `Math.min(z, W - w / 2)` clamped the last board's CENTRE
    // back inside the platform, which does not widen the board — it just stops short, and twelve
    // feet is 26.18 boards, so an inch of the deck along the whole 20-ft edge was open. The same
    // `Math.min` is written up in bunker.ts as the wrong answer to the same question; a platform
    // is a thing people walk on with their hands full, and an inch of nothing at the edge is
    // where a boot goes. Ripped, the remainder is one narrow board and the take-off still bills
    // the width it covers.
    for (let z = 0; z < W - EPS_FT; z += w) {
      const cut = Math.min(w, W - z);
      emit('deckPlank', nominal, {
        cutLengthFt: L,
        position: [L / 2, deckY - DRESSED[nominal]!.w / IN_PER_FT / 2, z + cut / 2],
        rotation: [-Math.PI / 2, 0, 0],
        stage: sDeck,
        actual: { w: DRESSED[nominal]!.w, d: cut * IN_PER_FT },
        nailing: '2-16d ea joist (PH)',
        doctrineRef: citeOf(TENT.deckNominal),
      });
    }
  } else {
    const sheetW = PANEL.widthFt.value as number;
    const sheetL = PANEL.lengthFt.value as number;
    for (let x = 0; x < L - 1e-6; x += sheetL) {
      for (let z = 0; z < W - 1e-6; z += sheetW) {
        const cw = Math.min(sheetL, L - x);
        const cd = Math.min(sheetW, W - z);
        emit('subfloor', `${sheetW}x${sheetL} panel`, {
          cutLengthFt: cw,
          position: [x + cw / 2, deckY - (PANEL.subfloorThickIn.value as number) / IN_PER_FT / 2, z + cd / 2],
          rotation: [-Math.PI / 2, 0, 0],
          stage: sDeck,
          actual: { w: PANEL.subfloorThickIn.value as number, d: cd * IN_PER_FT },
          nailing: '8d @ 6" edges / 12" field (PH)',
          doctrineRef: citeOf(PANEL.subfloorThickIn),
        });
      }
    }
  }

  // Clear width of the step flight, and the edge it climbs to. Both the railing pass and the
  // stair pass read them, and they have to agree: the rail opens exactly where the stair lands.
  const stepWidthFt = 3;
  const stepEdge: WallId = 'E';

  // ── Rails on the edges the operator names, minus wherever the ramp lands.
  if (railRequired(deckY) && spec.railEdges.length > 0) {
    const corner: Record<WallId, [[number, number], [number, number]]> = {
      S: [[0, 0], [L, 0]],
      E: [[L, 0], [L, W]],
      N: [[L, W], [0, W]],
      W: [[0, W], [0, 0]],
    };
    const rampEdge: WallId = 'S';
    const rampW = spec.ramp?.widthFt ?? 0;
    // WHERE THE WAY UP LANDS, THE RAIL OPENS. The ramp's gap has always been here. The steps'
    // was missing, and could not have been noticed: until the flight was aimed at the deck edge
    // it climbed to a head three and a half feet inside the footprint and never reached the rail
    // at all. Gating a gap on one means of access and not the other is the tower's old fault
    // ("a stair delivering people into a closed rail", tower.ts) on a different family.
    //
    // The step gap is a POST WIDER on each side than the flight, because the stair brings its
    // own rail and its head posts stand on the flight's own edge lines. A gap cut to the bare
    // stair width puts the deck rail's terminal post in the same hole as the stair's newel —
    // two 4x4s in one place, the fault `railings.ts` fixed at the perimeter corners, recurring
    // between two passes that cannot see each other. One post depth of margin lands the two
    // face to face, which is the joint a newel actually makes.
    const railPostDepth = DRESSED[RAIL.postNominal.value as string]!.d / IN_PER_FT;
    const gapsOn = (w: WallId): [number, number][] => {
      const out: [number, number][] = [];
      if (spec.ramp && w === rampEdge) out.push([L / 2 - rampW / 2, L / 2 + rampW / 2]);
      if (spec.steps && w === stepEdge) {
        const half = stepWidthFt / 2 + railPostDepth;
        out.push([W / 2 - half, W / 2 + half]);
      }
      return out;
    };
    const edges: RailEdge[] = spec.railEdges.map((w) => {
      const gaps = gapsOn(w);
      return { id: `edge-${w}`, from: corner[w][0], to: corner[w][1], ...(gaps.length > 0 ? { gaps } : {}) };
    });
    emit.members.push(...generateRailing({ edges, deckY, stage: sRail }));
  }

  // ── Ramp: run comes from the doctrine slope, not from the space available.
  //
  // THE RAMP FRAME IS WRITTEN ONCE AND EVERY PIECE ON THE RAMP IS PLACED THROUGH IT. Each piece
  // used to carry its own trigonometry, and each got a different sign, so the ramp shipped with
  // the stringers running downhill AWAY from the platform and the planks tilted against them —
  // a fan of boards floating over a beam that started at grade where the deck should be. One
  // parameterisation, stated in comments, is the fix that keeps that from recurring:
  //
  //   surface(s) = (x, deckY·s, -run·(1-s))   s = 0 at grade, s = 1 at the platform edge
  //   upSlope    = (0, sin pitch,  cos pitch) — grade toward the deck
  //   down       = (0, -cos pitch, sin pitch) — square INTO the ramp, for stacking layers
  //
  // Pieces are then placed by saying how far BELOW the walking surface they sit, which is how a
  // carpenter would describe them: planks a half-thickness down, stringers under the planks.
  if (spec.ramp) {
    const sRamp = requireOrdinal(plan, 'stairs-access');
    const nominal = RAMP.stringerNominal.value as string;
    const rampW = spec.ramp.widthFt;
    const rampX0 = L / 2 - rampW / 2;
    const deckIsPlank = spec.deck === 'plank';
    const rampDeckNominal = TENT.deckNominal.value as string;
    const deckThick = (deckIsPlank
      ? DRESSED[rampDeckNominal]!.w
      : (PANEL.subfloorThickIn.value as number)) / IN_PER_FT;

    // THE RAMP SITS ON THE GROUND, IT IS NOT SUNK INTO IT. `s = 0` used to put the walking
    // SURFACE at grade, which buried everything holding it up: the toe plank lay entirely under
    // the ground and the stringers ran a foot deep for the last six feet of the run. The toe
    // board lies ON the earth, so the surface starts one deck thickness up, and the rise the
    // slope is measured over is what is left. The slope itself — the life-safety figure — is
    // unchanged; only the datum it starts from is.
    const toeY = deckThick;
    const rise = Math.max(1e-6, deckY - toeY);
    const run = rise * spec.ramp.slope;
    const slopeLen = Math.hypot(run, rise);
    const pitch = Math.atan2(rise, Math.max(1e-6, run));
    const downY = -Math.cos(pitch);
    const downZ = Math.sin(pitch);
    /** Center of a piece sitting `drop` feet square below the walking surface at station `s`. */
    const seat = (x: number, s: number, drop: number): [number, number, number] =>
      [x, toeY + rise * s + downY * drop, -run * (1 - s) + downZ * drop];

    // Ry(PI/2)·Rz(-pitch) sends the length axis to (0, -sin pitch, -cos pitch): walking out the
    // +X end of the stringer goes DOWNHILL and away, so the piece is high at z = 0 against the
    // platform and low at z = -run out at grade. With +pitch it was exactly reversed.
    const stringerDepth = DRESSED[nominal]!.d / IN_PER_FT;
    const stringers = Math.max(2, Math.round(rampW / 2) + 1);
    for (let i = 0; i < stringers; i++) {
      const x = rampX0 + (rampW * i) / (stringers - 1);
      emit('stringer', nominal, {
        cutLengthFt: slopeLen,
        position: seat(x, 0.5, deckThick + stringerDepth / 2),
        rotation: [0, Math.PI / 2, -pitch],
        stage: sRamp,
        nailing: 'bolted at the deck; bedded at grade (PH)',
        doctrineRef: citeOf(RAMP.stringerNominal),
      });
    }

    // Laid ACROSS the ramp, each piece lying IN the slope plane. Composing Ry(0)·Rx(rx) sends a
    // member's face-width axis to (0, cos rx, sin rx), and the ramp's up-slope direction is
    // (0, sin pitch, cos pitch) — equal only at rx = +(PI/2 - pitch).
    const rx = Math.PI / 2 - pitch;
    if (deckIsPlank) {
      const boardW = DRESSED[rampDeckNominal]!.d / IN_PER_FT;
      const boards = Math.max(1, Math.round(slopeLen / boardW));
      for (let i = 0; i < boards; i++) {
        emit('deckPlank', rampDeckNominal, {
          cutLengthFt: rampW,
          position: seat(L / 2, (i + 0.5) / boards, deckThick / 2),
          rotation: [rx, 0, 0],
          stage: sRamp,
          nailing: '2-16d ea stringer (PH)',
          doctrineRef: citeOf(RAMP.slopes),
        });
      }
    } else {
      // A panel deck on the platform means a panel deck on the ramp — the operator picked a
      // decking material, not a decking material for the flat part only. Sheets run their 8-ft
      // length ACROSS the ramp and their 4-ft width UP the slope, so the joint that matters
      // lands square across the stringers.
      const sheetW = PANEL.widthFt.value as number;
      const sheetL = PANEL.lengthFt.value as number;
      for (let u = 0; u < slopeLen - 1e-6; u += sheetW) {
        const cu = Math.min(sheetW, slopeLen - u);
        const s = (u + cu / 2) / slopeLen;
        for (let v = 0; v < rampW - 1e-6; v += sheetL) {
          const cv = Math.min(sheetL, rampW - v);
          emit('subfloor', `${sheetW}x${sheetL} panel`, {
            cutLengthFt: cv,
            position: seat(rampX0 + v + cv / 2, s, deckThick / 2),
            rotation: [rx, 0, 0],
            stage: sRamp,
            actual: { w: PANEL.subfloorThickIn.value as number, d: cu * IN_PER_FT },
            nailing: '8d @ 6" edges / 12" field (PH)',
            doctrineRef: citeOf(PANEL.subfloorThickIn),
          });
        }
      }
    }
  }

  // ── Steps: A STAIR IS POSITIONED BY WHERE YOU STEP OFF IT, not by where its bottom tread
  // happens to fall. The foot used to be planted a guessed foot beyond the deck — `[L + 1, W/2]`
  // — and the flight aimed back at the platform. A 4-ft rise wants 4 ft 5 in of run, so the head
  // finished three and a half feet INSIDE the footprint and the whole flight climbed under the
  // deck: each of the three stringers cut 2⅜ in into the end joist and 1½ in into the decking,
  // two of the stair's own rail posts speared up through the planks, and on a skid base the
  // middle stringer ran 1¾ in through the middle runner as well. From outside, a stair that
  // dead-ends into the underside of the platform.
  //
  // `arriveAt` states the constraint that actually matters — the top of the flight IS the deck
  // edge — and lets the run fall where it falls, which is outside. It is the same fix, and the
  // same reasoning, as the tower's stair (tower.ts).
  //
  // THE EDGE IS THE RIM JOIST'S FACE, not the grid line. The end joists are CENTRED on x = 0 and
  // x = L, as every framing member on a grid line here is, so half of each stands proud of the
  // decking, which is cut to L. A head landing on the line would therefore be sunk half a joist
  // into the piece it hangs from. A stringer's plumb head bears on the OUTSIDE face of the rim,
  // so that is where the flight arrives.
  if (spec.steps) {
    const sSteps = requireOrdinal(plan, 'stairs-access');
    const arriveX = L + DRESSED[joistNominal]!.w / IN_PER_FT / 2;
    const stair = generateStair({
      base: [arriveX, W / 2],
      up: [-1, 0],
      baseY: 0,
      topY: deckY,
      widthFt: stepWidthFt,
      stage: sSteps,
      arriveAt: { at: [arriveX, W / 2], dir: [-1, 0] },
    });
    emit.members.push(...stair.members);
  }

  return {
    members: emit.members,
    levels: { subfloorTop: deckY, joistTop: deckY - joistDepth, sillTop: sillY + sillDepth / 2, gradeY: 0 },
    stagePlan: plan,
  };
}

// ── Tent frame ───────────────────────────────────────────────────────────────

export function tentDims(tent: TentFrameSpec['tent'], bays: number): { widthFt: number; lengthFt: number; eaveFt: number; ridgeFt: number } {
  if (tent === 'temper') {
    const t = TENT.temper.value as { widthFt: number; bayFt: number; eaveFt: number; ridgeFt: number };
    return { widthFt: t.widthFt, lengthFt: t.bayFt * bays, eaveFt: t.eaveFt, ridgeFt: t.ridgeFt };
  }
  return { ...(TENT[tent].value as { widthFt: number; lengthFt: number; eaveFt: number; ridgeFt: number }) };
}

export function tentStagePlan(): StagePlanEntry[] {
  return stagePlan([
    { key: 'layout', label: 'Layout & base', detail: 'Skids or piers set to the tent’s footprint, squared on the diagonals.' },
    { key: 'floor', label: 'Floor framed', detail: 'Sills and joists — the tent floor is a real floor, not a groundsheet.' },
    { key: 'platform', label: 'Decked', detail: 'Planks laid tight over the joists.' },
    { key: 'tent-frame', label: 'Bents raised', detail: 'Bent frames at the doctrine spacing: posts, rafters, and the collar that keeps the pair from spreading.' },
    { key: 'roof-frame', label: 'Ridge & purlins', detail: 'The ridge ties the bents together; the canvas goes over it and is not part of this bill.' },
  ]);
}

export function generateTentFrame(spec: TentFrameSpec): FamilyResult {
  const emit = makeEmitter('TF');
  const plan = tentStagePlan();
  const sBase = requireOrdinal(plan, 'layout');
  const sFloor = requireOrdinal(plan, 'floor');
  const sDeck = requireOrdinal(plan, 'platform');
  const sBent = requireOrdinal(plan, 'tent-frame');
  const sRidge = requireOrdinal(plan, 'roof-frame');

  const d = tentDims(spec.tent, spec.temperBays ?? 4);
  const L = d.lengthFt;
  const W = d.widthFt;
  const bentNominal = TENT.bentNominal.value as string;
  const deckNominal = TENT.deckNominal.value as string;
  const joistNominal = LUMBER.joistNominal.value as string;
  const joistDepth = DRESSED[joistNominal]!.d / IN_PER_FT;
  const deckThick = DRESSED[deckNominal]!.w / IN_PER_FT;
  // ON THE RUNNERS. The joists used to start at y = 0 — flat on the earth — with the skids
  // buried in the ground underneath them carrying nothing at all. A tent floor on skids is off
  // the ground; that is the entire point of putting it on skids. Everything above reads `deckY`,
  // so lifting the floor by the runner's depth carries the bents, the eave and the ridge with it.
  const skidTop = DRESSED[LUMBER.skidNominal.value as string]!.d / IN_PER_FT;
  const deckY = skidTop + joistDepth + deckThick;

  emit.members.push(...generateSkids(L, W, sBase, 0));

  const spacing = spec.spacing.joistSpacingIn / IN_PER_FT;
  const joists = Math.max(2, Math.floor(L / spacing) + 1);
  for (let i = 0; i < joists; i++) {
    emit('joist', joistNominal, {
      cutLengthFt: W,
      position: [(L * i) / (joists - 1), skidTop + joistDepth / 2, W / 2],
      rotation: [0, Math.PI / 2, 0],
      stage: sFloor,
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: citeOf(LUMBER.joistNominal),
    });
  }
  const boardW = DRESSED[deckNominal]!.d / IN_PER_FT;
  // Ripped to fit at the far side, like the platform's — the same clamp left the tent floor an
  // inch short down its whole 29½-ft length.
  for (let z = 0; z < W - EPS_FT; z += boardW) {
    const cut = Math.min(boardW, W - z);
    emit('deckPlank', deckNominal, {
      cutLengthFt: L,
      position: [L / 2, skidTop + joistDepth + deckThick / 2, z + cut / 2],
      rotation: [-Math.PI / 2, 0, 0], // flat — see the platform deck above

      stage: sDeck,
      actual: { w: DRESSED[deckNominal]!.w, d: cut * IN_PER_FT },
      nailing: '2-16d ea joist (PH)',
      doctrineRef: citeOf(TENT.deckNominal),
    });
  }

  // ── Bents: a pair of posts, a pair of rafters to the ridge, and a collar tie.
  //
  // A BENT IS FRAMED, NOT DRAWN AS A STICK DIAGRAM. Every member's centreline ran corner to
  // corner, so at each node all of them occupied the same wood: on the shipped GP Small the two
  // rafters of a bent crossed each other by 1.45 in at the peak, each was 0.75 in inside the ridge
  // board it is nailed to, and the collar shared 1.50 in with the rafter and 0.75 in with the post
  // at the eave. The house's own roof shows what these joints look like when they are framed —
  // `roof.ts` lands its studs and its collar ties face to face on the pieces they meet, to the
  // last thousandth — and the tent bent is the outlier.
  const bentSpacing = TENT.bentSpacingFt.value as number;
  const bents = Math.max(2, Math.round(L / bentSpacing) + 1);
  const eaveY = deckY + d.eaveFt;
  const ridgeY = deckY + d.ridgeFt;
  // THE LAP IS ACROSS THE FACE THE POST PRESENTS, which is not the same as the collar's own
  // thickness. A bent post stands with its 3½-in face IN the bent's plane (`[0, 0, PI/2]` puts the
  // face width along world X); the collar runs across the bent (`[0, PI/2, 0]`) and shows its
  // 1½-in edge there. Face to face is therefore half of each — 2½ in, not the 1½ in that "one
  // board thickness" would suggest, and at 1½ in the collar was still a quarter of the way into
  // the post.
  const lapFt = (DRESSED[bentNominal]!.d + DRESSED[bentNominal]!.w) / 2 / IN_PER_FT;
  const ridgeHalfThick = DRESSED[bentNominal]!.w / 2 / IN_PER_FT;
  for (let i = 0; i < bents; i++) {
    const x = (L * i) / (bents - 1);
    const inset = PLATFORM.bentInsetFt.value as number;
    for (const z of [inset, W - inset]) {
      emit('bentPost', bentNominal, {
        cutLengthFt: d.eaveFt,
        position: [x, deckY + d.eaveFt / 2, z],
        rotation: [0, 0, Math.PI / 2],
        stage: sBent,
        nailing: 'toenail 4-8d to the deck; braced to the sill (PH)',
        doctrineRef: citeOf(TENT.bentNominal),
      });
      // A RAFTER BEARS ON THE RIDGE BOARD; it does not run to the ridge LINE. Carried to the
      // line, the last half-thickness of each rafter was inside the ridge and the pair were
      // inside each other. The pitch and the eave point are the doctrine — the tent's own eave
      // and ridge heights — so neither moves; the rafter just stops sooner.
      //
      // WHERE IT STOPS IS SET BY THE CUT, NOT BY THE CENTRELINE. A rafter meeting a ridge board is
      // cut PLUMB, and `ridgeHeadProfile` derives that cut off the piece; the resulting vertical
      // face sits half a face width times the sine of the pitch BACK from where the centreline
      // ends — 0.82 in here. Stopping the centreline on the board's face would therefore leave the
      // wood a fifth of an inch short of it, so the centreline runs that much past and the CUT
      // lands on the face. There is no placement of a square-cut head that both bears on the board
      // and stays out of it: the head would touch on one arris and either bite or gape.
      const toPeak = W / 2 - z;
      const pitch = Math.atan2(ridgeY - eaveY, Math.abs(toPeak));
      const halfFace = DRESSED[bentNominal]!.d / IN_PER_FT / 2;
      const head = W / 2 - Math.sign(toPeak) * (ridgeHalfThick - halfFace * Math.sin(pitch));
      const run = head - z;
      const rise = Math.abs(run) * Math.tan(pitch);
      emit('bentRafter', bentNominal, {
        cutLengthFt: Math.hypot(Math.abs(run), rise),
        position: [x, eaveY + rise / 2, (z + head) / 2],
        rotation: [0, run > 0 ? -Math.PI / 2 : Math.PI / 2, pitch],
        stage: sBent,
        nailing: '3-8d at the ridge, 3-8d at the post (PH)',
        doctrineRef: citeOf(TENT.bentNominal),
      });
    }
    // THE COLLAR IS NAILED BESIDE THE BENT, not into it — the same joint `roof.ts` makes when it
    // sets its collar ties one board thickness off their rafters' grid line. In the bent's own
    // plane it shared wood with both the post and the rafter at each eave. The lap goes on the
    // face that is INSIDE the tent, so the end bent's tie does not hang off the deck.
    emit('bentCollar', bentNominal, {
      cutLengthFt: W - 2 * inset,
      position: [x + (i === bents - 1 ? -lapFt : lapFt), eaveY, W / 2],
      rotation: [0, Math.PI / 2, 0],
      stage: sBent,
      nailing: '4-8d ea end (PH)',
      doctrineRef: citeOf(TENT.bentNominal),
    });
  }
  emit('ridge', bentNominal, {
    cutLengthFt: L,
    position: [L / 2, ridgeY, W / 2],
    rotation: [0, 0, 0],
    stage: sRidge,
    nailing: '3-8d ea bent (PH)',
    doctrineRef: citeOf(TENT.bentSpacingFt),
  });

  // ── The framed end door.
  //
  // `endDoor` has been on `TentFrameSpec` since the family was written, BOTH shipped tent presets
  // set it `true`, and the planning card offers it as a live toggle labelled "Framed end door" —
  // and no generator has ever read it. Same class as `fill`, `entrySteps`, `openFront`,
  // `partitions` and `shutters` before it: a field the spec carries and nothing consumes, so the
  // toggle moved and the model did not.
  //
  // WHAT IT IS. There is no wall here to cut a hole in — a tent frame is a deck and a rank of
  // bents, and the end is closed by canvas. So the door is FRAMED rather than opened: two jambs
  // standing on the deck and a head across them, standing in the END BENT'S OWN PLANE, which is
  // what the canvas end laces to and what a man walks through. Its size is the toolkit's standard
  // rough opening, so a tent door is the same hole as a hut door rather than a second opinion.
  //
  // BOTH ENDS. The field names no end, a tent frame's two ends are identical, and the toolkit's
  // own vocabulary pairs them — the sea hut's standard drawing is "2 end doors". Framing one and
  // not the other would be an arbitrary choice made silently.
  if (spec.endDoor) {
    const doorW = OPENING.doorWidthFt.value as number;
    const doorH = OPENING.doorHeightFt.value as number;
    // The frame is cut from the bents' own stock: 3½ in through the opening, 1½ in along it,
    // which is a jamb the same way a stud is one.
    const jambT = DRESSED[bentNominal]!.w / IN_PER_FT;
    for (const x of [0, L]) {
      for (const s of [-1, 1]) {
        emit('post', bentNominal, {
          cutLengthFt: doorH,
          position: [x, deckY + doorH / 2, W / 2 + s * (doorW + jambT) / 2],
          rotation: [0, 0, Math.PI / 2],
          stage: sBent,
          nailing: 'framing anchor top and bottom (PH)',
          doctrineRef: `${citeOf(OPENING.doorWidthFt)} — end-door jamb, in the end bent's plane`,
        });
      }
      // Bearing on both jambs, so the head is the clear opening plus a jamb at each side — and
      // SIZED BY THE SPAN TABLE, not cut from the same 2x4 as the jambs. The first version was,
      // and the engine's own life-safety span check failed the build over it: a 2x4 carries 3 ft
      // and this head spans 3 ft 3 in. `headerForSpan` is the same function every doorway in the
      // toolkit asks, so a tent door is not the one opening with its own opinion.
      const headNominal = headerForSpan(doorW + 2 * jambT);
      const headD = DRESSED[headNominal]!.d / IN_PER_FT;
      emit('header', headNominal, {
        cutLengthFt: doorW + 2 * jambT,
        position: [x, deckY + doorH + headD / 2, W / 2],
        rotation: [0, Math.PI / 2, 0],
        stage: sBent,
        nailing: '4-8d ea end (PH)',
        doctrineRef: `${citeOf(OPENING.doorHeightFt)} — end-door head, sized for its own span`,
      });
    }
  }

  return {
    members: emit.members,
    levels: { subfloorTop: deckY, joistTop: joistDepth, sillTop: 0, gradeY: 0 },
    stagePlan: plan,
  };
}
