// ─────────────────────────────────────────────────────────────────────────────
// CROSS-VIEW PHYSICAL SWEEP — the bill, the 2D drawings and the 3D model must agree
// about every physical dimension of the same position, over the whole input space.
//
// WHY THIS EXISTS. The doctrine tables are the single source the geometry model and every
// drawing derive from — and yet, measured at HEAD before this pass, one position had THREE
// roofs: the BOM billed a 9.00 × 4.00 ft slab, the 3D model drew 9.00 × 5.00, and the 2D
// section drew 1.25 ft of it on the wrong side of the hole's own centreline. The platform was
// billed as extra excavation and drawn, in both views, as earth left standing. The sump was
// billed as one box and drawn as two other ones. Every one of those coexisted with a green
// suite, because each view was tested against itself.
//
// SO NOTHING HERE RE-IMPLEMENTS THE GEOMETRY IT CHECKS. Four observers each read ONE view's
// own output and report the same shaped record:
//   · fromGeometry — GeometryModel, the contract's single source
//   · fromBom      — result.bom / result.resolved only, the quantities a crew is issued
//   · fromScene    — buildScene3D()'s parts, recovered from the boxes' own edges
//   · fromSection  — drawSection()'s SVG, read back through a px→ft inverse recovered from the
//                    drawing itself and cross-checked against its own scale bar
// A field present in more than one observer must agree exactly. An observer that computed the
// value the way the engine does would agree with itself and prove nothing.
//
// AND THE SECOND PRONG KEEPS THE CONSTANTS OUT. A renderer may hold pixel constants, unitless
// art parameters and annotation margins. It may NOT hold a length in feet that a viewer could
// measure against the drawing's own scale bar — that is a rule, and it belongs to doctrine or
// to GeometryModel. The scan below reads the renderers' feet-valued SINKS (the 2D projector's
// own lenPx(), the 3D descriptor's size fields) and refuses a numeric literal in any of them
// unless it is named in the exemption table with a reason.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../src/engine/compute';
import { buildScene3D } from '../src/render3d/scene3d';
import { drawSection } from '../src/render/drawSection';
import { drawPlan } from '../src/render/drawPlan';
import { positions } from '../src/doctrine/positions';
import { threats } from '../src/doctrine/protection';
import { soils } from '../src/doctrine/soils';
import { revetments } from '../src/doctrine/materials';
import { defaultInputs } from './helpers';
import type { GeometryModel } from '../src/engine/geometry';
import type { Result, Inputs } from '../src/engine/types';
import type { Part3 } from '../src/render3d/scene3d';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// ── Observers ────────────────────────────────────────────────────────────────
// Every field is FEET (or ft², or a bare count). undefined = this view does not depict it,
// which is legal; a field two views DO depict must match.
type Obs = Record<string, number | undefined>;

function fromGeometry(r: Result): Obs {
  const geo = r.geometry as GeometryModel;
  const s = geo.section;
  const roof = s.roof;
  return {
    roofFrontEdgeFt: roof?.frontEdgeFt,
    roofRearEdgeFt: roof?.rearEdgeFt,
    roofEndEdgeFt: roof?.endEdgeFt,
    roofAreaFt2: roof?.areaFt2,
    roofThicknessFt: roof?.coverT,
    stringerCount: roof?.stringer.count,
    stringerSectionFt: roof?.stringer.sectionFt,
    stringerLengthFt: roof ? roof.rearEdgeFt - roof.frontEdgeFt : undefined,
    platformLFt: geo.plan.platform?.L,
    platformWFt: geo.plan.platform?.W,
    platformRiseFt: s.platform?.riseFt,
    sumpLFt: geo.plan.sumpBox.L,
    sumpWFt: geo.plan.sumpBox.W,
    sumpDFt: geo.plan.sumpBox.D,
    // parapetHFt is deliberately ABSENT from the field table. The 3D earth mound is built to
    // max(parapet.H, sandbag.frontWallHeight) — it must not sit shorter than the firing-rest
    // course it is piled around — while the section dimensions parapet.H. That is not a
    // rendering disagreement this contract can settle: it is two doctrine leaves describing one
    // object and disagreeing (audit C4, still open). Equating them here would assert a fact
    // neither table supports; dropping it silently would hide a real one, so it is named.
    // The BOM orders whole square feet, so the comparable quantity is the ordered one —
    // ceiling is a rounding rule, not a geometry the observer would be re-implementing.
    camoAreaFt2: geo.plan.camoNet ? Math.ceil(geo.plan.camoNet.L * geo.plan.camoNet.W - 1e-9) : undefined,
    subBayLFt: geo.plan.subBays[0]?.L,
    subBayWFt: geo.plan.subBays[0]?.W,
    wallTaperFt: s.wallTaper,
    // The firing-step ledge is drawn only when it is the position's raised feature — a
    // crew-served position's platform takes the same spot in both renderers.
    firingStepHFt: s.firingStepOn && !s.platform ? s.firingStep.heightFt : undefined,
    firingStepRunFt: s.firingStepOn && !s.platform ? s.firingStep.runFt : undefined,
  };
}

