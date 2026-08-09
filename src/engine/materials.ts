// Bill of materials (§9). Pure — turns Calc quantities into stable BomLine[]. Zero lines
// are omitted. Order is sortKey then id (applied here so callers never re-sort). Every line
// carries fromPlaceholder: true when any doctrine value feeding it is a PLACEHOLDER — the
// UI flags those quantities and the CSV records the flag.

import { sandbag, excavation, camo, sump as sumpMat, revetments } from '../doctrine/materials';
import { parapet, berm, overhead } from '../doctrine/protection';
import type { BomLine } from './types';
import type { Calc } from './compute';

const isPh = (...statuses: ('PLACEHOLDER' | 'DOCTRINE')[]): boolean =>
  statuses.some((s) => s === 'PLACEHOLDER');

export function buildBom(calc: Calc): BomLine[] {
  const lines: BomLine[] = [];

  const add = (
    id: string,
    label: string,
    unit: string,
    qtyPerPosition: number,
    sortKey: number,
    fromPlaceholder: boolean,
  ): void => {
    if (!Number.isFinite(qtyPerPosition) || qtyPerPosition <= 0) return; // omit zero lines
    lines.push({
      id,
      label,
      unit,
      qtyPerPosition,
      qtyTotal: qtyPerPosition * calc.count,
      fromPlaceholder,
      sortKey,
    });
  };

  const dimsPh = isPh(calc.position.hole.L.status, calc.position.hole.W.status, calc.position.hole.D.status);

  add(
    'excavation_loose',
    'Spoil to move (loose)',
    'ft³',
    calc.excavLoose,
    10,
    isPh(excavation.swellFactor.status, calc.standard.depthMul.status) || dimsPh,
  );
  add(
    'grenade_sumps',
    'Grenade sumps',
    'ea',
    calc.sumpCount,
    15,
    false, // count is a structural definition, not a placeholder magnitude
  );
  // bagVol (sandbag.L×W×H) feeds every bag-count line below; frontWallHeight feeds ONLY the
  // earth-mode aperture-rest formula, and parapet.W/H feed ONLY the sandbag-mode ring formula —
  // the two modes compute bagsParapet from entirely different doctrine leaves (compute.ts
  // branches on calc.parapetMode), so the placeholder flag must branch the same way instead of
  // checking parapet.W/H unconditionally (wrong for the far more common earth-mode case) while
  // never checking frontWallHeight/L/H (which actually feed it there) at all.
  const bagDimsPh = isPh(sandbag.L.status, sandbag.W.status, sandbag.H.status);
  add(
    'sandbags_parapet',
    'Sandbags — parapet',
    'ea',
    calc.bagsParapet, // 0 for vehicle positions — the berm line below replaces it
    20,
    calc.parapetMode === 'sandbag'
      ? isPh(parapet.W.status, parapet.H.status, sandbag.wasteFactor.status) || bagDimsPh || dimsPh
      : isPh(sandbag.frontWallHeight.status, sandbag.wasteFactor.status) || bagDimsPh || dimsPh,
  );
  add(
    'berm_fill',
    'Spoil berm — dozed fill',
    'ft³',
    calc.bermFill,
    21,
    isPh(berm.W.status, berm.H.status) || dimsPh,
  );
  // coverVol (both lines below) is computed from coverL/coverW (holeL/W + 2×bearingEachEnd) —
  // bearingEachEnd and the hole dims were never checked, so a cover thickness confirmed against
  // doctrine could still report "fully doctrine-backed" while its footprint wasn't.
  const coverFootprintPh = isPh(overhead.bearingEachEnd.status) || dimsPh;
  add(
    'sandbags_cover',
    'Sandbags — overhead cover',
    'ea',
    calc.bagsCover, // only when the doctrine cover material is sandbagged soil
    30,
    isPh(sandbag.wasteFactor.status, calc.standard.coverMul.status) || bagDimsPh || coverFootprintPh || (calc.coverLeaf ? isPh(calc.coverLeaf.status) : true),
  );
  add(
    'cover_soil_fill',
    'Overhead cover — ' + (calc.coverMaterial || 'soil') + ' fill',
    'ft³',
    calc.coverFill, // loose-fill cover priced as what it is, not phantom bags
    31,
    isPh(calc.standard.coverMul.status) || coverFootprintPh || (calc.coverLeaf ? isPh(calc.coverLeaf.status) : true),
  );
  add(
    'sandbags_revet',
    'Sandbags — revetment face',
    'ea',
    calc.bagsRevet, // faceArea × sandbag.W / bagVol — depends on depthOfCut (via faceArea) too
    40,
    isPh(sandbag.wasteFactor.status, calc.standard.depthMul.status) || bagDimsPh || dimsPh,
  );
  // Panel revetments (corrugated / timber-plywood) emit their facing as face AREA — an honest
  // quantity from the model with no fabricated sheet size. Labor is never charged without a
  // material line again.
  if (calc.revet.kind === 'panel') {
    add('revet_panels', calc.revet.label + ' — facing area', 'ft²', calc.faceArea, 45, isPh(calc.standard.depthMul.status) || dimsPh);
  }
  const picketPh = calc.revet.spacing ? isPh(calc.revet.spacing.status) : true;
  add('pickets', revetments['pickets_wire']?.label ?? 'U-pickets', 'ea', calc.pickets, 50, picketPh || dimsPh);
  const wirePh = calc.revet.wirePerPicket ? isPh(calc.revet.wirePerPicket.status) : true;
  add('revet_wire', 'Tie wire', 'ft', calc.wireFt, 51, wirePh || picketPh || dimsPh);
  add(
    'stringers',
    'Overhead stringers' + (calc.stringerSize && calc.stringerSize !== 'engineered' ? ' (' + calc.stringerSize + ')' : ''),
    'ea',
    calc.stringers,
    60,
    // count = ceilInt(max(holeL,holeW) / stringerSpacing) + 1 — the spacing leaf feeds this
    // directly and was never checked, only the hole dims were.
    isPh(overhead.stringerSpacing.status) || dimsPh,
  );
  add('gravel_sump', 'Sump gravel', 'ft³', calc.gravelVol, 70, isPh(sumpMat.gravelFt3.status));
  add(
    'camo_net',
    'Camouflage net',
    'ft²',
    calc.camoArea,
    80,
    // area = outerL×outerW×drapeFactor; outerL/W = holeL/W + 2×parapetW, and parapetW is
    // berm.W for a vehicle position or parapet.W for everyone else (compute.ts) — the frontal-
    // protection thickness leaf was never checked at all, only drapeFactor and the hole dims.
    isPh(camo.drapeFactor.status) || dimsPh || (calc.isVehicle ? isPh(berm.W.status) : isPh(parapet.W.status)),
  );

  lines.sort((a, b) => (a.sortKey - b.sortKey) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return lines;
}
