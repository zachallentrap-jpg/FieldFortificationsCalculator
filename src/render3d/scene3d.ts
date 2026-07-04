// Pure 3D scene descriptor (companion to render/geometry.ts). Turns a Result into a plain,
// framework-agnostic list of simple shapes in FEET — no Three.js import here, so this stays
// unit-testable with node:test and keeps the same "engine never touches the renderer" split
// as the 2D drawings. src/ui/three-viewer.ts is the only place that turns this into meshes.
//
// Axes (feet): x = left/right (frontage), z = front/back (negative z = front = enemy side,
// matching the plan view's "front is up" convention), y = vertical (positive = up, ground = 0).
//
// Every position SHAPE gets a distinct footprint (not one generic box) so "each design" reads
// differently in 3D: rect, inverted_t, l_shape, circular, vehicle_ramp, rect_roofed.
//
// Materials are honest, not decorative: what the BOM actually specifies is what you SEE.
// Parapet + overhead cover are always sandbag construction per doctrine (bagsParapet/bagsCover
// are computed unconditionally in engine/materials.ts) — they're tagged 'sandbag' unconditionally.
// The excavation face reflects the operator's actual revetment choice (sandbag / pickets & wire /
// corrugated metal / timber-plywood), or — when revetment is 'none' — bare, sloped earth, with the
// slope driven by the SOIL's real wallSlopeRatio (steeper for sand/gravel, nearly vertical for
// clay/rock), exactly like the doctrine table says. src/ui/three-viewer.ts reads `finish` to
// decide HOW to build the mesh (sandbag tiling, picket+wire, a textured panel, or a tapered
// earthen face) — this file only decides WHICH finish applies, from the same doctrine tables the
// 2D renderer and BOM already consult.

import { soils } from '../doctrine/soils';
import { revetments } from '../doctrine/materials';
import { positions, parapetModeFor } from '../doctrine/positions';
import type { GeometryModel } from '../engine/geometry';
import type { Result } from '../engine/types';

export type WallFinish = 'earth' | 'sandbag' | 'picket' | 'corrugated' | 'timber';

export interface Box3 {
  kind: 'box';
  x: number; y: number; z: number; // center, feet
  w: number; h: number; d: number; // size, feet
  role: BoxRole;
  label?: string;
  finish?: WallFinish; // only meaningful for 'bayWall' (and implicitly 'ground'/'bayFloor' = earth)
  picketSpacing?: number; // feet between posts — only when finish === 'picket'
  // Vertex taper for a sloped earthen face: the face on `taperSign` side of `taperAxis` (0=x,
  // 2=z) flares outward by `taperAmount` (feet) from bottom (unchanged) to top (full amount).
  taperAxis?: 0 | 2;
  taperSign?: 1 | -1;
  taperAmount?: number;
}
export interface Cyl3 {
  kind: 'cyl';
  x: number; y: number; z: number; // center, feet
  radius: number; height: number;
  radiusTop?: number; // present + different from radius ⇒ a frustum (sloped circular pit wall)
  role: BoxRole;
  label?: string;
}
export interface Ring3 {
  kind: 'ring'; // a smooth annulus (circular parapet), extruded — used for round positions
  x: number; z: number;
  outerR: number; innerR: number; height: number;
  role: BoxRole;
}
export interface Frame3 {
  // A smooth rounded-rectangle annulus, extruded and beveled into a single continuous MOUNDED
  // berm — one piece with rounded corners and a sloped top edge, not 4 separate flat-topped
  // boxes meeting at hard seams (the earlier box-ring read as stacked Lego slabs, not a real
  // earth parapet). Used for every earth-mode parapet on a rect-family position.
  kind: 'frame';
  x: number; z: number; // center
  outerL: number; outerW: number; // outer footprint
  holeL: number; holeW: number; // inner hole footprint (matches the excavation exactly)
  height: number;
  role: BoxRole;
}
export interface Wedge3 {
  kind: 'wedge'; // flat translucent sector-of-fire fan on the ground
  x: number; z: number;
  radius: number;
  leftDeg: number;
  rightDeg: number;
}
export interface Arrow3 {
  kind: 'arrow';
  fromX: number; fromZ: number; toX: number; toZ: number; y: number;
}
export interface Figure3 {
  kind: 'figure';
  x: number; z: number;
  heightFt: number;
}

export type BoxRole =
  | 'ground' | 'parapet' | 'earthParapet' | 'bayWall' | 'bayFloor' | 'cover' | 'engineeredCover'
  | 'stringer' | 'platform' | 'firingStep' | 'sump' | 'camoNet' | 'rampBerm';

export type Part3 = Box3 | Cyl3 | Ring3 | Frame3 | Wedge3 | Arrow3 | Figure3;