function fromBom(r: Result): Obs {
  const qty = (id: string): number | undefined => r.bom.find((l) => l.id === id)?.qtyPerPosition;
  const fill = qty('cover_soil_fill');
  const coverT = r.cover.thickness;
  return {
    roofThicknessFt: r.cover.roofPath === 'earth_on_stringers' && coverT > 0 ? coverT : undefined,
    // The slab the crew is issued fill for, divided by the thickness they are told to lay: the
    // deck AREA, arrived at without touching the geometry model. (Only the loose-fill cover
    // materials expose it — a sandbagged cover is billed as a whole-bag count, which is
    // deliberately lossy.)
    roofAreaFt2: fill !== undefined && coverT > 0 ? fill / coverT : undefined,
    stringerCount: qty('stringers'),
    camoAreaFt2: qty('camo_net'),
  };
}

function fromScene(scene: { parts: Part3[] }): Obs {
  const boxes = scene.parts.filter((p) => p.kind === 'box') as Extract<Part3, { kind: 'box' }>[];
  const byRole = (role: string): Extract<Part3, { kind: 'box' }>[] => boxes.filter((b) => b.role === role);
  const covers = byRole('cover');
  const beams = byRole('stringer');
  const platform = byRole('platform')[0];
  const step = byRole('firingStep')[0];
  const sump = byRole('sump')[0];
  const camo = byRole('camoNet')[0];
  const frame = scene.parts.find((p) => p.kind === 'frame');
  const ring = scene.parts.find((p) => p.kind === 'ring' && p.role === 'earthParapet');
  const bagRing = byRole('parapet')[0];
  const rampBerm = byRole('rampBerm')[0];
  const out: Obs = {};
  if (covers.length > 0) {
    out.roofFrontEdgeFt = Math.min(...covers.map((c) => c.z - c.d / 2));
    out.roofRearEdgeFt = Math.max(...covers.map((c) => c.z + c.d / 2));
    out.roofEndEdgeFt = Math.max(...covers.map((c) => c.x + c.w / 2));
    out.roofAreaFt2 = covers.reduce((a, c) => a + c.w * c.d, 0);
    out.roofThicknessFt = covers[0]!.h;
  }
  if (beams.length > 0) {
    out.stringerCount = beams.length;
    out.stringerSectionFt = beams[0]!.h;
    out.stringerLengthFt = beams[0]!.d;
  }
  if (platform) {
    out.platformLFt = platform.w;
    out.platformWFt = platform.d;
    out.platformRiseFt = platform.h;
  }
  if (step) {
    out.firingStepHFt = step.h;
    out.firingStepRunFt = step.d;
  }
  // The main bay's wall flare, read off the FRONT wall's own vertex taper (the frontmost
  // front-facing wall band is the main bay's — a T-stem/L-arm attaches rear or flank). A wall
  // with no taperAmount is drawn plumb, which is a reading of 0, not "not depicted".
  const frontWalls = boxes.filter((b) => b.role === 'bayWall' && b.taperAxis === 2 && b.taperSign === -1 && b.taperAxis2 === undefined);
  if (frontWalls.length > 0) {
    const front = frontWalls.reduce((a, b) => (b.z < a.z ? b : a));
    out.wallTaperFt = front.taperAmount ?? 0;
  }
  if (sump) {
    out.sumpLFt = sump.w;
    out.sumpWFt = sump.d;
    out.sumpDFt = sump.h;
  }
  if (camo) out.camoAreaFt2 = Math.ceil(camo.w * camo.d - 1e-9);
  // The frontal protection's HEIGHT, whichever construction this position uses.
  void frame; void ring; void bagRing; void rampBerm; // see the parapetHFt note in fromGeometry
  return out;
}

