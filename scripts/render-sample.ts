// Dev-only preview harness (not shipped): renders sample plan/section SVGs and a self-
// contained HTML preview (tokens.css inlined) so the drawing visual system can be eyeballed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compute } from '../src/engine/compute';
import { drawPlan } from '../src/render/drawPlan';
import { drawSection } from '../src/render/drawSection';
import type { Inputs } from '../src/engine/types';

const base: Inputs = {
  schemaVersion: 1, positionType: 'two_man', standard: 'deliberate', soil: 'loam', threat: 'ind-mtr-81',
  overheadCover: true, revetment: 'sandbag_facing', sump: true, firingStep: false, camouflage: true,
  machineAssist: false, count: 4, teamSize: 2, unit: 'imperial', sectorAzimuths: { leftDeg: -40, rightDeg: 40 },
};

const mg = compute({ ...base, positionType: 'mg_crew', firingStep: true });
const twoMan = compute(base);
const bunker = compute({ ...base, positionType: 'bunker_op_cp', threat: 'at-he-contact' });

const cards: [string, string][] = [
  ['Plan — MG crew (platform + sectors)', drawPlan(mg)],
  ['Section — two-man (earth roof + sump)', drawSection(twoMan)],
  ['Section — bunker vs contact-burst (ENGINEERED, honest)', drawSection(bunker)],
];

const outDir = process.argv[2] ?? '.';
const tokens = readFileSync(fileURLToPath(new URL('../src/ui/tokens.css', import.meta.url)), 'utf8');

writeFileSync(outDir + '/plan.svg', drawPlan(mg));
writeFileSync(outDir + '/section.svg', drawSection(twoMan));

const cardHtml = cards
  .map(([t, svg]) => '<figure class="card"><figcaption>' + t + '</figcaption>' + svg + '</figure>')
  .join('');
const html =
  '<style>' + tokens +
  'body{background:var(--bg);margin:0;padding:18px;font-family:system-ui,sans-serif;color:var(--ink)}' +
  '.wrap{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}' +
  '.card{margin:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.12)}' +
  'figcaption{padding:8px 12px;font-size:12px;font-weight:600;color:var(--ink-soft);border-bottom:1px solid var(--border)}' +
  '.card svg{display:block;width:500px;height:auto}' +
  '</style><div class="wrap">' + cardHtml + '</div>';
writeFileSync(outDir + '/preview.html', html);
console.log('wrote plan.svg, section.svg, preview.html to ' + outDir);