// ── Terrain spec (pure data) ─────────────────────────────────────────────────
// The renderer's terrain path cuts REAL holes into one earth block instead of tiling flat
// "ground" frame boxes around the main bay. Frame boxes can only picture-frame a single
// rectangle — an inverted-T's stem trench and an L's arm trench end up UNDER solid ground
// bands (and the fifty-cal arm literally overhangs the slab edge). This spec describes the
// full footprint honestly: one outer block + every sunken volume, in feet, same axes as parts.
// Hole envelopes are expanded past the excavation by the wall taper (sloped bare-earth walls
// flare OUTWARD toward the top) plus a small clearance so terrain never clips through walls.
export interface TerrainHoleRect { kind: 'rect'; x: number; z: number; w: number; d: number; depth: number }
export interface TerrainHoleCircle { kind: 'circle'; x: number; z: number; r: number; depth: number }
// A single simple polygon (no self-intersection), for compound T/L footprints — two separate
// rect holes sharing an edge would be degenerate for shape triangulation, so the union is
// emitted as ONE outline. Points ordered consistently; the renderer normalizes winding.
export interface TerrainHolePoly { kind: 'poly'; pts: Array<[number, number]>; depth: number }
export type TerrainHole = TerrainHoleRect | TerrainHoleCircle | TerrainHolePoly;
export interface TerrainSpec {
  outer: { x: number; z: number; w: number; d: number };
  holes: TerrainHole[];
}

export interface Scene3DModel {
  hasAnything: boolean;
  parts: Part3[];
  // size: rough footprint size (feet), drives camera distance. depth: how far below grade the
  // deepest visible part actually goes — a WIDE, shallow position (most of them) and a NARROW,
  // deep one (the ramp's exaggerated relief) can share the same size but need very different
  // camera pitch, so the viewer frames on both, not size alone.
  bounds: { size: number; depth: number };
  // Present whenever hasAnything — the renderer's terrain path builds one earth block with
  // true holes from this; the flat role-'ground' frame parts stay emitted as the low-tier
  // fallback (and to keep every existing consumer/test untouched).
  terrain?: TerrainSpec;
  engineeredRoof: boolean; // true → show the hazard marker, never a fabricated cover
  cutaway: boolean; // viewer clips the near half so the interior/OHC reads at a glance
}

export interface BuildOpts {
  stage?: number; // construction stage 0..6 (see STAGE_ORDER); undefined ⇒ final state
  cutaway?: boolean;
}