/** Pull one element by its data-feature key and return its numeric attributes. */
function feature(svg: string, key: string): Record<string, number> | undefined {
  const re = new RegExp('<(rect|polygon|circle)([^>]*?)data-feature="' + key + '"([^>]*)>');
  const m = re.exec(svg);
  if (!m) return undefined;
  const attrs = m[2]! + m[3]!;
  const out: Record<string, number> = {};
  for (const a of attrs.matchAll(/([a-z-]+)="([-\d.,\s]+)"/g)) {
    const v = Number(a[2]);
    if (Number.isFinite(v)) out[a[1]!] = v;
  }
  const pts = /points="([-\d.,\s]+)"/.exec(attrs);
  if (pts) {
    const xs = pts[1]!.trim().split(/\s+/).map((pt) => Number(pt.split(',')[0]));
    const ys = pts[1]!.trim().split(/\s+/).map((pt) => Number(pt.split(',')[1]));
    out.minX = Math.min(...xs);
    out.maxX = Math.max(...xs);
    out.minY = Math.min(...ys);
    out.maxY = Math.max(...ys);
  }
  return out;
}

/**
 * The px→ft inverse, recovered from the drawing itself — never from the geometry the sweep is
 * checking. The bay polygon carries four points at known feet (±(holeW/2 + wallTaper) at grade,
 * ±holeW/2 at the floor), which over-determines the scale on two axes; the scale bar draws
 * exactly 5 ft. The three are asserted to agree before a single reading is taken, so this
 * inverse can never quietly become a second implementation of what it is measuring.
 */
function sectionScale(svg: string, geo: GeometryModel): { pxPerFt: number; centreX: number; gradeY: number } | undefined {
  const bay = feature(svg, 'bay');
  if (!bay || bay.minX === undefined) return undefined;
  const s = geo.section;
  const xScale = (bay.maxX! - bay.minX) / (s.holeW + 2 * s.wallTaper);
  const yScale = (bay.maxY! - bay.minY!) / s.depthOfCut;
  const barMatch = /<g class="scale">.*?x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/.exec(svg);
  assert.ok(barMatch, 'the section draws a scale bar');
  const barScale = (Number(barMatch![2]) - Number(barMatch![1])) / 5; // scaleBar draws exactly 5 ft imperial
  assert.ok(Math.abs(xScale - yScale) < 1e-6, 'the drawing is not to one uniform scale: x ' + xScale + ' vs y ' + yScale);
  assert.ok(Math.abs(xScale - barScale) < 1e-6, 'the bay polygon and the scale bar disagree about scale: ' + xScale + ' vs ' + barScale);
  return { pxPerFt: xScale, centreX: (bay.minX + bay.maxX!) / 2, gradeY: bay.maxY! - s.depthOfCut * yScale };
}

function fromSection(svg: string, geo: GeometryModel): Obs {
  const sc = sectionScale(svg, geo);
  if (!sc) return {};
  const ft = (px: number): number => px / sc.pxPerFt;
  const out: Obs = {};
  const slab = feature(svg, 'overhead');
  if (slab) {
    out.roofFrontEdgeFt = ft(slab.x! - sc.centreX);
    // The rear edge is only readable on the centreline when the deck is not notched there —
    // a roofed bunker's A–A cuts THROUGH its entrance notch, which is the point of the notch.
    if ((geo.section.roof?.entranceNotchFt ?? 0) === 0) out.roofRearEdgeFt = ft(slab.x! + slab.width! - sc.centreX);
    out.roofThicknessFt = ft(slab.height!);
  }
  const beam = feature(svg, 'stringers');
  if (beam) {
    out.stringerSectionFt = ft(beam.height!);
    out.stringerLengthFt = ft(beam.width!);
  }
  const plat = feature(svg, 'platform');
  if (plat) {
    out.platformWFt = ft(plat.width!);
    out.platformRiseFt = ft(plat.height!);
  }
  const step = feature(svg, 'firing_step');
  if (step) {
    out.firingStepHFt = ft(step.height!);
    out.firingStepRunFt = ft(step.width!);
  }
  const sump = feature(svg, 'sump');
  if (sump) {
    out.sumpWFt = ft(sump.width!);
    out.sumpDFt = ft(sump.height!);
  }
  return out;
}

