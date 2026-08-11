import { compute } from '../src/engine/compute';
import { buildScene3D } from '../src/render3d/scene3d';
import { drawSection } from '../src/render/drawSection';
import { drawPlan } from '../src/render/drawPlan';
import { drawIso } from '../src/render/drawIso';
import { positions } from '../src/doctrine/positions';
import { threats } from '../src/doctrine/protection';
import { soils } from '../src/doctrine/soils';
import { defaultInputs } from '../test/helpers';
import type { GeometryModel } from '../src/engine/geometry';
import type { Result, Inputs } from '../src/engine/types';

function feature(svg: string, key: string): Record<string, number> | undefined {
  const re = new RegExp('<(rect|polygon|circle)([^>]*?)data-feature="' + key + '"([^>]*)>');
  const m = re.exec(svg);
  if (!m) return undefined;
  const attrs = m[2]! + m[3]!;
  const out: Record<string, number> = {};
  for (const a of attrs.matchAll(/([a-z-]+)="([-\d.,\s]+)"/g)) {
    const v = Number(a[2]); if (Number.isFinite(v)) out[a[1]!] = v;
  }
  const pts = /points="([-\d.,\s]+)"/.exec(attrs);
  if (pts) {
    const xs = pts[1]!.trim().split(/\s+/).map((p) => Number(p.split(',')[0]));
    const ys = pts[1]!.trim().split(/\s+/).map((p) => Number(p.split(',')[1]));
    out.minX = Math.min(...xs); out.maxX = Math.max(...xs);
    out.minY = Math.min(...ys); out.maxY = Math.max(...ys);
  }
  return out;
}

// section px->ft, with grade datum
function sectionFrame(svg: string, geo: GeometryModel) {
  const bay = feature(svg, 'bay');
  if (!bay || bay.minX === undefined) return undefined;
  const s = geo.section;
  const pxPerFt = (bay.maxX! - bay.minX) / (s.holeW + 2 * s.wallTaper);
  // grade is where the bay polygon top sits (y = 0 ft)
  const gradeY = bay.minY!;
  return { pxPerFt, centreX: (bay.minX + bay.maxX!) / 2, gradeY };
}

const POSITIONS = Object.keys(positions);
const THREATS = ['none', ...Object.keys(threats)];
const SOILS = Object.keys(soils);
const STANDARDS: Inputs['standard'][] = ['hasty', 'deliberate', 'reinforced'];

type Row = Record<string, number | undefined>;
const rows: { ctx: string; a: Row; b: Row }[] = [];

const problems: string[] = [];
const seen = new Set<string>();
function cmp(ctx: string, field: string, va: number | undefined, vb: number | undefined, na: string, nb: string, tol = 0.02) {
  if (va === undefined || vb === undefined) return;
  seen.add(na + '|' + nb + '|' + field);
  if (Math.abs(va - vb) > tol) problems.push(`${field}: ${na} ${va.toFixed(4)} vs ${nb} ${vb.toFixed(4)}  [${ctx}]`);
}