// Which construction stage each part role first appears in (index into doctrine STAGE_ORDER:
// security=0, hasty=1, deliberate=2, revet_sump=3, parapet=4, overhead=5, camo=6). The stage
// scrubber shows only parts whose stage ≤ the selected one, so the model builds itself in
// doctrinal order — the same order the priorities-of-work schedule (engine/stages.ts) uses.
const ROLE_STAGE: Record<BoxRole, number> = {
  ground: 0, // terrain + orientation are always present
  bayFloor: 1, // hasty scrape opens the hole
  bayWall: 1,
  platform: 2,
  firingStep: 2,
  sump: 3, // revet & sump
  parapet: 4, // front protection (sandbag firing rest, or bunker sandbag walls)
  earthParapet: 4, // mounded spoil parapet — same construction stage as the sandbag parapet
  rampBerm: 4,
  cover: 5, // overhead
  stringer: 5,
  engineeredCover: 5,
  camoNet: 6, // camouflage, continuous/last
};
// Exported so the renderer can tag built meshes with their construction stage (the stage
// scrubber's rise-in animation needs to know which parts JUST appeared).
export function partStage(part: Part3): number {
  if (part.kind === 'box' || part.kind === 'cyl' || part.kind === 'ring' || part.kind === 'frame') return ROLE_STAGE[part.role] ?? 0;
  return 0; // arrow / wedge / figure / dimLeader are orientation aids — always shown
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

// A vehicle-defilade cut is doctrinally SHALLOW relative to how WIDE it is — rendered at true
// scale the relief all but disappears, so the vehicle_ramp branch below exaggerates the
// STAIRCASE's visual depth only (display-only, like vertical exaggeration on a terrain-relief
// model; never touches depthOfCut itself). Module-scoped so the camera-framing bounds size at
// the bottom of buildScene3D can size itself to what's actually drawn, not the un-exaggerated
// depth — otherwise the reset camera frames the model as if it were 3x shallower than it reads,
// leaving the deep end of the ramp mostly out of frame.
const RELIEF_EXAGGERATION = 3;

// What the excavation FACE is actually built from, straight from the operator's own revetment
// choice — the same doctrine row the BOM already reads. 'panel' covers two distinct doctrinal
// systems (corrugated metal, timber/plywood) that the engine's BOM treats identically; the 3D
// view still tells them apart visually since the operator picked a specific one.
function wallFinishFor(result: Result): WallFinish {
  const revet = revetments[result.inputs.revetment] ?? revetments['none']!;
  if (revet.kind === 'bag') return 'sandbag';
  if (revet.kind === 'picket') return 'picket';
  if (revet.kind === 'panel') return result.inputs.revetment === 'corrugated_metal' ? 'corrugated' : 'timber';
  return 'earth'; // kind 'none' — bare earth, sloped per soil below
}

export function buildScene3D(result: Result, opts: BuildOpts = {}): Scene3DModel {
  const geo = result.geometry as GeometryModel;
  if (!geo.hasAnything) {
    return { hasAnything: false, parts: [], bounds: { size: 20, depth: 0 }, engineeredRoof: false, cutaway: opts.cutaway === true };
  }

  const p = geo.plan;
  const s = geo.section;
  const parts: Part3[] = [];
  const terrainHoles: TerrainHole[] = [];
  let terrainOuter = { x: 0, z: 0, w: 20, d: 20 };
  const halfL = p.holeL / 2;
  const halfW = p.holeW / 2;
  const wallT = Math.max(0.3, p.parapetW * 0.35); // visual wall thickness for the excavation sides

  const finish = wallFinishFor(result);
  const soilRow = soils[result.inputs.soil];
  const slopeRatio = finish === 'earth' ? (soilRow ? soilRow.wallSlopeRatio.value : 0) : 0;
  const picketSpacing = revetments[result.inputs.revetment]?.spacing?.value ?? 2;
  // The RENDERED parapet height is the COMPUTED one (doctrine × standard), not a hardcoded
  // constant — a previous fixed 1.1 ft drew more than double the doctrine's 0.5 ft of bags,
  // so the model contradicted the spec panel's own "Parapet height" row and every position
  // read as massively over-bagged. Floored at one laid course so it never renders as zero.
  const parapetH = Math.max(0.35, finite(s.parapetH));

  // What the parapet is built FROM (research-verified): 'earth' = mounded spoil (rifle/crew/
  // mortar/ATGM/trench — the protective mass is dirt, bags only at the firing rest); 'sandbag'
  // = built-up bag walls (bunker only); 'berm' = vehicle spoil berm (handled in its own branch).
  const position = positions[result.inputs.positionType];
  const parapetMode = position ? parapetModeFor(position) : 'earth';
  const ringMode: 'earth' | 'sandbag' = parapetMode === 'sandbag' ? 'sandbag' : 'earth';
  const restCount = position && position.sectorsOfFire && parapetMode === 'earth' ? (position.crewSize >= 2 ? 2 : 1) : 0;

  // ── Footprint by shape (§ each design gets a distinct silhouette) ────────────
  if (geo.shape === 'circular') {
    const rOuter = Math.max(p.outerL, p.outerW) / 2;
    const rHole = Math.max(halfL, halfW);
    // A ring (not a solid disc) — same reasoning as pushGroundFrame below: a solid disc would
    // span the ENTIRE footprint including the pit itself, hiding the floor cylinder several feet
    // down under a solid grass-green cap. innerR matches the floor cylinder's own radius exactly.
    parts.push({ kind: 'ring', x: 0, z: 0, outerR: rOuter, innerR: rHole, height: 0.05, role: 'ground' });
    // A single smooth extruded annulus — no segment seams (a prior 8-box approximation left
    // visible outline clutter at every seam and read as a dark, broken-looking ring). Earth
    // (spoil) parapet, not sandbags: a mortar pit's ring is dozed spoil, not a stacked bag wall.
    parts.push({ kind: 'ring', x: 0, z: 0, outerR: rHole + p.parapetW, innerR: rHole, height: parapetH, role: 'earthParapet' });
    // Mortar-pit walls are ALWAYS splayed/battered outward bottom-to-top (~4:1 to 5:1,
    // vertical:horizontal) regardless of revetment choice — doctrine sizes this batter for
    // repeated firing-concussion durability, not soil stability, so unlike the rectangular
    // shapes' earth-only taper this applies even when sandbag-revetted (the previous code only
    // sloped an UNrevetted earth face, matching soil angle-of-repose logic that doesn't apply
    // here). MORTAR_PIT_BATTER is a fixed doctrine ratio, independent of the soil-driven
    // slopeRatio used for bare unrevetted rectangular walls elsewhere in this file.
    const MORTAR_PIT_BATTER = 0.25; // 1 ft horizontal per 4 ft vertical
    const rTop = Math.min(rHole + Math.min(MORTAR_PIT_BATTER * s.depthOfCut, p.parapetW * 0.9), rOuter - 0.2);
    // Grade margin matches pushBayBox's rationale exactly (see there): a sliver above grade to
    // close the crust seam — the terrain's true hole cutout made the old bigger margin obsolete.
    const gradeMargin = 0.08;
    parts.push({
      kind: 'cyl', x: 0, y: -s.depthOfCut / 2 + gradeMargin / 2, z: 0,
      radius: rHole, radiusTop: rTop, height: s.depthOfCut + gradeMargin, role: 'bayFloor',
    });
    // Terrain hole = the pit at its WIDEST (the battered top radius), plus clearance.
    terrainHoles.push({ kind: 'circle', x: 0, z: 0, r: rTop + 0.05, depth: finite(s.depthOfCut) });
    terrainOuter = { x: 0, z: 0, w: rOuter * 2 + 4, d: rOuter * 2 + 4 };
  } else if (geo.shape === 'vehicle_ramp') {
    const runLen = p.holeW;
    // Ground is centered on the RAMP's own z-center (not world origin) so its footprint always
    // fully contains the ramp regardless of length — a fixed-at-origin ground previously left
    // the deep end of a long ramp hanging past its edge with nothing rendered underneath.
    const rampZCenter = -runLen / 2;
    pushGroundFrame(parts, 0, rampZCenter, p.outerL + 4, runLen + 6, p.holeL, runLen);
    // A ramp descending from grade to full depth, built as a stepped "staircase" of plain
    // boxes — the same proven box primitive every other part uses (a single continuously
    // sloped/rotated extrude turned out fragile: see DECISIONS D20). Cartoon-appropriate too.
    //
    // A vehicle-defilade cut is doctrinally SHALLOW relative to how WIDE it is (a few feet of
    // depth across a footprint tens of feet wide) — rendered at true scale under a camera framed
    // to fit that width, the relief all but disappears. RELIEF_EXAGGERATION is a display-only
    // convention (the same idea as vertical exaggeration on a terrain-relief model): it multiplies
    // the STAIRCASE'S visual depth only, purely inside this 3D descriptor. It never touches
    // depthOfCut itself, so every real number (BOM, labor, the 2D plan/section) is unaffected —
    // this view alone is allowed to be honest about shape at the cost of being literal about scale.
    const depthEx = s.depthOfCut * RELIEF_EXAGGERATION;
    const steps = 6;
    const stepLen = runLen / steps;
    const base = -(depthEx + 1); // shared floor so consecutive treads never gap
    for (let i = 0; i < steps; i++) {
      // i=0's top sits flush with grade (0); the LAST tread reaches the (exaggerated) full
      // depth — no gap at the entry, and the deepest point still reads clearly as a real cut.
      const topY = -(i / (steps - 1)) * depthEx;
      const zNear = -i * stepLen; // nearer the entry (grade)
      const zFar = -(i + 1) * stepLen; // nearer the parked end (full depth)
      parts.push({
        kind: 'box',
        x: 0,
        y: (topY + base) / 2,
        z: (zNear + zFar) / 2,
        w: p.holeL,
        h: topY - base,
        d: stepLen + 0.05, // tiny overlap so treads never show a hairline gap
        role: 'bayFloor',
        finish: 'earth',
      });
    }
    // Doctrine (FM 5-103): for a DELIBERATE vehicle position defeating kinetic-energy threats,
    // "the spoil is flattened out or hauled away" — a tall piled berm is explicitly the WRONG
    // technique here (it gives a false sense of security against KE rounds, which a parapet
    // can't stop, and raises the position's visual signature). The depth of cut is what protects
    // the vehicle, not a mound beside it. This used to render as a prominent 3x-exaggerated wall
    // flanking the ramp, which taught exactly the wrong mental model — now a low, flattened
    // spoil residue, not exaggerated with the cut's own RELIEF_EXAGGERATION (that multiplier
    // exists to keep the CUT legible at scale; applying it to the berm too made "flattened"
    // spoil read as a deliberately-built rampart instead).
    const bermH = Math.max(0.3, p.parapetW * 0.15);
    parts.push({ kind: 'box', x: -(halfL + p.parapetW / 2), y: bermH / 2, z: -runLen / 4, w: p.parapetW, h: bermH, d: runLen, role: 'rampBerm', finish: 'earth' });
    parts.push({ kind: 'box', x: halfL + p.parapetW / 2, y: bermH / 2, z: -runLen / 4, w: p.parapetW, h: bermH, d: runLen, role: 'rampBerm', finish: 'earth' });
    // Terrain hole matches the DRAWN (exaggerated) staircase, not the doctrinal depthOfCut —
    // the earth block has to enclose what's actually rendered. +0.1 width clearance: the tread
    // boxes are exactly holeL wide, and a zero-clearance hole leaves their side faces coplanar
    // with the terrain cut (z-fighting shimmer down both flanks of the ramp).
    terrainHoles.push({ kind: 'rect', x: 0, z: -runLen / 2, w: p.holeL + 0.1, d: runLen, depth: finite(depthEx) });
    terrainOuter = { x: 0, z: rampZCenter, w: p.outerL + 4, d: runLen + 6 };
  } else {
    // rect, rect_roofed, inverted_t, l_shape all start from a rectangular ring + bay.
    // Every position needs a way in and out — a fully closed 4-sided box (the previous shape)
    // has none. Doctrine puts the entrance at the rear (away from the enemy), so both the raised
    // parapet and the excavation wall beneath it open there, sized for a person to pass through.
    //
    // ATGM/Javelin positions need far more than a walk-through gap back there: the launcher's
    // backblast cone (Javelin ~60°/25m, TOW ~90°/75m) needs a genuinely open lane clear of hard
    // vertical surfaces — a normal rear parapet is exactly the kind of obstruction that could
    // reflect the backblast back at the crew. Structurally these positions need a wide open rear,
    // not a taller wall, so the gap covers most of the bay's width instead of a person-sized slot.
    // This gap is for the EXCAVATION (a real 4+ ft cut needs a way down) — the shallow ~0.5 ft
    // earth mound above it doesn't need its own separate gap; it's low enough to step over
    // anywhere, including on the ATGM's backblast side (a 6-inch dirt lip isn't the "hard
    // reflecting surface" the backblast concern is about — that's a real risk for a tall
    // sandbag wall, which is why the bunker's ring below still gets one).
    const isAtgm = result.inputs.positionType === 'atgm_javelin';
    const entranceGap = isAtgm ? p.holeL * 0.85 : Math.min(3, p.holeL * 0.4);
    pushGroundFrame(parts, 0, 0, p.outerL + 4, p.outerW + 4, p.holeL, p.holeW);
    if (ringMode === 'earth') {
      // One continuous mounded berm — rounded corners, sloped/beveled cross-section — instead
      // of 4 flat-topped boxes meeting at hard square seams (the "different shaped square
      // blocks of dirt" a real parapet never looks like).
      parts.push({ kind: 'frame', x: 0, z: 0, outerL: p.holeL + 2 * p.parapetW, outerW: p.holeW + 2 * p.parapetW, holeL: p.holeL, holeW: p.holeW, height: parapetH, role: 'earthParapet' });
    } else {
      pushRing(parts, 0, 0, p.holeL, p.holeW, p.parapetW, parapetH, entranceGap);
    }
    // Earth-parapet rifle/crew positions get the sandbag firing rest(s) at the aperture — the
    // only concentrated bags on an otherwise-dirt parapet.
    pushFiringRests(parts, p.holeL, p.holeW, p.parapetW, parapetH, restCount);
    pushBayBox(parts, 0, 0, p.holeL, p.holeW, s.depthOfCut, wallT, finish, slopeRatio, picketSpacing, p.parapetW, entranceGap);

    // Hole envelopes expand past the excavation by the wall taper (bare sloped earth flares
    // OUTWARD toward the top — same formula as pushBayBox's taperAmount, INCLUDING the bay-size
    // clamp that keeps a slumping soil's flare from exceeding a narrow bay) plus clearance, so
    // the terrain block hugs the flared wall top without clipping through it. Sub-bays (the
    // T-stem / L-arm) compute theirs from their OWN dims below, same formula.
    const taperFor = (bayL: number, bayW: number, depthMul: number, pwMul: number): number =>
      finish === 'earth' ? Math.min(slopeRatio * s.depthOfCut * depthMul, p.parapetW * pwMul * 0.9, Math.min(bayL, bayW) * 0.35) : 0;
    const e = taperFor(p.holeL, p.holeW, 1, 1) + 0.05;
    terrainOuter = { x: 0, z: 0, w: p.outerL + 4, d: p.outerW + 4 };

    if (geo.shape === 'inverted_t') {
      // A narrower connecting trench extends toward the rear from the bay's center (the "shaft"
      // of the inverted-T) — a doctrinal crew/ammo trench, not a separately-parapeted position
      // in its own right, so unlike the main bay it gets NO raised parapet ring: just the
      // excavated trench walls (previously it wrongly got a full ring scaled off the MAIN
      // parapet's thickness, which for a trench this narrow ballooned out wide enough to
      // swallow most of the main bay's own footprint).
      const stemW = Math.max(2, p.holeL * 0.3);
      const stemLen = p.holeW * 1.1;
      const stemZ = halfW + stemLen / 2;
      pushBayBox(parts, 0, stemZ, stemW, stemLen, s.depthOfCut * 0.85, wallT * 0.8, finish, slopeRatio, picketSpacing, p.parapetW * 0.7, Math.min(2.5, stemW));
      // One T-shaped union outline (main bay ∪ stem) — two rect holes sharing an edge would
      // be degenerate for shape triangulation.
      const es = taperFor(stemW, stemLen, 0.85, 0.7) + 0.05;
      const HL = halfL + e, HW = halfW + e, SW = stemW / 2 + es, SZ = halfW + stemLen + es;
      terrainHoles.push({
        kind: 'poly', depth: finite(s.depthOfCut),
        pts: [[-HL, -HW], [HL, -HW], [HL, HW], [SW, HW], [SW, SZ], [-SW, SZ], [-SW, HW], [-HL, HW]],
      });
    } else if (geo.shape === 'l_shape') {
      // A perpendicular arm attached at one end (crew/ammo alcove) forming an L — same
      // reasoning as the inverted-T's shaft: a connecting trench, not its own parapeted position.
      const armW = p.holeW * 0.9;
      const armLen = Math.max(2.5, p.holeL * 0.6);
      const armX = halfL + armLen / 2;
      const armZ = halfW - armW / 2;
      pushBayBox(parts, armX, armZ, armLen, armW, s.depthOfCut * 0.85, wallT * 0.8, finish, slopeRatio, picketSpacing, p.parapetW * 0.7);
      // One L-shaped union outline (main bay ∪ side arm), same single-polygon reasoning.
      const es = taperFor(armLen, armW, 0.85, 0.7) + 0.05;
      const HL = halfL + e, HW = halfW + e, AZ = halfW - armW - es, AX = halfL + armLen + es;
      terrainHoles.push({
        kind: 'poly', depth: finite(s.depthOfCut),
        pts: [[-HL, -HW], [HL, -HW], [HL, AZ], [AX, AZ], [AX, HW], [-HL, HW]],
      });
    } else {
      terrainHoles.push({ kind: 'rect', x: 0, z: 0, w: p.holeL + 2 * e, d: p.holeW + 2 * e, depth: finite(s.depthOfCut) });
    }
  }

  // ── Overhead cover — earth slab, OR the honest engineered hazard marker (§2.7) ──
  // Overhead cover is ALSO always sandbag construction per doctrine (bagsCover is computed
  // unconditionally whenever the roof is earth_on_stringers) — tagged 'sandbag' unconditionally,
  // matching the parapet.
  const earthRoof = s.coverOn && s.roofPath === 'earth_on_stringers';
  const engineeredRoof = s.roofPath === 'engineered_required';
  if (earthRoof && geo.shape !== 'vehicle_ramp') {
    // Setback (the "dead-man" bearing shelf): the roof's stringers must land on UNDISTURBED
    // earth back from the hole edge, ≥1 ft (one helmet) OR ¼ of the cut depth, whichever is
    // greater (ATP 5-238 / FM 5-103, both source-verified). The old flat +1 ft per side was
    // right for a shallow 4-ft cut but far too little for a deep one — the cover would bear on
    // the spoil lip and collapse the model's own load path.
    const setback = Math.max(1.0, 0.25 * s.depthOfCut);
    const coverY = s.coverT / 2 + 0.15;
    parts.push({ kind: 'box', x: 0, y: coverY, z: 0, w: p.holeL + 2 * setback, h: s.coverT, d: p.holeW + 2 * setback, role: 'cover', label: 'Roof cover', finish: 'sandbag' });
    const n = Math.max(1, Math.min(s.stringers, 8));
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const sx = -halfL - setback + frac * (p.holeL + 2 * setback);
      parts.push({ kind: 'box', x: sx, y: coverY - s.coverT / 2 - 0.15, z: 0, w: 0.35, h: 0.3, d: p.holeW + 2 * setback, role: 'stringer' });
    }
  } else if (engineeredRoof && geo.shape !== 'vehicle_ramp') {
    parts.push({ kind: 'box', x: 0, y: 1.4, z: 0, w: p.holeL + 1.5, h: 0.2, d: p.holeW + 1.5, role: 'engineeredCover', label: 'Engineered roof — see engineer' });
  }

  // ── Firing platform / firing step ─────────────────────────────────────────
  if (p.platform) {
    parts.push({ kind: 'box', x: 0, y: -s.depthOfCut + s.platformDepth / 2, z: -halfW + p.platform.W / 2, w: p.platform.L, h: s.platformDepth, d: p.platform.W, role: 'platform', label: 'Standing platform' });
  } else if (s.firingStepOn) {
    // A firing step / elbow rest is a 6-8 in ledge at the front of the hole (ATP 5-254,
    // source-verified) — not the up-to-9.6 in the old depth×0.25 produced on a deep cut.
    const ledgeH = Math.min(0.67, Math.max(0.5, s.depthOfCut * 0.15));
    parts.push({ kind: 'box', x: 0, y: -ledgeH / 2, z: -halfW + 0.4, w: Math.min(p.holeL * 0.6, p.holeL - 0.5), h: ledgeH, d: 0.8, role: 'firingStep', label: 'Step up' });
  }

  // ── Sumps (grenade catch pits) ────────────────────────────────────────────
  // A grenade sump is a dug CHANNEL at the floor, ~3 ft long × 6 in wide (FM 5-103), that a
  // grenade rolls into — an elongated trough reads as that, where the old vertical cylinder
  // read as a post-hole. Runs along the frontage at each sump mark; its bottom stays inside the
  // terrain floor plug (0.7 ft thick) so nothing pokes out underneath.
  for (const sump of p.sumps) {
    const sumpL = Math.min(2.8, Math.max(1.0, p.holeL * 0.5));
    parts.push({ kind: 'box', x: sump.xFt, y: -s.depthOfCut - 0.25, z: sump.yFt, w: sumpL, h: 0.5, d: 0.5, role: 'sump', label: 'Grenade sump' });
  }

  // ── Camouflage net (translucent plane above the position) ────────────────
  if (result.inputs.camouflage) {
    parts.push({ kind: 'box', x: 0, y: 1.8, z: 0, w: p.outerL * 1.1, h: 0.05, d: p.outerW * 1.1, role: 'camoNet', label: 'Camouflage' });
  }

  // ── Orientation: enemy arrow + sectors of fire ────────────────────────────
  const frontZ = -(halfW + p.parapetW + (geo.shape === 'vehicle_ramp' ? p.holeW / 2 : 0));
  parts.push({ kind: 'arrow', fromX: 0, fromZ: frontZ + 1.5, toX: 0, toZ: frontZ - 2.5, y: 0.4 });
  if (p.sectors.present) {
    parts.push({ kind: 'wedge', x: 0, z: frontZ, radius: Math.max(6, p.outerW), leftDeg: p.sectors.leftDeg, rightDeg: p.sectors.rightDeg });
  }

  // ── Standing figure for scale ──────────────────────────────────────────────
  // Clear of the earthworks on EVERY shape: the rectangular family's parapet ring extends to
  // halfL + parapetW, so the old halfL + 2 planted the figure ON the ring (legs clipping
  // through the bag courses — flagged by three separate audit frames). It stands on grass
  // beside the position, where a scale reference actually reads as one.
  const figureX = geo.shape === 'circular'
    ? Math.max(p.outerL, p.outerW) / 2 + 1.5
    : halfL + p.parapetW + 1.3;
  parts.push({ kind: 'figure', x: figureX, z: 1.5, heightFt: 5.83 });

  // The vehicle ramp's visual depth is exaggerated (RELIEF_EXAGGERATION) well past depthOfCut —
  // frame the camera to that actual drawn depth, not the real doctrinal one, or the deep end
  // renders mostly out of frame against blank sky.
  const effectiveDepth = geo.shape === 'vehicle_ramp' ? s.depthOfCut * RELIEF_EXAGGERATION + 1 : s.depthOfCut;
  const boundsSize = finite(Math.max(p.outerL, p.outerW, effectiveDepth * 2) + 8);

  // The terrain outer block must CONTAIN every hole with margin — the fifty-cal's L-arm tip
  // used to overhang the old fixed-size ground frame's edge. Grow (never shrink) the outer
  // rect to cover each hole envelope plus a 1.5 ft apron.
  let oMinX = terrainOuter.x - terrainOuter.w / 2;
  let oMaxX = terrainOuter.x + terrainOuter.w / 2;
  let oMinZ = terrainOuter.z - terrainOuter.d / 2;
  let oMaxZ = terrainOuter.z + terrainOuter.d / 2;
  for (const h of terrainHoles) {
    const env =
      h.kind === 'rect' ? { minX: h.x - h.w / 2, maxX: h.x + h.w / 2, minZ: h.z - h.d / 2, maxZ: h.z + h.d / 2 }
      : h.kind === 'circle' ? { minX: h.x - h.r, maxX: h.x + h.r, minZ: h.z - h.r, maxZ: h.z + h.r }
      : {
          minX: Math.min(...h.pts.map((pt) => pt[0])),
          maxX: Math.max(...h.pts.map((pt) => pt[0])),
          minZ: Math.min(...h.pts.map((pt) => pt[1])),
          maxZ: Math.max(...h.pts.map((pt) => pt[1])),
        };
    oMinX = Math.min(oMinX, env.minX - 1.5);
    oMaxX = Math.max(oMaxX, env.maxX + 1.5);
    oMinZ = Math.min(oMinZ, env.minZ - 1.5);
    oMaxZ = Math.max(oMaxZ, env.maxZ + 1.5);
  }
  const terrain: TerrainSpec = {
    outer: { x: finite((oMinX + oMaxX) / 2), z: finite((oMinZ + oMaxZ) / 2), w: finite(oMaxX - oMinX), d: finite(oMaxZ - oMinZ) },
    holes: terrainHoles,
  };

  // Stage filter: show only parts built by the selected stage (undefined ⇒ final state). The
  // orientation aids (arrow/figure/wedge) always survive so the scene never loses its "which
  // way is the enemy" cue mid-build.
  const staged = opts.stage === undefined ? parts : parts.filter((part) => partStage(part) <= opts.stage!);
  return { hasAnything: true, parts: staged, bounds: { size: boundsSize, depth: finite(effectiveDepth) }, terrain, engineeredRoof, cutaway: opts.cutaway === true };
}

