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
import { TOWER, RAIL, PANEL, HUT, IN_PER_FT, citeOf } from '../doctrine';
import { stagePlan, requireOrdinal, type StagePlanEntry } from '../stagePlan';
import { generateRailing, railRequired, type RailEdge } from '../subsystems/railings';
import { generateLadder, generateStair } from '../subsystems/access';
import type { FloorLevels } from '../floor';

/** Guard against a divide-by-zero on a degenerate height. Arithmetic, not doctrine. */
const EPS_FT = 1e-6;

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

/** Plan half-width of the leg square at a given height, from the batter. */
function halfAt(spec: TowerSpec, y: number): number {
  const top = spec.cabPlanFt / 2;
  const batter = TOWER.batterPerSideFt.value as number;
  const h = Math.max(EPS_FT, spec.platformHeightFt);
  // Linear batter: widest at grade, narrowing to the cab plan at the platform.
  return top + batter * (1 - Math.min(1, Math.max(0, y / h)));
}

/** The four legs' plan positions at a height, in a fixed corner order. */
function cornersAt(spec: TowerSpec, y: number): [number, number][] {
  const h = halfAt(spec, y);
  const c = spec.cabPlanFt / 2 + (TOWER.batterPerSideFt.value as number);
  // Origin at the base square's front-left corner keeps the tower in the same +X/+Z quadrant
  // every other family uses, so one camera rig frames all of them.
  return [
    [c - h, c - h], [c + h, c - h], [c + h, c + h], [c - h, c + h],
  ];
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

  // ── Footings
  const base = cornersAt(spec, 0);
  if (spec.footing === 'concrete-pad') {
    for (const [x, z] of base) {
      const side = (TOWER.padSideIn.value as number) / IN_PER_FT;
      const depth = (TOWER.padDepthIn.value as number) / IN_PER_FT;
      emit('footing', `conc pad ${TOWER.padSideIn.value}x${TOWER.padSideIn.value}x${TOWER.padDepthIn.value}`, {
        cutLengthFt: side,
        position: [x, -depth / 2, z],
        rotation: [0, 0, 0],
        stage: sLayout,
        actual: { w: TOWER.padDepthIn.value as number, d: TOWER.padSideIn.value as number },
        nailing: 'poured on undisturbed soil (PH)',
        doctrineRef: 'TM 5-302 tower footing (PH)',
      });
    }
  } else {
    const mudNominal = TOWER.mudsillNominal.value as string;
    const mudLen = TOWER.mudsillLengthFt.value as number;
    for (const [x, z] of base) {
      emit('sill', mudNominal, {
        cutLengthFt: mudLen,
        position: [x, DRESSED[mudNominal]!.d / IN_PER_FT / 2, z],
        rotation: [0, 0, 0],
        stage: sLayout,
        nailing: 'bedded on tamped fill; leg drift-pinned (PH)',
        doctrineRef: citeOf(TOWER.mudsillNominal),
      });
    }
  }

  // ── Legs. Battered, so each is a raked member: length is the hypotenuse and the tilt is
  // toward the tower's centre.
  const legTopY = H;
  const topCorners = cornersAt(spec, legTopY);
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = base[i]!;
    const [x1, z1] = topCorners[i]!;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const runFt = Math.hypot(dx, dz);
    const lenFt = Math.hypot(runFt, legTopY);
    // Yaw the member onto the lean direction, then pitch it up by the rake.
    const yaw = runFt < 1e-6 ? 0 : Math.atan2(-dz, dx);
    const pitch = Math.atan2(legTopY, Math.max(1e-6, runFt));
    emit('towerLeg', legNominal, {
      cutLengthFt: lenFt,
      position: [(x0 + x1) / 2, legTopY / 2, (z0 + z1) / 2],
      rotation: [0, yaw, pitch],
      stage: sLegs,
      nailing: 'drift-pinned at the sill; bolted at every girt (PH)',
      doctrineRef: citeOf(TOWER.legNominal),
    });
  }

  // ── Girts and X-braces, bay by bay, on all four faces.
  const bays = Math.max(1, Math.round(H / bay));
  for (let b = 1; b <= bays; b++) {
    const yTop = (H * b) / bays;
    const yBot = (H * (b - 1)) / bays;
    const top = cornersAt(spec, yTop);
    const bot = cornersAt(spec, yBot);
    for (let f = 0; f < 4; f++) {
      const a = top[f]!;
      const c = top[(f + 1) % 4]!;
      const run = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const yaw = Math.atan2(-(c[1] - a[1]), c[0] - a[0]);
      emit('girt', girtNominal, {
        cutLengthFt: run,
        position: [(a[0] + c[0]) / 2, yTop, (a[1] + c[1]) / 2],
        rotation: [0, yaw, 0],
        stage: sBrace,
        nailing: 'bolted to each leg (PH)',
        doctrineRef: citeOf(TOWER.girtNominal),
      });
      // The X: two diagonals per face, corner to opposite corner of the bay.
      const aB = bot[f]!;
      const cB = bot[(f + 1) % 4]!;
      for (const [p, q] of [[aB, c], [cB, a]] as const) {
        const dRun = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const dRise = yTop - yBot;
        emit('towerBrace', braceNominal, {
          cutLengthFt: Math.hypot(dRun, dRise),
          position: [(p[0] + q[0]) / 2, (yBot + yTop) / 2, (p[1] + q[1]) / 2],
          rotation: [0, Math.atan2(-(q[1] - p[1]), q[0] - p[0]), Math.atan2(dRise, Math.max(1e-6, dRun))],
          stage: sBrace,
          nailing: 'bolted at both ends and where the diagonals cross (PH)',
          doctrineRef: citeOf(TOWER.braceNominal),
        });
      }
    }
  }

  // ── Platform: joists across the leg square, decked.
  const deckHalf = spec.cabPlanFt / 2;
  const cx = spec.cabPlanFt / 2 + (TOWER.batterPerSideFt.value as number);
  const joistDepth = DRESSED[joistNominal]!.d / IN_PER_FT;
  const deckY = H;
  const joistY = deckY - joistDepth / 2;
  const joistSpacing = spec.spacing.joistSpacingIn / IN_PER_FT;
  const span = spec.cabPlanFt;
  const nJoists = Math.max(2, Math.floor(span / joistSpacing) + 1);
  for (let i = 0; i < nJoists; i++) {
    const z = cx - deckHalf + (span * i) / (nJoists - 1);
    emit('joist', joistNominal, {
      cutLengthFt: span,
      position: [cx, joistY, z],
      rotation: [0, 0, 0],
      stage: sPlatform,
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: citeOf(TOWER.platformJoistNominal),
    });
  }
  const deckThick = PANEL.subfloorThickIn.value as number;
  emit('subfloor', `${PANEL.widthFt.value}x${PANEL.lengthFt.value} panel`, {
    cutLengthFt: spec.cabPlanFt,
    position: [cx, deckY + deckThick / IN_PER_FT / 2, cx],
    rotation: [0, 0, 0],
    stage: sPlatform,
    actual: { w: deckThick, d: spec.cabPlanFt * IN_PER_FT },
    nailing: '8d @ 6" edges / 12" field (PH)',
    doctrineRef: 'TM 5-302 tower platform decking (PH)',
  });

  // ── Access. Which edge it lands on is fixed (the front, -Z), so the railing knows where the
  // gap goes without a second convention to keep in sync.
  const accessWidth = TOWER.accessWidthFt.value as number;
  const accessEdgeGap: [number, number] = [spec.cabPlanFt / 2 - accessWidth / 2, spec.cabPlanFt / 2 + accessWidth / 2];
  if (spec.access === 'ladder') {
    const { members } = generateLadder({
      base: [cx, cx - deckHalf - (TOWER.ladderClearanceFt.value as number)],
      facing: [0, 1],
      baseY: 0,
      landingY: deckY,
      widthFt: accessWidth,
      stage: sAccess,
    });
    emit.members.push(...members);
  } else {
    const stair = generateStair({
      base: [cx - deckHalf - 1, cx - deckHalf - 1],
      up: [1, 0],
      baseY: 0,
      topY: deckY,
      widthFt: accessWidth,
      stage: sAccess,
      // Keep each flight inside the tower footprint; a straight run to 32 ft would need 40 ft.
      maxFlightRiseFt: bay,
    });
    emit.members.push(...stair.members);
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
      ...(i === 0 && spec.access === 'ladder' ? { gaps: [accessEdgeGap] } : {}),
    }));
    emit.members.push(...generateRailing({ edges, deckY: deckY + deckThick / IN_PER_FT, stage: sRail }));
  }

  // ── Cab.
  const cabWallH = spec.cab.walls === 'open-rail'
    ? 0
    : spec.cab.walls === 'half-wall' ? (TOWER.cabHalfWallFt.value as number) : (TOWER.cabWallHeightFt.value as number);
  const cabBaseY = deckY + deckThick / IN_PER_FT;
  if (cabWallH > 0) {
    const halfW = spec.cab.walls === 'half-wall-screen' ? (TOWER.cabHalfWallFt.value as number) : cabWallH;
    for (let f = 0; f < 4; f++) {
      const a: [number, number] = [cx - deckHalf, cx - deckHalf];
      const corners: [number, number][] = [
        [cx - deckHalf, cx - deckHalf], [cx + deckHalf, cx - deckHalf],
        [cx + deckHalf, cx + deckHalf], [cx - deckHalf, cx + deckHalf],
      ];
      void a;
      const p = corners[f]!;
      const q = corners[(f + 1) % 4]!;
      const run = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const yaw = Math.atan2(-(q[1] - p[1]), q[0] - p[0]);
      emit('siding', `${PANEL.widthFt.value}x${PANEL.lengthFt.value} panel`, {
        cutLengthFt: run,
        position: [(p[0] + q[0]) / 2, cabBaseY + halfW / 2, (p[1] + q[1]) / 2],
        rotation: [0, yaw, 0],
        stage: sCab,
        actual: { w: PANEL.sidingThickIn.value as number, d: halfW * IN_PER_FT },
        nailing: '8d @ 6" edges / 12" field (PH)',
        doctrineRef: citeOf(TOWER.cabHalfWallFt),
      });
      if (spec.cab.walls === 'half-wall-screen') {
        emit('screenPanel', 'screen cloth', {
          cutLengthFt: run,
          position: [(p[0] + q[0]) / 2, cabBaseY + halfW + ((TOWER.cabWallHeightFt.value as number) - halfW) / 2, (p[1] + q[1]) / 2],
          rotation: [0, yaw, 0],
          stage: sCab,
          actual: { w: HUT.screenClothThickIn.value as number, d: ((TOWER.cabWallHeightFt.value as number) - halfW) * IN_PER_FT },
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
    emit('post', '4x4', {
      cutLengthFt: TOWER.cabWallHeightFt.value as number,
      position: [x, (cabBaseY + postTopY) / 2, z],
      rotation: [0, 0, Math.PI / 2],
      stage: sCab,
      nailing: 'bolted to the platform frame (PH)',
      doctrineRef: citeOf(TOWER.cabWallHeightFt),
    });
  }

  // ── Cab roof: four hips to a peak, or one slope.
  const overhang = TOWER.cabOverhangFt.value as number;
  const rise = ((TOWER.cabRisePer12.value as number) / IN_PER_FT) * (spec.cabPlanFt / 2 + overhang);
  const eaveY = postTopY;
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
    // One covering panel per slope, laid on the hips.
    for (let f = 0; f < 4; f++) {
      const p = eaveCorners[f]!;
      const q = eaveCorners[(f + 1) % 4]!;
      const run = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const slope = Math.hypot(spec.cabPlanFt / 2 + overhang, rise);
      const midX = (p[0] + q[0]) / 2;
      const midZ = (p[1] + q[1]) / 2;
      emit('roofPanel', `${PANEL.widthFt.value}x${PANEL.lengthFt.value} panel`, {
        cutLengthFt: run,
        position: [(midX + cx) / 2, eaveY + rise / 2, (midZ + cx) / 2],
        rotation: [Math.PI / 2 - Math.atan2(rise, spec.cabPlanFt / 2 + overhang), Math.atan2(-(q[1] - p[1]), q[0] - p[0]), 0],
        stage: sRoofing,
        actual: { w: PANEL.roofDeckThickIn.value as number, d: slope * IN_PER_FT },
        nailing: '8d @ 6" edges / 12" field (PH)',
        doctrineRef: citeOf(TOWER.cabOverhangFt),
      });
    }
  } else {
    // Shed: one slope over the whole cab, high side to the rear.
    const slopeLen = Math.hypot(spec.cabPlanFt + 2 * overhang, rise * 2);
    emit('roofPanel', `${PANEL.widthFt.value}x${PANEL.lengthFt.value} panel`, {
      cutLengthFt: spec.cabPlanFt + 2 * overhang,
      position: [cx, eaveY + rise, cx],
      rotation: [Math.PI / 2 - Math.atan2(rise * 2, spec.cabPlanFt + 2 * overhang), 0, 0],
      stage: sRoofing,
      actual: { w: PANEL.roofDeckThickIn.value as number, d: slopeLen * IN_PER_FT },
      nailing: '8d @ 6" edges / 12" field (PH)',
      doctrineRef: citeOf(TOWER.cabRisePer12),
    });
    for (const z of [cx - deckHalf, cx, cx + deckHalf]) {
      emit('rafter', '2x6', {
        cutLengthFt: spec.cabPlanFt + 2 * overhang,
        position: [cx, eaveY + rise, z],
        rotation: [0, Math.PI / 2, Math.atan2(rise * 2, spec.cabPlanFt + 2 * overhang)],
        stage: sRoof,
        nailing: 'toenail 3-8d ea plate (PH)',
        doctrineRef: citeOf(TOWER.cabRisePer12),
      });
    }
  }

  return {
    members: emit.members,
    levels: { subfloorTop: deckY, joistTop: joistY, sillTop: 0, gradeY: 0 },
    stagePlan: plan,
  };
}

/** Exported for the catalog's lock rows and the tower test. */
export const TOWER_HEIGHTS = TOWER.platformHeightsFt.value as readonly TowerSpec['platformHeightFt'][];
export { RAIL };