function fromPlan(svg: string, geo: GeometryModel): Obs {
  // The plan's own inverse comes from the bay rect, whose feet size the plan itself dimensions.
  const bay = feature(svg, 'bay');
  if (!bay) return {};
  const out: Obs = {};
  const pxPerFt = bay.width !== undefined
    ? bay.width / geo.plan.holeL
    : bay.r !== undefined
      ? bay.r / (Math.max(geo.plan.holeL, geo.plan.holeW) / 2 + geo.section.wallTaper)
      : 0;
  if (!(pxPerFt > 0)) return {};
  const plat = feature(svg, 'platform');
  if (plat) {
    out.platformLFt = plat.width! / pxPerFt;
    out.platformWFt = plat.height! / pxPerFt;
  }
  const sub = feature(svg, 'subbay');
  if (sub) {
    out.subBayLFt = sub.width! / pxPerFt;
    out.subBayWFt = sub.height! / pxPerFt;
  }
  return out;
}

// ── The corpus ───────────────────────────────────────────────────────────────
const POSITIONS = Object.keys(positions);
const THREATS = ['none', ...Object.keys(threats)];
const SOILS = Object.keys(soils);
const STANDARDS: Inputs['standard'][] = ['hasty', 'deliberate', 'reinforced'];
const REVETMENTS = Object.keys(revetments);

/** Tier B narrows the soil/revetment axes; this is the class each narrowed axis must still cover. */
const taperClass = (r: Result): string => {
  const t = (r.geometry as GeometryModel).section.wallTaper;
  return t === 0 ? 'vertical' : t > 1 ? 'wide' : 'moderate';
};

// SILENCE-PROOFING. A view that simply stops depicting something would make every comparison
// vacuously pass, which is the shape of bypass phase 1 kept finding. So every comparison that
// actually happened is counted by field, and the tests below assert the fields the contract is
// about were compared across every pair — not merely "no problems found".
const compared = new Map<string, number>();
function agree(a: Obs, b: Obs, nameA: string, nameB: string, ctx: string, tol = 1e-9): string[] {
  const problems: string[] = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined || vb === undefined) continue;
    compared.set(nameA + '|' + nameB + '|' + key, (compared.get(nameA + '|' + nameB + '|' + key) ?? 0) + 1);
    if (Math.abs(va - vb) > tol) {
      problems.push(ctx + ' ' + key + ': ' + nameA + ' ' + va.toFixed(4) + ' vs ' + nameB + ' ' + vb.toFixed(4));
    }
  }
  return problems;
}