// A flat "ground" slab with a rectangular hole cut out over the excavation, built as 4
// picture-frame boxes (front/back full-width bands + left/right side bands) instead of one
// solid rectangle. A solid ground rectangle spans the ENTIRE footprint, including the hole
// itself — sitting barely below grade, its top face is only inches above the actual floor
// mesh several feet down, so any camera angle with enough downward component looks straight
// through the (unfilled) middle of the bay and sees flat grass-green where a dark excavated
// floor should read, no matter how tall the surrounding walls are built. The frame's inner
// edge exactly matches the excavation's true envelope (holeL x holeW) so there's no seam gap
// and no grass rendered over the hole.
function pushGroundFrame(parts: Part3[], cx: number, cz: number, outerL: number, outerW: number, holeL: number, holeW: number): void {
  const oHL = outerL / 2;
  const oHW = outerW / 2;
  const hHL = holeL / 2;
  const hHW = holeW / 2;
  const y = -0.02;
  const h = 0.05;
  const bandD = oHW - hHW; // front/back band depth
  if (bandD > 0.01) {
    parts.push({ kind: 'box', x: cx, y, z: cz - hHW - bandD / 2, w: outerL, h, d: bandD, role: 'ground' });
    parts.push({ kind: 'box', x: cx, y, z: cz + hHW + bandD / 2, w: outerL, h, d: bandD, role: 'ground' });
  }
  const bandL = oHL - hHL; // left/right band width
  if (bandL > 0.01) {
    parts.push({ kind: 'box', x: cx - hHL - bandL / 2, y, z: cz, w: bandL, h, d: holeW, role: 'ground' });
    parts.push({ kind: 'box', x: cx + hHL + bandL / 2, y, z: cz, w: bandL, h, d: holeW, role: 'ground' });
  }
}

