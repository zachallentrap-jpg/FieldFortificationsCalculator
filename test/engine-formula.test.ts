import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positions } from '../src/doctrine/positions';
import { standards } from '../src/doctrine/standards';
import { sandbag, excavation, sump as sumpMat } from '../src/doctrine/materials';
import { parapet, overhead, shielding, coverMaterialDefault } from '../src/doctrine/protection';
import { labor } from '../src/doctrine/labor';
import { compute } from '../src/engine/compute';
import { defaultInputs } from './helpers';
import type { BomLine } from '../src/engine/types';

// Independent re-derivation of the §9 chain (inline rounding, no engine internals) to prove
// compute() wires the formula together correctly — not a tautology against its own helpers.
const ceil = (x: number): number => Math.max(0, Math.ceil(x - 1e-9));
const r1 = (x: number): number => Math.round(x * 10) / 10;
const approx = (a: number, b: number, eps = 1e-9): void => assert.ok(Math.abs(a - b) < eps, a + ' ≈ ' + b);
const qty = (bom: BomLine[], id: string): number => bom.find((l) => l.id === id)?.qtyPerPosition ?? 0;

test('§9 chain: two-man / deliberate / loam / fragmentation matches an independent derivation', () => {
  const pos = positions['two_man']!;
  const std = standards['deliberate']!;

  const holeL = pos.hole.L.value;
  const holeW = pos.hole.W.value;
  const holeD = pos.hole.D.value;
  const depthOfCut = holeD * std.depthMul.value;
  const setback = Math.max(overhead.setbackMin.value, overhead.setbackDepthFrac.value * depthOfCut);

  const coverMat = coverMaterialDefault['fragmentation']!;
  const coverT = shielding['fragmentation']![coverMat].value * std.coverMul.value;

  const parapetW = parapet.W.value;
  const parapetH = parapet.H.value;
  const outerL = holeL + 2 * parapetW;
  const outerW = holeW + 2 * parapetW;
  const parapetRing = (outerL * outerW - holeL * holeW) * parapetH;

  const holeVol = holeL * holeW * depthOfCut;
  const sumpCount = pos.grenadeSumps; // sump toggle on
  const sumpVol = sumpCount * (sumpMat.L.value * sumpMat.W.value * sumpMat.D.value);
  const gravel = sumpCount * sumpMat.gravelFt3.value;
  const excavBank = holeVol + 0 + sumpVol;
  const excavLoose = excavBank * excavation.swellFactor.value;

  const bearing = overhead.bearingEachEnd.value;
  const coverL = holeL + 2 * bearing;
  const coverW = holeW + 2 * bearing;
  const coverVol = coverL * coverW * coverT;
  const stringers = ceil(holeW / overhead.stringerSpacing.value) + 1;

  const bagVol = sandbag.L.value * sandbag.W.value * sandbag.H.value;
  const waste = sandbag.wasteFactor.value;
  const bagsParapet = ceil((parapetRing / bagVol) * waste);
  const bagsCover = ceil((coverVol / bagVol) * waste);

  const mh =
    labor.baseMH.value * 1.0 /* loam dig */ * std.laborMul.value +
    excavBank * labor.perVolMH.value * 1 /* no machine */ +
    labor.overheadAdd.value /* earth roof */ +
    0 /* revet none */ +
    labor.sumpAdd.value /* sump on */ +
    0; /* camo off */
  const mhPerPos = r1(mh);
  const elapsed = r1(r1(mhPerPos * 1) / 2);

  const res = compute(defaultInputs());

  assert.equal(res.resolved.holeL, holeL);
  assert.equal(res.resolved.holeW, holeW);
  approx(res.resolved.setback, setback);
  approx(res.resolved.outerL, outerL);
  approx(res.cover.thickness, coverT);
  assert.equal(res.cover.roofPath, 'earth_on_stringers');
  assert.equal(res.cover.material, coverMat);

  approx(qty(res.bom, 'excavation_loose'), excavLoose);
  assert.equal(qty(res.bom, 'grenade_sumps'), sumpCount);
  approx(qty(res.bom, 'gravel_sump'), gravel);
  assert.equal(qty(res.bom, 'sandbags_parapet'), bagsParapet);
  assert.equal(qty(res.bom, 'sandbags_cover'), bagsCover);
  assert.equal(qty(res.bom, 'stringers'), stringers);

  approx(res.labor.manHoursPerPosition, mhPerPos);
  approx(res.labor.elapsedHours, elapsed);
});

test('BOM omits zero lines and is ordered by sortKey', () => {
  // No overhead, no sump, no revet, no camo ⇒ those lines vanish.
  const res = compute(defaultInputs({ overheadCover: false, sump: false, revetment: 'none', camouflage: false }));
  const ids = res.bom.map((l) => l.id);
  assert.ok(!ids.includes('sandbags_cover'));
  assert.ok(!ids.includes('stringers'));
  assert.ok(!ids.includes('gravel_sump'));
  assert.ok(!ids.includes('camo_net'));
  const keys = res.bom.map((l) => l.sortKey);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i]! >= keys[i - 1]!, 'sorted by sortKey');
});

test('count scales qtyTotal and man-hours', () => {
  const one = compute(defaultInputs({ count: 1 }));
  const ten = compute(defaultInputs({ count: 10 }));
  const parapetOne = one.bom.find((l) => l.id === 'sandbags_parapet')!;
  const parapetTen = ten.bom.find((l) => l.id === 'sandbags_parapet')!;
  assert.equal(parapetTen.qtyTotal, parapetOne.qtyPerPosition * 10);
  approx(ten.labor.manHoursTotal, Math.round(one.labor.manHoursPerPosition * 10 * 10) / 10);
});