test('TIER A — the bill, the geometry model and the 3D scene agree on every physical dimension, over the whole input space', () => {
  const problems: string[] = [];
  let cases = 0;
  for (const positionType of POSITIONS) {
    for (const threat of THREATS) {
      for (const standard of STANDARDS) {
        for (const soil of SOILS) {
          for (const camouflage of [false, true]) {
            const r = compute(defaultInputs({
              positionType, threat, standard, soil, camouflage,
              overheadCover: threat !== 'none', sump: true, firingStep: true, revetment: 'none',
            }));
            const ctx = [positionType, threat, standard, soil, camouflage ? 'camo' : 'bare'].join('/');
            const geo = fromGeometry(r);
            const scene = fromScene(buildScene3D(r));
            const bom = fromBom(r);
            problems.push(...agree(geo, scene, 'geometry', '3D', ctx));
            // The BOM's own area comes out of a division, so it carries float dust, not drift.
            problems.push(...agree(geo, bom, 'geometry', 'BOM', ctx, 1e-6));
            problems.push(...agree(scene, bom, '3D', 'BOM', ctx, 1e-6));
            cases++;
            if (problems.length > 12) break;
          }
        }
      }
    }
  }
  assert.ok(cases > 3000, 'the sweep must actually sweep — ' + cases + ' cases');
  assert.deepEqual(problems, [], 'views disagree about the same physical object:\n  ' + problems.join('\n  '));
  // …and every field the contract is about was actually compared, in both directions that can
  // see it. A view that stopped drawing the roof would otherwise pass this test in silence.
  const must: [string, string][] = [
    ['geometry|3D', 'roofFrontEdgeFt'], ['geometry|3D', 'roofRearEdgeFt'], ['geometry|3D', 'roofEndEdgeFt'],
    ['geometry|3D', 'roofAreaFt2'], ['geometry|3D', 'stringerCount'], ['geometry|3D', 'stringerSectionFt'],
    ['geometry|3D', 'stringerLengthFt'], ['geometry|3D', 'platformLFt'], ['geometry|3D', 'platformWFt'],
    ['geometry|3D', 'platformRiseFt'], ['geometry|3D', 'sumpLFt'], ['geometry|3D', 'sumpWFt'],
    ['geometry|3D', 'sumpDFt'], ['geometry|3D', 'camoAreaFt2'],
    ['geometry|3D', 'wallTaperFt'], ['geometry|3D', 'firingStepHFt'], ['geometry|3D', 'firingStepRunFt'],
    ['geometry|BOM', 'roofAreaFt2'], ['geometry|BOM', 'stringerCount'], ['geometry|BOM', 'camoAreaFt2'],
    ['3D|BOM', 'roofAreaFt2'], ['3D|BOM', 'stringerCount'],
  ];
  for (const [pair, field] of must) {
    assert.ok((compared.get(pair + '|' + field) ?? 0) > 0, pair + ' never compared ' + field + ' — a view that depicts nothing agrees with everything');
  }
});

test('TIER B — the 2D section and plan draw what the bill bills and the 3D model builds', () => {
  const problems: string[] = [];
  let cases = 0;
  const seenTaper = new Set<string>();
  for (const positionType of POSITIONS) {
    for (const threat of THREATS) {
      for (const standard of STANDARDS) {
        for (const soil of ['loam', 'sand', 'rock']) {
          const r = compute(defaultInputs({
            positionType, threat, standard, soil,
            overheadCover: threat !== 'none', sump: true, firingStep: true, revetment: 'none', camouflage: true,
          }));
          const geoModel = r.geometry as GeometryModel;
          const ctx = [positionType, threat, standard, soil].join('/');
          seenTaper.add(taperClass(r));
          const geo = fromGeometry(r);
          const section = fromSection(drawSection(r), geoModel);
          const plan = fromPlan(drawPlan(r), geoModel);
          // A drawn length is read back through a pixel raster, so it agrees to a hundredth of
          // a foot, not to 1e-9 — anything larger is a different number, not rounding.
          problems.push(...agree(geo, section, 'geometry', '2D section', ctx, 0.02));
          problems.push(...agree(geo, plan, 'geometry', '2D plan', ctx, 0.02));
          problems.push(...agree(section, plan, '2D section', '2D plan', ctx, 0.02));
          cases++;
          if (problems.length > 12) break;
        }
      }
    }
  }
  assert.ok(cases > 400, 'the SVG tier must actually sweep — ' + cases + ' cases');
  assert.deepEqual(problems, [], 'the drawings and the rules disagree:\n  ' + problems.join('\n  '));
  for (const field of ['roofFrontEdgeFt', 'roofRearEdgeFt', 'roofThicknessFt', 'stringerSectionFt', 'stringerLengthFt', 'platformWFt', 'platformRiseFt', 'firingStepHFt', 'firingStepRunFt', 'sumpWFt', 'sumpDFt']) {
    assert.ok((compared.get('geometry|2D section|' + field) ?? 0) > 0, 'the section never drew ' + field + ' anywhere in the corpus');
  }
  for (const field of ['platformLFt', 'platformWFt', 'subBayLFt', 'subBayWFt']) {
    assert.ok((compared.get('geometry|2D plan|' + field) ?? 0) > 0, 'the plan never drew ' + field + ' anywhere in the corpus');
  }
  // NARROWING-PROOFING. Tier B's soil axis is narrowed for runtime, and a comment saying "these
  // three cover every class" is exactly the kind of claim that rots. So the narrowed corpus is
  // required to still exhibit every wall-taper class the FULL soil axis produces: shrink it past
  // that and this fails rather than passing more quietly.
  const full = new Set<string>();
  for (const soil of SOILS) {
    for (const positionType of POSITIONS) {
      full.add(taperClass(compute(defaultInputs({ positionType, soil, revetment: 'none' }))));
    }
  }
  assert.deepEqual([...full].sort(), [...seenTaper].sort(), 'the narrowed soil axis no longer covers every wall-taper class the full one does');
});

