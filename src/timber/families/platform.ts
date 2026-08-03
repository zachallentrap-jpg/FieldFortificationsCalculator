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
  if (spec.base === 'skids') {
    emit.members.push(...generateSkids(L, W, sBase));
  } else {
    // Piers under every bearing line, at the doctrine post spacing.
    const bays = Math.max(1, Math.round(L / (PLATFORM.pierSpacingFt.value as number)));
    for (let i = 0; i <= bays; i++) {
      const x = (L * i) / bays;
      for (const z of [sillDepth / 2, W - sillDepth / 2]) {
        const padSide = PLATFORM.padSideIn.value as number;
        const padDepth = PLATFORM.padDepthIn.value as number;
        emit('footing', `conc pad ${padSide}x${padSide}x${padDepth}`, {
          cutLengthFt: padSide / IN_PER_FT,
          position: [x, -padDepth / IN_PER_FT / 2, z],
          rotation: [0, 0, 0],
          stage: sBase,
          actual: { w: padDepth, d: padSide },
          nailing: 'poured on undisturbed soil (PH)',
          doctrineRef: 'FM 5-426 post footers (PH page)',
        });
        const postLen = deckY - joistDepth - sillDepth;
        // Below this a 'post' is a shim, not a member — the same guard floor.ts uses.
        if (postLen > (PLATFORM.minPostFt.value as number)) {
          emit('post', postNominal, {
            cutLengthFt: postLen,
            position: [x, postLen / 2, z],
            rotation: [0, 0, Math.PI / 2],
            stage: sBase,
            nailing: 'drift-pinned to the pad; capped by the sill (PH)',
            doctrineRef: citeOf(LUMBER.postNominal),
          });
        }
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
  if (spec.deck === 'plank') {
    const nominal = TENT.deckNominal.value as string;
    const w = DRESSED[nominal]!.d / IN_PER_FT;
    for (let z = w / 2; z < W; z += w) {
      emit('deckPlank', nominal, {
        cutLengthFt: L,
        position: [L / 2, deckY - DRESSED[nominal]!.w / IN_PER_FT / 2, Math.min(z, W - w / 2)],
        rotation: [0, 0, 0],
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
          rotation: [0, 0, 0],
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
  if (spec.ramp) {
    const sRamp = requireOrdinal(plan, 'stairs-access');
    const run = deckY * spec.ramp.slope;
    const nominal = RAMP.stringerNominal.value as string;
    const deckNominalForRamp = TENT.deckNominal.value as string;
    const slopeLen = Math.hypot(run, deckY);
    const pitch = Math.atan2(deckY, Math.max(1e-6, run));
    const stringers = Math.max(2, Math.round(spec.ramp.widthFt / 2) + 1);
    for (let i = 0; i < stringers; i++) {
      const x = L / 2 - spec.ramp.widthFt / 2 + (spec.ramp.widthFt * i) / (stringers - 1);
      emit('stringer', nominal, {
        cutLengthFt: slopeLen,
        position: [x, deckY / 2 - DRESSED[deckNominalForRamp]!.w / IN_PER_FT, -run / 2],
        rotation: [0, Math.PI / 2, pitch],
        stage: sRamp,
        nailing: 'bolted at the deck; bedded at grade (PH)',
        doctrineRef: citeOf(RAMP.stringerNominal),
      });
    }
    const deckNominal = TENT.deckNominal.value as string;
    const boardW = DRESSED[deckNominal]!.d / IN_PER_FT;
    const boards = Math.max(1, Math.round(slopeLen / boardW));
    // Planks laid ACROSS the ramp, each lying IN the slope plane. Composing Ry(0)·Rx(rx) sends
    // a member's face-width axis to (0, cos rx, sin rx), and the ramp's up-slope direction is
    // (0, sin pitch, -cos pitch) — equal only at rx = -(PI/2 - pitch). Left at zero the boards
    // stayed horizontal and the ramp read as a fan of sticks in mid-air.
    const rx = -(Math.PI / 2 - pitch);
    for (let i = 0; i < boards; i++) {
      const s = (i + 0.5) / boards;
      emit('deckPlank', deckNominal, {
        cutLengthFt: spec.ramp.widthFt,
        position: [L / 2, deckY * s, -run * (1 - s)],
        rotation: [rx, 0, 0],
        stage: sRamp,
        nailing: '2-16d ea stringer (PH)',
        doctrineRef: citeOf(RAMP.slopes),
      });
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
  const deckY = joistDepth + deckThick;

  emit.members.push(...generateSkids(L, W, sBase));

  const spacing = spec.spacing.joistSpacingIn / IN_PER_FT;
  const joists = Math.max(2, Math.floor(L / spacing) + 1);
  for (let i = 0; i < joists; i++) {
    emit('joist', joistNominal, {
      cutLengthFt: W,
      position: [(L * i) / (joists - 1), joistDepth / 2, W / 2],
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
      position: [L / 2, joistDepth + deckThick / 2, Math.min(z, W - boardW / 2)],
      rotation: [0, 0, 0],
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
