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
// corrugated metal / timber-plywood), or — when revetment is 'none' — bare, sloped earth. The
// SLOPE is never derived here: the soil-driven flare is published once as geo.section.wallTaper
// (and per sub-bay as taperFt), the same field the 2D section draws its trapezoid from, so the
// two views cannot hold two copies of one formula. src/ui/three-viewer.ts reads `finish` to
// decide HOW to build the mesh (sandbag tiling, picket+wire, a textured panel, or a tapered
// earthen face) — this file only decides WHICH finish applies, from the same doctrine tables the
// 2D renderer and BOM already consult.

import { revetments, sandbag } from '../doctrine/materials';
import { positions, parapetModeFor, vehicleRamp } from '../doctrine/positions';
import { REF_FIGURE_FT } from '../render/chrome';
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
  // A second, independent taper (same amount, the other axis) for the small corner posts that
  // fill the void where two adjacent tapered bay walls meet — each wall only flares along its
  // own axis, so the diagonal corner between them is otherwise never covered by either face.
  taperAxis2?: 0 | 2;
  taperSign2?: 1 | -1;
  // Sheared top for the vehicle access ramp: the box's top face tilts so its −z edge sits
  // `shearDrop` feet below its +z edge — a continuous grade the vehicle drives, not a staircase.
  shearDrop?: number;
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
  // A smooth rounded, beveled, single-piece MOUNDED berm around the fighting hole. `frontZ` is
  // the inner-front boundary: set back from the hole's own front edge by the front sandbag
  // rest's depth (see pushFrontSandbagRest), so the dirt mass starts right behind those bags
  // instead of overlapping them — 0 when there's no rest.
  //
  // closedRear: ATP 3-21.8 specifies a REAR retaining wall too ("at least 10 inches high"),
  // alongside front and flank walls — doctrine research (this project's task #26) found no
  // Army or USMC primary source describing an intentionally open/unwalled rear; inter-position
  // movement is via connecting trenches, not a gap in the parapet. So every position WITH a
  // firing aperture gets a fully closed ring. A connecting trench itself is the exception: it
  // has no directional aperture (sectorsOfFire false) because it IS the through-corridor
  // doctrine routes movement through — walling its rear would block its own purpose, so it
  // keeps the open-ended, flush-mound shape.
  kind: 'frame';
  x: number; z: number; // center
  holeL: number; holeW: number; // inner hole footprint (matches the excavation exactly)
  parapetW: number; // the mound's own thickness, front + both flanks (+ rear when closedRear)
  frontZ: number; // inner-front boundary, negative, at or forward of −holeW/2
  height: number;
  closedRear: boolean;
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
  | 'stringer' | 'platform' | 'firingStep' | 'entryStep' | 'sump' | 'camoNet' | 'rampBerm';

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
  entryStep: 2, // graded way down, cut during the deliberate dig
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
const RELIEF_EXAGGERATION = 2;

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
  // Visual wall thickness for the excavation sides. Capped at a fraction of the hole's OWN
  // smallest dimension — uncapped, this ate the entire floor on compact positions (a one-man's
  // 2.5 ft frontage left just 0.4 ft of clear floor between the two side walls: the parapet
  // mound and the excavation walls share the same earth finish/color, so from above it read as
  // "the parapet swallows the hole"). 0.2× keeps ≥60% of the smallest span open on every
  // position, from the one-man's 2.5 ft frontage up to the bunker's 8 ft.
  const wallT = Math.min(Math.max(0.3, p.parapetW * 0.35), Math.max(0.15, Math.min(p.holeL, p.holeW) * 0.2));

  const finish = wallFinishFor(result);
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
    // slopeRatio used for bare unrevetted rectangular walls elsewhere in this file. The ratio
    // itself is a doctrine leaf (features.mortarPit.batterRatio) and reaches every view through
    // geo.section.wallTaper — while it lived here as a constant, this was the only view that
    // knew the pit was flared at all: the plan drew a plain circle and the section plumb walls.
    const rTop = Math.min(rHole + s.wallTaper, rOuter - 0.2);
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
    // A graded access RAMP descending from grade to full depth, then a LEVEL firing PAN the
    // vehicle parks on. Doctrine (FM 5-103): a deliberate vehicle defilade is a graded ramp into
    // a level position — NOT a flight of steps (a tank drives a continuous grade, never treads).
    // The ramp box's top is SHEARED (see shearDrop) into one continuous slope; the pan is a flat
    // floor slab. Both are the same proven box primitive every other part uses.
    //
    // A vehicle-defilade cut is doctrinally SHALLOW relative to how WIDE it is (a few feet of
    // depth across a footprint tens of feet wide) — rendered at true scale under a camera framed
    // to fit that width, the relief all but disappears. RELIEF_EXAGGERATION is a display-only
    // convention (the same idea as vertical exaggeration on a terrain-relief model): it multiplies
    // the CUT'S visual depth only, purely inside this 3D descriptor. It never touches depthOfCut
    // itself, so every real number (BOM, labor, the 2D plan/section) is unaffected — this view
    // alone is allowed to be honest about shape at the cost of being literal about scale.
    const depthEx = s.depthOfCut * RELIEF_EXAGGERATION;
    const base = -(depthEx + 1); // shared floor so ramp and pan never gap
    const rampLen = runLen * vehicleRamp.rampRunFrac.value; // grade in — the DOMINANT feature so it reads as a ramp, not a wall
    const panLen = runLen - rampLen; // level position the vehicle sits on
    // Ramp: full-height box from z=0 (entry) to z=-rampLen, top sheared from grade (0) at the +z
    // entry edge down to -depthEx at the ramp/pan break.
    parts.push({
      kind: 'box', x: 0, y: base / 2, z: -rampLen / 2,
      w: p.holeL, h: -base, d: rampLen,
      role: 'bayFloor', finish: 'earth', shearDrop: depthEx,
    });
    // Pan: the level floor at -depthEx from the ramp break to the deep (front) end.
    parts.push({
      kind: 'box', x: 0, y: (-depthEx + base) / 2, z: -(rampLen + runLen) / 2,
      w: p.holeL, h: -depthEx - base, d: panLen,
      role: 'bayFloor', finish: 'earth',
    });
    // Doctrine (FM 5-103): for a DELIBERATE vehicle position defeating kinetic-energy threats,
    // "the spoil is flattened out or hauled away" — a tall piled berm is explicitly the WRONG
    // technique here (it gives a false sense of security against KE rounds, which a parapet
    // can't stop, and raises the position's visual signature). The depth of cut is what protects
    // the vehicle, not a mound beside it. This used to render as a prominent 3x-exaggerated wall
    // flanking the ramp, which taught exactly the wrong mental model — now a low, flattened
    // spoil residue, not exaggerated with the cut's own RELIEF_EXAGGERATION (that multiplier
    // exists to keep the CUT legible at scale; applying it to the berm too made "flattened"
    // spoil read as a deliberately-built rampart instead). How high the berm stands is still a
    // RULE (protection.berm.H, published as s.parapetH) and not this view's to decide: the local
    // formula drew it at 0.6 ft while the 2D section drew the doctrine's 2.0 ft, so the two
    // views of one berm stood 3.3× apart. If the berm should be lower, the leaf is where to
    // say so — a renderer override says it in a place the bill and the section never read.
    const bermH = s.parapetH;
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
    const entranceGap = s.access.entranceGapFt;
    pushGroundFrame(parts, 0, 0, p.outerL + 4, p.outerW + 4, p.holeL, p.holeW);
    if (ringMode === 'earth') {
      // One continuous mounded piece (rounded, beveled cross-section — not 4 flat-topped boxes
      // meeting at hard square seams), closed on all four sides per ATP 3-21.8 (front, flank,
      // AND rear retaining walls) for any position with a firing aperture. A connecting trench
      // is the one exception — it has no aperture because it IS the through-corridor doctrine
      // routes movement through, so it keeps an open-ended mound instead of walling itself shut.
      //
      // A real firing position (sectorsOfFire) gets the ONLY concentrated sandbag on the whole
      // parapet: one course across the full frontage, 2 bags deep, right at the hole's edge —
      // the stable rifle rest the dirt mound is then piled around and behind (its inner-front
      // boundary sits BEHIND the bags, so dirt starts right where they end). A connecting trench
      // has no directional aperture to rest a weapon on, so its mound sits flush at the hole edge.
      const hasAperture = position?.sectorsOfFire === true;
      const bagDepth = hasAperture ? frontSandbagRestDepth() : 0;
      // The dirt is built up AROUND the bags for head protection — it must never sit shorter
      // than the rest it's supposedly piled around, or the bags would stick up past the mound.
      const moundH = hasAperture ? Math.max(parapetH, sandbag.frontWallHeight.value) : parapetH;
      parts.push({
        kind: 'frame', x: 0, z: 0,
        holeL: p.holeL, holeW: p.holeW, parapetW: p.parapetW, height: moundH, role: 'earthParapet',
        frontZ: -(p.holeW / 2 + bagDepth),
        closedRear: hasAperture,
      });
      if (hasAperture) pushFrontSandbagRest(parts, p.holeL, p.holeW);
    } else {
      pushRing(parts, 0, 0, p.holeL, p.holeW, p.parapetW, parapetH, entranceGap);
    }
    pushBayBox(parts, 0, 0, p.holeL, p.holeW, s.depthOfCut, wallT, finish, s.wallTaper, picketSpacing, entranceGap);
    // A graded way DOWN at the rear entrance: a short flight of earth steps from grade to floor,
    // so a deep hole isn't a sheer drop you'd have to jump into. Only when the cut is deep enough
    // to warrant it and there's a rear opening to descend through.
    pushEntrySteps(parts, p.holeL, p.holeW, s.depthOfCut, entranceGap, wallT, s.access);

    // Hole envelopes expand past the excavation by the wall taper (bare sloped earth flares
    // OUTWARD toward the top — the published wallTaper the walls above were built with) plus
    // clearance, so the terrain block hugs the flared wall top without clipping through it.
    // Sub-bays (the T-stem / L-arm) carry their own published taperFt.
    const e = s.wallTaper + 0.05;
    terrainOuter = { x: 0, z: 0, w: p.outerL + 4, d: p.outerW + 4 };

    const subBay = p.subBays[0];
    if (geo.shape === 'inverted_t' && subBay) {
      // A narrower connecting trench extends toward the rear from the bay's center (the "shaft"
      // of the inverted-T) — a doctrinal crew/ammo trench, not a separately-parapeted position
      // in its own right, so unlike the main bay it gets NO raised parapet ring: just the
      // excavated trench walls (previously it wrongly got a full ring scaled off the MAIN
      // parapet's thickness, which for a trench this narrow ballooned out wide enough to
      // swallow most of the main bay's own footprint).
      // The stem's own dimensions come from the position's subBay leaves, the same block the
      // plan view reads — this was a second copy of the same trench, derived from the hole with
      // its own factors, so the two views could and did disagree about a real dug volume.
      const stemW = subBay.L;
      const stemLen = subBay.W;
      const stemDepth = subBay.depthFt;
      const stemZ = subBay.zFt;
      pushBayBox(parts, 0, stemZ, stemW, stemLen, stemDepth, wallT * 0.8, finish, subBay.taperFt, picketSpacing, Math.min(2.5, stemW));
      // One T-shaped union outline (main bay ∪ stem) — two rect holes sharing an edge would
      // be degenerate for shape triangulation.
      const es = subBay.taperFt + 0.05;
      const HL = halfL + e, HW = halfW + e, SW = stemW / 2 + es, SZ = halfW + stemLen + es;
      terrainHoles.push({
        kind: 'poly', depth: finite(s.depthOfCut),
        pts: [[-HL, -HW], [HL, -HW], [HL, HW], [SW, HW], [SW, SZ], [-SW, SZ], [-SW, HW], [-HL, HW]],
      });
    } else if (geo.shape === 'l_shape' && subBay) {
      // A perpendicular arm attached at one end (crew/ammo alcove) forming an L — same
      // reasoning as the inverted-T's shaft: a connecting trench, not its own parapeted position.
      // Same source as the plan view's arm, for the same reason.
      const armW = subBay.W;
      const armLen = subBay.L;
      const armDepth = subBay.depthFt;
      const armX = subBay.xFt;
      const armZ = subBay.zFt;
      pushBayBox(parts, armX, armZ, armLen, armW, armDepth, wallT * 0.8, finish, subBay.taperFt, picketSpacing);
      // One L-shaped union outline (main bay ∪ side arm), same single-polygon reasoning.
      const es = subBay.taperFt + 0.05;
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
  if (earthRoof && s.roof && geo.shape !== 'vehicle_ramp') {
    // ONE published footprint, read as absolute edge coordinates in the section's own frame, so
    // the 3D model cannot drift from the 2D section or from the slab the BOM bills. Every extent
    // is OUTWARD past the corresponding hole wall (see GeometryModel.RoofModel): the supports
    // stand back from the lip by the setback, the stringers overhang them by the bearing, and
    // the deck follows the stringers onto undisturbed ground. Front and rear are the same number
    // — a rear support is a support. The ENDS take the flank lap instead, because no stringer
    // end lands there; this used to reuse the rear figure on the end walls, which is a bearing
    // requirement applied where nothing bears.
    const roof = s.roof;
    const coverY = s.coverT / 2 + 0.15;
    const coverD = roof.rearEdgeFt - roof.frontEdgeFt;
    const coverW = 2 * roof.endEdgeFt;
    const stringerY = coverY - s.coverT / 2 - roof.stringer.sectionFt / 2;
    if (roof.entranceNotchFt > 0) {
      // A roofed bunker/OP: extended its full rear bearing, the deck roofs over the position's
      // own entrance corridor and seals it shut. The DECK is notched across the passage width so
      // the corridor stays open to the sky. The STRINGERS are not shortened — they keep their
      // full rear bearing on undisturbed ground, which is the whole point of the setback; you
      // duck under a beam to walk in, you do not climb over a roof.
      const wingW = (coverW - roof.entranceNotchFt) / 2;
      const mainD = s.holeW / 2 - roof.frontEdgeFt;
      parts.push({ kind: 'box', x: 0, y: coverY, z: roof.frontEdgeFt + mainD / 2, w: coverW, h: s.coverT, d: mainD, role: 'cover', label: 'Roof cover', finish: 'sandbag' });
      for (const sign of [-1, 1]) {
        parts.push({
          kind: 'box', x: sign * (roof.entranceNotchFt + wingW) / 2, y: coverY, z: s.holeW / 2 + roof.rearFt / 2,
          w: wingW, h: s.coverT, d: roof.rearFt, role: 'cover', label: 'Roof cover', finish: 'sandbag',
        });
      }
    } else {
      parts.push({ kind: 'box', x: 0, y: coverY, z: (roof.frontEdgeFt + roof.rearEdgeFt) / 2, w: coverW, h: s.coverT, d: coverD, role: 'cover', label: 'Roof cover', finish: 'sandbag' });
    }
    // The stringers RUN front-to-back (the supports lie along the frontage at the front and rear
    // lips) and are laid out ACROSS the frontage — the count is the engine's own, uncapped: the
    // old cap of 8 drew a connecting trench's 16 beams as 8, so the picture and the bill counted
    // different roofs. Their cross-section is the size the engine resolved for the span, not one
    // fixed section for every case.
    const n = Math.max(1, roof.stringer.count);
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : i / (n - 1);
      const sx = -roof.endEdgeFt + frac * coverW;
      parts.push({
        kind: 'box', x: sx, y: stringerY, z: (roof.frontEdgeFt + roof.rearEdgeFt) / 2,
        w: roof.stringer.sectionFt, h: roof.stringer.sectionFt, d: coverD, role: 'stringer',
      });
    }
  } else if (engineeredRoof && geo.shape !== 'vehicle_ramp') {
    // Footprint matches the 2D section's hazard block exactly (holeW + parapetW there) — this
    // marker fabricates no real structure (§2.7), so there's no doctrine leaf to size it from,
    // but the two views of the same "needs an engineer" flag should still agree on how big a
    // banner they draw over the position instead of each inventing its own constant (this used
    // a flat +1.5 ft/side that didn't match the 2D section's +parapetW — 3.0 ft for one_man —
    // leaving the two views 1.5 ft apart on the same hazard marker for the identical position).
    parts.push({ kind: 'box', x: 0, y: 1.4, z: 0, w: p.holeL + p.parapetW, h: 0.2, d: p.holeW + p.parapetW, role: 'engineeredCover', label: 'Engineered roof — see engineer' });
  }

  // ── Firing platform / firing step ─────────────────────────────────────────
  if (s.platform) {
    // Undisturbed ground the crew bays are dug down AROUND — earth left standing, not a built
    // stand, so it is labelled as what it is. Its rise and footprint are the engine's own, the
    // same ones the excavation SUBTRACTS.
    parts.push({ kind: 'box', x: 0, y: -s.depthOfCut + s.platform.riseFt / 2, z: -halfW + s.platform.W / 2, w: s.platform.L, h: s.platform.riseFt, d: s.platform.W, role: 'platform', label: 'Ground left undug (firing platform)' });
  } else if (s.firingStepOn) {
    // The ledge's size is a rule now, not a renderer constant: no published doctrinal firing-step
    // height exists (the doctrinal platform is at grade), which is why the leaf ships as an
    // openly model-derived placeholder — and why the citation that used to sit on this line had
    // to go. The 2D section and this view drew it at two different sizes for as long as each
    // held its own formula.
    const ledgeH = Math.min(s.firingStep.heightFt, s.depthOfCut);
    const ledgeRun = Math.min(s.firingStep.runFt, p.holeW);
    // The ledge runs the full frontage of the bay, like the firing rest above it — its width
    // used to be min(holeL × 0.6, holeL − 0.5), two invented fractions of the hole.
    parts.push({ kind: 'box', x: 0, y: -ledgeH / 2, z: -halfW + ledgeRun / 2, w: p.holeL, h: ledgeH, d: ledgeRun, role: 'firingStep', label: 'Step up' });
  }

  // ── Sumps (grenade catch pits) ────────────────────────────────────────────
  // Drawn at the size the BOM bills it (materials.sump, via geo.plan.sumpBox). This used to be a
  // trough of the renderer's own proportions — a third size for one hole, after the section's
  // notch and the volume the bill charged for.
  for (const sump of p.sumps) {
    const box = p.sumpBox;
    parts.push({ kind: 'box', x: sump.xFt, y: -s.depthOfCut - box.D / 2, z: sump.yFt, w: box.L, h: box.D, d: box.W, role: 'sump', label: 'Grenade sump' });
  }

  // ── Camouflage net (translucent plane above the position) ────────────────
  // Extent and height both published: the plane's area is now exactly the net area the BOM
  // orders (drapeFactor is an AREA factor, so the linear stretch per axis is its square root),
  // where this used to stretch 1.1× per axis and fly at a height of its own invention.
  if (p.camoNet) {
    parts.push({ kind: 'box', x: 0, y: p.camoNet.heightFt, z: 0, w: p.camoNet.L, h: 0.05, d: p.camoNet.W, role: 'camoNet', label: 'Camouflage' });
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
  // l_shape digs a crew/ammo arm on the +x side (armX = halfL + armLen/2), so the usual +x
  // figure position lands IN that arm's trench — mirror it to the clear -x side there. Every
  // other shape keeps the figure on +x beside the position.
  const figureX = geo.shape === 'circular'
    ? Math.max(p.outerL, p.outerW) / 2 + 1.5
    : geo.shape === 'l_shape'
    ? -(halfL + p.parapetW + 1.3)
    : halfL + p.parapetW + 1.3;
  // ONE scale-figure height for the whole app: the 2D drawings' standing figure and this one
  // are the same person, and they were two separate literals.
  parts.push({ kind: 'figure', x: figureX, z: 1.5, heightFt: REF_FIGURE_FT });

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
// The front sandbag rest: doctrine's real firing-position construction (ATP 3-21.8 §5-238,
// "front retaining wall...10 inches high (2 filled sandbags in-depth)") is a SINGLE course of
// bags spanning the FULL frontage, laid flat two-deep front-to-back, ~10 in tall — a stable
// shelf to lay the rifle on. It sits directly against the hole's front edge, at grade (bags on
// the ground, not floating on a berm), and the earth U-mound is built up around and behind it
// afterward (see the 'open' Frame3 in buildScene3D's rect-family branch) — this is the ONLY
// concentrated sandbag on an otherwise-dirt parapet. `bagDepthFt` (2 bag-widths) is returned so
// the caller can set the U-mound's front boundary flush against the bags' outer face.
function frontSandbagRestDepth(): number {
  return 2 * sandbag.W.value;
}
function pushFrontSandbagRest(parts: Part3[], holeL: number, holeW: number): void {
  const depth = frontSandbagRestDepth();
  const height = sandbag.frontWallHeight.value;
  parts.push({ kind: 'box', x: 0, y: height / 2, z: -(holeW / 2 + depth / 2), w: holeL, h: height, d: depth, role: 'parapet' });
}

// A short flight of earth steps at the REAR entrance (+z), descending from grade to the bay
// floor — a graded way in, not a sheer 4-ft drop. Each step is a solid earth block from its
// tread top down to the floor, stacked so consecutive treads read as a staircase carved in the
// dirt. Only emitted for a cut deep enough to need it, and only where there's a rear opening
// (gapW) to descend through. The steps hug x=0 (centered in the rear gap) and march forward
// (−z) into the bay as they drop.
function pushEntrySteps(
  parts: Part3[],
  holeL: number,
  holeW: number,
  depth: number,
  gapW: number,
  wallT: number,
  access: { stairMaxRiserFt: number; stairTreadFt: number },
): void {
  // Only a WALK-IN position earns a stair: a deep cut, a rear opening, AND enough front-to-back
  // room to fit the treads and still leave a floor to stand on. A tight rifle position's
  // front-to-back run is intentionally shallow (a narrow slot — see doctrine/positions.ts) —
  // stuffing a staircase in there would eat the whole floor, so it's a drop-in instead. A roomy
  // position (the bunker's 8 ft) earns the stair; a two-man's 2 ft does not.
  //
  // The step COUNT follows from the rise a person can climb, rather than a fixed two treads
  // sharing whatever the cut happened to be — two treads down a 6.5 ft bunker put every riser at
  // 2.17 ft (26 in) on a 6-in tread, which is not a stair, it is a fall with a ledge. A cut too
  // shallow to need two steps gets none, and a position without the floor to spare gets none.
  const tread = access.stairTreadFt;
  const n = Math.max(0, Math.ceil(depth / access.stairMaxRiserFt) - 1);
  if (n < 2 || gapW <= 0 || holeW < n * tread + gapW) return;
  const hw = holeW / 2;
  const stepW = Math.min(gapW, holeL);
  const riser = depth / (n + 1);
  for (let i = 0; i < n; i++) {
    const topY = -(i + 1) * riser; // this tread's top, descending from grade
    const h = depth + topY; // solid block down to the floor (topY is negative)
    const z = hw - wallT - (i + 0.5) * tread; // march forward from the rear inner wall
    parts.push({ kind: 'box', x: 0, y: topY - h / 2, z, w: stepW, h, d: tread + 0.02, role: 'entryStep', finish: 'earth' });
  }
}

// The excavated bay: a floor (always bare earth — it's never revetted) + 4 walls whose finish
// matches the operator's actual revetment choice. When the bay's published taper is nonzero
// (bare earth in a sloping soil), each wall's OUTER face (away from the hole) flares out from
// bottom (unchanged, matching the floor) to top (wider, matching a real excavation's wider
// mouth). `taperFt` is the engine's own figure — section.wallTaper for the main bay, the
// sub-bay's taperFt for a T-stem/L-arm — never a slope this file works out for itself: while
// this function held its own copy of the taper formula, its clamps could drift from the 2D
// section's with every view still green against its own tests.
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
  taperFt: number,
  picketSpacing: number,
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
    ...(taperFt > 0 ? { taperAmount: taperFt } : {}),
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

  // Corner posts: each wall above tapers along ONE axis only, so a flared bay otherwise leaves a
  // triangular void at all 4 corners where two faces should meet. A small wallT×wallT post,
  // double-tapered (same amount, both axes) so its own flare meets each adjacent wall's flare
  // flush, fills exactly that gap. Only needed when there's a flare to fill.
  if (taperFt > 0) {
    const corner = (x: number, z: number, signX: 1 | -1, signZ: 1 | -1): Box3 => ({
      kind: 'box',
      x,
      y: -depth / 2 + gradeMargin / 2,
      z,
      w: wallT,
      h,
      d: wallT,
      role: 'bayWall',
      finish,
      taperAxis: 2,
      taperSign: signZ,
      taperAmount: taperFt,
      taperAxis2: 0,
      taperSign2: signX,
    });
    parts.push(corner(cx - hl + wallT / 2, cz - hw + wallT / 2, -1, -1)); // front-left
    parts.push(corner(cx + hl - wallT / 2, cz - hw + wallT / 2, 1, -1)); // front-right
    parts.push(corner(cx - hl + wallT / 2, cz + hw - wallT / 2, -1, 1)); // rear-left
    parts.push(corner(cx + hl - wallT / 2, cz + hw - wallT / 2, 1, 1)); // rear-right
  }
}