test('TIER A covers every roof path, stringer size and shape the catalog can reach', () => {
  // A sweep that never reaches the roofed cases proves nothing about the roof. This asserts the
  // corpus above actually exercises the classes the contract is about.
  const roofPaths = new Set<string>();
  const sizes = new Set<string>();
  const shapes = new Set<string>();
  const notched = new Set<string>();
  for (const positionType of POSITIONS) {
    for (const threat of THREATS) {
      const r = compute(defaultInputs({ positionType, threat, overheadCover: threat !== 'none' }));
      const geo = r.geometry as GeometryModel;
      roofPaths.add(geo.section.roofPath);
      shapes.add(geo.shape);
      if (geo.section.roof) {
        sizes.add(geo.section.roof.stringer.sizeLabel);
        notched.add(geo.section.roof.entranceNotchFt > 0 ? 'notched' : 'plain');
      }
    }
  }
  assert.deepEqual([...roofPaths].sort(), ['earth_on_stringers', 'engineered_required', 'none']);
  assert.ok(sizes.size >= 2, 'more than one stringer size is reached: ' + [...sizes].join(','));
  assert.equal(shapes.size, 6, 'every shape family is swept');
  assert.deepEqual([...notched].sort(), ['notched', 'plain'], 'both the notched and un-notched roof are swept');
});

// ─────────────────────────────────────────────────────────────────────────────
// PRONG 2 — no renderer holds a length in feet
// ─────────────────────────────────────────────────────────────────────────────

/** The feet-valued sinks. In 2D that is the projector's own length call; in 3D the descriptor's
 *  SIZE fields (positions are compositions of published extents and are excluded by name below). */
const SIZE_KEYS = ['w', 'h', 'd', 'radius', 'radiusTop', 'height', 'outerR', 'innerR', 'heightFt', 'taperAmount', 'shearDrop'];

// A bare 2 doubling a per-side extent, or halving a diameter into a radius, is structure and not
// a magnitude — the same judgement the engine's own number-free gate already makes about 0.5.
// Nothing else is structural: a fraction OF a dimension is a proportion of a real cut, and
// proportions of real cuts belong to doctrine.
const STRUCTURAL = new Set(['2']);

interface Exemption {
  file: string;
  /** The sink expression exactly as the renderer writes it. */
  expr: string;
  /** A snippet that must still exist in that file, so a stale entry FAILS instead of rotting. */
  contains: string;
  /** Why this number is not a doctrinal magnitude. */
  reason: string;
}

