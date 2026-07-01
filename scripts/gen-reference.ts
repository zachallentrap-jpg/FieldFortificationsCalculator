// Generates public/SAP-1_drawing_reference.svg — the annotated render acceptance bar (§10).
// Per DECISIONS D2/D12 no reference was supplied, so we author it FROM the renderer itself:
// a canonical position rendered plan-over-section, tokens inlined so it's viewable standalone.
// Because it comes from the same render/ code + callout registry, the reference and the live
// drawings cannot drift.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import { DAY_TOKENS_CSS } from '../src/render/print-tokens';
import type { Inputs } from '../src/engine/types';

const canonical: Inputs = {
  schemaVersion: 1, positionType: 'two_man', standard: 'deliberate', soil: 'loam', threat: 'ind-mtr-81',
  overheadCover: true, revetment: 'sandbag_facing', sump: true, firingStep: false, camouflage: true,
  machineAssist: false, count: 4, teamSize: 2, unit: 'imperial', sectorAzimuths: { leftDeg: -40, rightDeg: 40 },
};

const r = compute(canonical);
const place = (svg: string, y: number): string =>
  svg.replace('viewBox="0 0 760 560"', 'viewBox="0 0 760 560" width="760" height="560" x="0" y="' + y + '"');

const ref =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 1200" role="img" aria-label="SAP-1 annotated drawing reference">' +
  '<style>' + DAY_TOKENS_CSS + '</style>' +
  '<rect x="0" y="0" width="760" height="1200" fill="var(--surface)" />' +
  '<text x="380" y="24" fill="var(--ink)" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="1.5" font-family="ui-monospace, monospace">SAP-1 — ANNOTATED DRAWING REFERENCE (illustrative, NOT FOR FIELD USE)</text>' +
  place(drawPlan(r), 40) +
  place(drawSection(r), 620) +
  '</svg>\n';

const outDir = fileURLToPath(new URL('../public', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + '/SAP-1_drawing_reference.svg', ref);
console.log('wrote public/SAP-1_drawing_reference.svg (' + ref.length + ' bytes)');
