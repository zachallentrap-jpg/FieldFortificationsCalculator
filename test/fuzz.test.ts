// §17 fuzz — thousands of random VALID inputs: compute never throws or yields NaN, renders
// stay finite, and the engine NEVER fabricates an engineered-roof thickness (§2.7). Uses a
// seeded PRNG (no Math.random — determinism), so a failure is reproducible.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import { drawIso } from '../src/render/drawIso';
import { positions } from '../src/doctrine/positions';
import { soils } from '../src/doctrine/soils';
import { standards } from '../src/doctrine/standards';
import { revetments } from '../src/doctrine/materials';
import { threats, roofPathFor } from '../src/doctrine/protection';
import type { Inputs } from '../src/engine/types';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAD = /NaN|Infinity|undefined/;
// Derived from the catalog — every munition whose roof is engineered must never get a thickness.
const ENGINEERED = new Set(Object.keys(threats).filter((id) => roofPathFor(id) === 'engineered_required'));

const posKeys = Object.keys(positions);
const soilKeys = Object.keys(soils);
const stdKeys = Object.keys(standards) as Inputs['standard'][];
const revKeys = Object.keys(revetments);
const threatKeys = ['none', ...Object.keys(threats)];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

test('fuzz: 3000 random valid inputs never throw, never NaN, never fabricate engineered thickness', () => {
  const rng = mulberry32(0x5a11);
  const N = 3000;
  for (let i = 0; i < N; i++) {
    const inputs: Inputs = {
      schemaVersion: 1,
      positionType: pick(rng, posKeys),
      standard: pick(rng, stdKeys),
      soil: pick(rng, soilKeys),
      threat: pick(rng, threatKeys),
      overheadCover: rng() < 0.6,
      revetment: pick(rng, revKeys),
      sump: rng() < 0.5,
      firingStep: rng() < 0.5,
      camouflage: rng() < 0.4,
      machineAssist: rng() < 0.3,
      count: 1 + Math.floor(rng() * 50),
      teamSize: 1 + Math.floor(rng() * 12),
      unit: rng() < 0.5 ? 'imperial' : 'metric',
      sectorAzimuths: { leftDeg: -Math.floor(rng() * 90), rightDeg: Math.floor(rng() * 90) },
    };

    const r = compute(inputs);

    // Safety honesty (§2.7): engineered threats with cover on never yield a thickness.
    if (inputs.overheadCover && ENGINEERED.has(inputs.threat)) {
      assert.equal(r.cover.roofPath, 'engineered_required', 'i=' + i + ' ' + inputs.threat);
      assert.equal(r.cover.thickness, 0, 'fabricated engineered thickness at i=' + i);
    }

    // BOM quantities finite and non-negative.
    for (const l of r.bom) {
      assert.ok(Number.isFinite(l.qtyPerPosition) && l.qtyPerPosition > 0, 'bad bom qty i=' + i);
      assert.ok(Number.isFinite(l.qtyTotal) && l.qtyTotal > 0, 'bad bom total i=' + i);
    }
    assert.ok(Number.isFinite(r.labor.manHoursTotal) && r.labor.manHoursTotal >= 0);

    // Renders stay finite.
    for (const svg of [drawPlan(r), drawSection(r), drawIso(r)]) {
      assert.ok(!BAD.test(svg), 'bad token in render at i=' + i);
    }
  }
});

test('fuzz sample is deterministic (same input → deep-equal result)', () => {
  const rng = mulberry32(0x1234);
  for (let i = 0; i < 50; i++) {
    const inputs: Inputs = {
      schemaVersion: 1,
      positionType: pick(rng, posKeys), standard: pick(rng, stdKeys), soil: pick(rng, soilKeys),
      threat: pick(rng, threatKeys), overheadCover: rng() < 0.6, revetment: pick(rng, revKeys),
      sump: rng() < 0.5, firingStep: rng() < 0.5, camouflage: rng() < 0.4, machineAssist: rng() < 0.3,
      count: 1 + Math.floor(rng() * 50), teamSize: 1 + Math.floor(rng() * 12), unit: 'imperial',
    };
    assert.deepEqual(compute(inputs), compute(inputs));
  }
});