// A rectangular ring of SANDBAG walls (front/rear/left/right) around a hole — only the bunker/
// OP (parapetMode 'sandbag') is actually built this way; every earth-mode position uses the
// single continuous Frame3 mound instead (see the rect-family branch above).
//
// rearGapFt (default 0 = fully closed, for secondary bays like an inverted-T's connecting
// trench that don't need their own entrance) splits the REAR wall — the side away from the
// enemy, +z per the plan's front=-z convention — into two segments with a centered gap, wide
// enough for a person to pass through. A real built-up sandbag wall is tall enough that a
// walking gap matters (unlike the low earth mound elsewhere), and doctrine puts that entrance
// at the rear, never through the frontal parapet that's actually facing the threat.
function pushRing(parts: Part3[], cx: number, cz: number, l: number, w: number, thick: number, height: number, rearGapFt = 0): void {
  const hl = l / 2;
  const hw = w / 2;
  parts.push({ kind: 'box', x: cx, y: height / 2, z: cz - hw - thick / 2, w: l + 2 * thick, h: height, d: thick, role: 'parapet' }); // front
  if (rearGapFt > 0 && rearGapFt < l) {
    const gapHalf = rearGapFt / 2;
    // Same total span as the un-gapped rear wall (l + 2*thick, reaching the outer corners where
    // the side walls meet it) minus the gap, split into two segments that flank the opening.
    const segW = hl + thick - gapHalf;
    parts.push({ kind: 'box', x: cx - hl - thick + segW / 2, y: height / 2, z: cz + hw + thick / 2, w: segW, h: height, d: thick, role: 'parapet' });
    parts.push({ kind: 'box', x: cx + hl + thick - segW / 2, y: height / 2, z: cz + hw + thick / 2, w: segW, h: height, d: thick, role: 'parapet' });
  } else {
    parts.push({ kind: 'box', x: cx, y: height / 2, z: cz + hw + thick / 2, w: l + 2 * thick, h: height, d: thick, role: 'parapet' }); // rear
  }
  parts.push({ kind: 'box', x: cx - hl - thick / 2, y: height / 2, z: cz, w: thick, h: height, d: w, role: 'parapet' }); // left
  parts.push({ kind: 'box', x: cx + hl + thick / 2, y: height / 2, z: cz, w: thick, h: height, d: w, role: 'parapet' }); // right
}