const EXEMPTIONS: Exemption[] = [
  {
    file: 'src/render/drawSection.ts', expr: '1.2', contains: 'proj.lenPx(1.2)',
    reason: 'the ENGINEERED-ROOF hazard banner height. It fabricates no structure (§2.7), so there is deliberately no doctrine leaf sizing a "see an engineer" marker; the two views are locked to each other\'s banner envelope by test/scene3d.test.ts instead.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: '20', contains: 'bounds: { size: 20, depth: 0 }',
    reason: 'the empty-scene default terrain block, replaced by the position\'s own footprint the moment there is a position to have one.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'rOuter * 2 + 4', contains: 'w: rOuter * 2 + 4',
    reason: 'terrain apron: how much untouched ground the model shows AROUND the earthworks. It depicts no built or dug feature, and the 2 doubles a radius.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'p.holeL + 0.1', contains: 'w: p.holeL + 0.1',
    reason: 'z-fighting clearance so the ramp\'s side faces are not coplanar with the terrain cut — a mesh artifact, invisible at any scale a viewer measures.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'p.outerL + 4', contains: 'w: p.outerL + 4',
    reason: 'terrain apron beyond the position, as above: untouched ground, not a dimension of the earthworks.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'runLen + 6', contains: 'd: runLen + 6',
    reason: 'terrain apron along the vehicle ramp, as above: untouched ground, not a dimension of the cut.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'p.outerW + 4', contains: 'd: p.outerW + 4',
    reason: 'terrain apron beyond the position, as above: untouched ground, not a dimension of the earthworks.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'tread + 0.02', contains: 'd: tread + 0.02',
    reason: 'tread overlap so consecutive earth steps do not leave a hairline gap; the tread itself is the access.stairTreadFt leaf.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'Math.max(6, p.outerW)', contains: 'radius: Math.max(6, p.outerW)',
    reason: 'the sector-of-fire fan\'s display radius — an orientation aid on the ground plane, not a range anybody engages to.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: '0.2', contains: "h: 0.2, d: p.holeW + p.parapetW, role: 'engineeredCover'",
    reason: 'the ENGINEERED-ROOF hazard marker\'s slab thickness: a banner over the position, never a roof (§2.7 forbids fabricating one).',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: '0.05', contains: "h: 0.05, d: p.camoNet.W",
    reason: 'a camouflage net is a sheet: its plane needs SOME mesh thickness, while its extent and its height above grade both come from doctrine.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: '0.1', contains: "h: 0.1, d: w, role: 'bayFloor'",
    reason: 'the bay floor slab\'s render thickness. The floor is a surface — the depth of cut is what a viewer measures, and that is published.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'Math.max(0.35, finite(s.parapetH))', contains: 'Math.max(0.35, finite(s.parapetH))',
    reason: 'a LEGIBILITY floor, not a height: the mound is drawn at doctrine\'s parapet height, and this only stops a parapet filled to nothing from rendering as an invisible zero-height sliver.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'Math.min(rHole + s.wallTaper, rOuter - 0.2)', contains: 'Math.min(rHole + s.wallTaper, rOuter - 0.2)',
    reason: 'the batter itself is the published wall taper; the 0.2 only keeps the flared pit mouth from eating its own parapet ring in the mesh, a render clamp with no doctrinal content.',
  },
  {
    file: 'src/render3d/scene3d.ts', expr: 'Math.min(Math.max(0.3, p.parapetW * 0.35), Math.max(0.15, Math.min(p.holeL, p.holeW) * 0.2))', contains: 'const wallT = Math.min(',
    reason: 'the drawn thickness of the excavation WALL band. An excavation face has no thickness in the world — the hole is the hole — so this is a mesh band, bounded so it cannot eat a narrow bay\'s floor.',
  },
];