let n = 0;
for (const positionType of POSITIONS) {
 for (const threat of THREATS) {
  for (const standard of STANDARDS) {
   for (const soil of SOILS) {
    for (const camouflage of [false, true]) {
     const r: Result = compute(defaultInputs({ positionType, threat, standard, soil, camouflage,
       overheadCover: threat !== 'none', sump: true, firingStep: true, revetment: 'none' }));
     const geo = r.geometry as GeometryModel;
     const s = geo.section;
     const ctx = [positionType, threat, standard, soil, camouflage ? 'camo' : 'bare'].join('/');
     const scene = buildScene3D(r);
     const boxes = scene.parts.filter((p: any) => p.kind === 'box') as any[];
     const byRole = (role: string) => boxes.filter((b) => b.role === role);
     n++;

     // ── ROOF ELEVATION (deck bottom above grade) ─────────────────────────
     const covers = byRole('cover');
     if (covers.length && s.roof) {
       const scene3dBottom = covers[0].y - covers[0].h / 2;
       // 2D
       const svg = drawSection(r);
       const fr = sectionFrame(svg, geo);
       const slab = feature(svg, 'overhead');
       if (fr && slab) {
         const twoDbottom = (fr.gradeY - (slab.y! + slab.height!)) / fr.pxPerFt;
         cmp(ctx, 'roofDeckBottomAboveGradeFt', twoDbottom, scene3dBottom, '2D section', '3D');
         cmp(ctx, 'roofDeckBottomVsParapetH', twoDbottom, s.parapetH, '2D section', 'geometry parapetH');
       }
       // stringer elevation
       const beams = byRole('stringer');
       if (beams.length) {
         const beamTop3d = beams[0].y + beams[0].h / 2;
         const beamSvg = feature(svg, 'stringers');
         if (fr && beamSvg) {
           const beamTop2d = (fr.gradeY - beamSvg.y!) / fr.pxPerFt;
           cmp(ctx, 'stringerTopAboveGradeFt', beamTop2d, beamTop3d, '2D section', '3D');
         }
       }
     }

     // ── FIRING STEP ──────────────────────────────────────────────────────
     const fs3d = byRole('firingStep')[0];
     if (fs3d) {
       const svg = drawSection(r);
       const fr = sectionFrame(svg, geo);
       const f2 = feature(svg, 'firing_step');
       if (fr && f2) {
         cmp(ctx, 'firingStepRunFt', f2.width! / fr.pxPerFt, fs3d.d, '2D section', '3D');
         cmp(ctx, 'firingStepHeightFt', f2.height! / fr.pxPerFt, fs3d.h, '2D section', '3D');
       }
       cmp(ctx, 'firingStepHeightFt', s.firingStep.heightFt, fs3d.h, 'geometry(unclamped)', '3D', 1e9);
     }

     // ── PARAPET HEIGHT across views ──────────────────────────────────────
     const frame3d = scene.parts.find((p: any) => p.kind === 'frame') as any;
     const ring3d = scene.parts.find((p: any) => p.kind === 'ring' && p.role === 'earthParapet') as any;
     const h3d = frame3d ? frame3d.height : ring3d ? ring3d.height : undefined;
     if (h3d !== undefined) cmp(ctx, 'parapetHFt', s.parapetH, h3d, 'geometry', '3D');

     // ── SUMP in the PLAN ─────────────────────────────────────────────────
     if (geo.plan.sumps.length) {
       const psvg = drawPlan(r);
       const bay = feature(psvg, 'bay');
       if (bay && bay.width) {
         const pxPerFt = bay.width / geo.plan.holeL;
         const m = /<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([\d.]+)" fill="var\(--draw-timber\)"/.exec(psvg);
         if (m) cmp(ctx, 'sumpLFt(plan diameter)', 2 * Number(m[3]) / pxPerFt, geo.plan.sumpBox.L, '2D plan', 'geometry', 0.02);
       }
     }
    }
   }
  }
 }
}
console.log('cases', n);
console.log('compared fields:', [...seen].sort().join('\n  '));
const uniq = new Map<string, {ex: string; n: number; min: number; max: number}>();
for (const p of problems) {
  const k = p.split('  [')[0].replace(/[-\d.]+/g, '#');
  const nums = p.match(/(-?\d+\.\d{4})/g)!.map(Number);
  const d = Math.abs(nums[0]! - nums[1]!);
  const e = uniq.get(k);
  if (!e) uniq.set(k, { ex: p, n: 1, min: d, max: d });
  else { e.n++; e.min = Math.min(e.min, d); e.max = Math.max(e.max, d); }
}
console.log('\nDISTINCT PROBLEM CLASSES:', uniq.size, ' total problems:', problems.length);
for (const [k, v] of uniq) console.log('  n=' + v.n, 'delta', v.min.toFixed(4) + '..' + v.max.toFixed(4), '|', v.ex);