// The firing rest: a low sandbag course at the front of the parapet where the weapon sits — the
// ONLY concentrated sandbag on an earth-parapet rifle/crew position (ATP 3-21.8 §5-236 "Emplace
// grazing fire logs or sandbags"; §5-238 front retaining wall "2 filled sandbags in-depth").
// One rest for a single-sector position, two bracketing the sector for a crew/two-man. Sits on
// the front berm, facing the enemy (-z).
function pushFiringRests(parts: Part3[], holeL: number, holeW: number, parapetW: number, parapetH: number, count: number): void {
  if (count <= 0) return;
  const restH = 0.4; // one low course
  const z = -(holeW / 2 + parapetW * 0.5); // on the front berm, toward the enemy
  const y = parapetH + restH / 2 - 0.05; // resting on the berm top
  const xs = count === 1 ? [0] : [-holeL * 0.28, holeL * 0.28];
  for (const x of xs) {
    parts.push({ kind: 'box', x, y, z, w: 1.6, h: restH, d: parapetW * 0.7, role: 'parapet' });
  }
}

// The excavated bay: a floor (always bare earth — it's never revetted) + 4 walls whose finish
// matches the operator's actual revetment choice. When finish is 'earth' (no revetment) and the
// soil calls for a slope, each wall's OUTER face (away from the hole) flares out from bottom
// (unchanged, matching the floor) to top (wider, matching a real excavation's wider mouth) —
// clamped to stay within the parapet's own footprint so it never pokes out past the ground plane.
//
// rearGapFt (default 0) mirrors pushRing's entrance gap in the excavation wall itself, at the
// same rear location — without this, the parapet above would show an open entrance sitting
// directly over a solid excavation wall below it, reading as a mismatch/glitch rather than a way
// down into the position.
function pushBayBox(
  parts: Part3[],
  cx: number,
  cz: number,
  l: number,
  w: number,
  depth: number,
  wallT: number,
  finish: WallFinish,
  slopeRatio: number,
  picketSpacing: number,
  parapetW: number,
  rearGapFt = 0,
): void {
  parts.push({ kind: 'box', x: cx, y: -depth - 0.05, z: cz, w: l, h: 0.1, d: w, role: 'bayFloor', finish: 'earth' });
  const hl = l / 2;
  const hw = w / 2;
  // Walls run a HAIR above grade — just enough to close the seam where the wall top meets the
  // terrain crust's cut edge. The old 0.5 ft margin predates the terrain engine: it existed to
  // stop a SOLID ground plane (no real cutout) from showing green through the hole at shallow
  // view angles. The terrain now cuts TRUE holes, so there's no plane to hide — and half a foot
  // of wall poking above grade read as brown slabs with black outline rims floating across the
  // excavation mouth, especially once the parapet dropped to its honest doctrine height. The
  // low-quality tier still renders the flat ground frame, but its inner edge follows the hole
  // contour exactly, so a sliver margin covers that seam too.
  const gradeMargin = 0.08;
  const h = depth + gradeMargin;
  // Taper (bare-earth flare) clamps to the BAY'S OWN SIZE as well as the parapet footprint: in
  // a slumping soil (sand, ratio 1.48) a deep cut's raw flare can exceed a narrow bay's whole
  // width — opposite walls' flares then overlap and poke through each other, rendering a pile of
  // intersecting flaps instead of an excavation (seen on the 3-ft-deep-axis ATGM in sand). The
  // truthful message "this soil can't hold this cut" is the REVET_REQUIRED_SOIL error; the 3D
  // just needs the steepest slope it can draw without self-intersecting.
  const taperAmount = finish === 'earth' ? Math.min(slopeRatio * depth, parapetW * 0.9, Math.min(l, w) * 0.35) : 0;
  const wall = (x: number, z: number, w2: number, d2: number, taperAxis: 0 | 2, taperSign: 1 | -1): Box3 => ({
    kind: 'box',
    x,
    y: -depth / 2 + gradeMargin / 2,
    z,
    w: w2,
    h,
    d: d2,
    role: 'bayWall',
    finish,
    picketSpacing,
    // Axis/sign always carried (they orient the wall — which way is "away from the hole") so
    // finish renderers can place facing panels against the earth face; amount only when sloping.
    taperAxis,
    taperSign,
    ...(taperAmount > 0 ? { taperAmount } : {}),
  });
  parts.push(wall(cx, cz - hw + wallT / 2, l, wallT, 2, -1)); // front — outer face is -z
  if (rearGapFt > 0 && rearGapFt < l) {
    const gapHalf = rearGapFt / 2;
    const segW = hl - gapHalf; // inset walls meet at the inner corners (±hl), no corner overlap to account for
    parts.push(wall(cx - hl + segW / 2, cz + hw - wallT / 2, segW, wallT, 2, 1));
    parts.push(wall(cx + hl - segW / 2, cz + hw - wallT / 2, segW, wallT, 2, 1));
  } else {
    parts.push(wall(cx, cz + hw - wallT / 2, l, wallT, 2, 1)); // rear — outer face is +z
  }
  parts.push(wall(cx - hl + wallT / 2, cz, wallT, w, 0, -1)); // left — outer face is -x
  parts.push(wall(cx + hl - wallT / 2, cz, wallT, w, 0, 1)); // right — outer face is +x
}
