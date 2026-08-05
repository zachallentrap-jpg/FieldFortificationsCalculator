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
import { TENT, LUMBER, PANEL, RAMP, PLATFORM, IN_PER_FT, citeOf } from '../doctrine';
import { stagePlan, requireOrdinal, type StagePlanEntry } from '../stagePlan';
import { generateRailing, railRequired, type RailEdge } from '../subsystems/railings';
import { generateStair } from '../subsystems/access';
import { generateSkids } from '../subsystems/coverings';
import type { FloorLevels } from '../floor';

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
      const postLen = deckY - joistDepth - sillDepth - skidTop;
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
  const sillY = deckY - joistDepth - sillDepth / 2;
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
      position: [(L * i) / (joists - 1), deckY - joistDepth / 2, W / 2],
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
    for (let z = w / 2; z < W; z += w) {
      emit('deckPlank', nominal, {
        cutLengthFt: L,
        position: [L / 2, deckY - DRESSED[nominal]!.w / IN_PER_FT / 2, Math.min(z, W - w / 2)],
        rotation: [-Math.PI / 2, 0, 0],
        stage: sDeck,
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
    const edges: RailEdge[] = spec.railEdges.map((w) => ({
      id: `edge-${w}`,
      from: corner[w][0],
      to: corner[w][1],
      ...(spec.ramp && w === rampEdge ? { gaps: [[L / 2 - rampW / 2, L / 2 + rampW / 2] as [number, number]] } : {}),
    }));
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
    const run = deckY * spec.ramp.slope;
    const nominal = RAMP.stringerNominal.value as string;
    const slopeLen = Math.hypot(run, deckY);
    const pitch = Math.atan2(deckY, Math.max(1e-6, run));
    const rampW = spec.ramp.widthFt;
    const rampX0 = L / 2 - rampW / 2;
    const downY = -Math.cos(pitch);
    const downZ = Math.sin(pitch);
    /** Center of a piece sitting `drop` feet square below the walking surface at station `s`. */
    const seat = (x: number, s: number, drop: number): [number, number, number] =>
      [x, deckY * s + downY * drop, -run * (1 - s) + downZ * drop];

    const deckIsPlank = spec.deck === 'plank';
    const rampDeckNominal = TENT.deckNominal.value as string;
    const deckThick = (deckIsPlank
      ? DRESSED[rampDeckNominal]!.w
      : (PANEL.subfloorThickIn.value as number)) / IN_PER_FT;

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

  if (spec.steps) {
    const sSteps = requireOrdinal(plan, 'stairs-access');
    const stair = generateStair({
      base: [L + 1, W / 2],
      up: [-1, 0],
      baseY: 0,
      topY: deckY,
      widthFt: 3,
      stage: sSteps,
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
  for (let z = boardW / 2; z < W; z += boardW) {
    emit('deckPlank', deckNominal, {
      cutLengthFt: L,
      position: [L / 2, skidTop + joistDepth + deckThick / 2, Math.min(z, W - boardW / 2)],
      rotation: [-Math.PI / 2, 0, 0], // flat — see the platform deck above

      stage: sDeck,
      nailing: '2-16d ea joist (PH)',
      doctrineRef: citeOf(TENT.deckNominal),
    });
  }

  // ── Bents: a pair of posts, a pair of rafters to the ridge, and a collar tie.
  const bentSpacing = TENT.bentSpacingFt.value as number;
  const bents = Math.max(2, Math.round(L / bentSpacing) + 1);
  const eaveY = deckY + d.eaveFt;
  const ridgeY = deckY + d.ridgeFt;
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
      const run = W / 2 - z;
      const rise = ridgeY - eaveY;
      emit('bentRafter', bentNominal, {
        cutLengthFt: Math.hypot(Math.abs(run), rise),
        position: [x, (eaveY + ridgeY) / 2, (z + W / 2) / 2],
        rotation: [0, run > 0 ? -Math.PI / 2 : Math.PI / 2, Math.atan2(rise, Math.abs(run))],
        stage: sBent,
        nailing: '3-8d at the ridge, 3-8d at the post (PH)',
        doctrineRef: citeOf(TENT.bentNominal),
      });
    }
    emit('bentCollar', bentNominal, {
      cutLengthFt: W - 0.5,
      position: [x, eaveY, W / 2],
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

  return {
    members: emit.members,
    levels: { subfloorTop: deckY, joistTop: joistDepth, sillTop: 0, gradeY: 0 },
    stagePlan: plan,
  };
}