function stripNonCode(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * Every feet-valued sink expression in a renderer, with the line it sits on.
 *
 * The 2D drawings' own w/h/x/y attributes are PIXELS — the projector is the only thing that
 * turns feet into them — so there the sink is `lenPx(...)`. The 3D descriptor is in feet
 * throughout, so there the sinks are its SIZE fields. Positions (x/y/z/frontZ) are excluded by
 * name: they are compositions of published extents plus annotation offsets, and folding them in
 * would drown the signal in art placement rather than sharpen it.
 */
function feetSinks(file: string): { line: number; expr: string }[] {
  const code = stripNonCode(readFileSync(ROOT + file, 'utf8'));
  const out: { line: number; expr: string }[] = [];
  // ALIAS RESOLUTION. `const rTop = Math.min(rHole + 0.25 * depth, …); … radiusTop: rTop` hides
  // a doctrinal ratio from a sink scan one `const` deep — measured: reintroducing the mortar-pit
  // batter that way was invisible to this test until it resolved bare-identifier sinks. So a
  // sink that is JUST a name is replaced by that name's single definition before scanning.
  // (Composite expressions are left alone: inlining every identifier in them would drag in the
  // whole file and drown the signal.)
  const defs = new Map<string, string>();
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    defs.set(m[1]!, defs.has(m[1]!) ? '' : m[2]!.trim()); // defined twice ⇒ do not resolve
  }
  const resolve = (expr: string): string => {
    const bare = /^[A-Za-z_$][\w$]*$/.exec(expr.trim());
    if (!bare) return expr;
    return defs.get(expr.trim()) || expr;
  };
  const lineOf = (i: number): number => code.slice(0, i).split('\n').length;
  for (const m of code.matchAll(/(?:proj\.)?lenPx\(/g)) {
    let i = m.index! + m[0].length;
    let depth = 1;
    const start = i;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    out.push({ line: lineOf(m.index!), expr: code.slice(start, i - 1).trim() });
  }
  if (!file.includes('render3d')) return out;
  for (const key of SIZE_KEYS) {
    for (const m of code.matchAll(new RegExp('(?<![\\w.$])' + key + ':', 'g'))) {
      let i = m.index! + m[0].length;
      let depth = 0;
      const start = i;
      while (i < code.length) {
        const c = code[i]!;
        if ('([{'.includes(c)) depth++;
        else if (')]}'.includes(c)) {
          if (depth === 0) break;
          depth--;
        } else if (c === ',' && depth === 0) break;
        i++;
      }
      const expr = code.slice(start, i).trim();
      // Type declarations, not values.
      if (/\bnumber\b|;/.test(expr)) continue;
      out.push({ line: lineOf(m.index!), expr: resolve(expr) });
    }
  }
  return out;
}

const RENDERERS = ['src/render/drawSection.ts', 'src/render/drawPlan.ts', 'src/render/drawIso.ts', 'src/render3d/scene3d.ts'];

test('PRONG 2 — no renderer sizes a physical feature from a literal of its own', () => {
  const findings: string[] = [];
  for (const file of RENDERERS) {
    const source = readFileSync(ROOT + file, 'utf8');
    for (const sink of feetSinks(file)) {
      const nums = (sink.expr.match(/(?<![eE\w.])\d+(?:\.\d+)?(?![eE\w])/g) ?? []).filter((n) => !STRUCTURAL.has(n));
      if (nums.length === 0) continue;
      const exempt = EXEMPTIONS.some((e) => e.file === file && normalize(sink.expr) === normalize(e.expr) && source.includes(e.contains));
      if (!exempt) {
        findings.push(file + ':' + sink.line + ' sizes a drawn feature from `' + sink.expr + '` — a length in feet belongs to a doctrine leaf or to GeometryModel, not to a renderer');
      }
    }
  }
  assert.deepEqual(findings, [], findings.join('\n  '));
});

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

test('every exemption still names something real, and the list has not quietly grown', () => {
  // Two ways an exemption table stops meaning anything: an entry that no longer matches any code
  // (it reads as permission for whatever replaced it), and an entry added rather than a constant
  // removed. Both are refused here.
  for (const e of EXEMPTIONS) {
    const source = readFileSync(ROOT + e.file, 'utf8');
    assert.ok(source.includes(e.contains), 'stale exemption: ' + e.file + ' no longer contains `' + e.contains + '`');
    assert.ok(e.reason.length > 60, 'every exemption states WHY that number is not a doctrinal magnitude: ' + e.expr);
  }
  // Per-file floors, recorded from the state this contract landed in. Adding a renderer constant
  // and an exemption for it in the same change fails here rather than passing.
  const floors: Record<string, number> = {
    'src/render/drawSection.ts': 1,
    'src/render/drawPlan.ts': 0,
    'src/render/drawIso.ts': 0,
    'src/render3d/scene3d.ts': 14,
  };
  for (const [file, floor] of Object.entries(floors)) {
    const n = EXEMPTIONS.filter((e) => e.file === file).length;
    assert.ok(n <= floor, file + ' now claims ' + n + ' exemptions, above its recorded floor of ' + floor);
  }
});
