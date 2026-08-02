// The COMMAND SHEET — the planning app's actual deliverable.
//
// "have a clean sheet for their command to send off or print out and show their CO." Everything
// else in the planning app exists so this page is right: one document that says what is being
// built, out of what, in what order, and what has to be drawn from supply — with the doctrine it
// follows and the places it is still pending a page check printed in the open, not buried.
//
// It is generated from the SAME `StructureModel` the 3D view draws (invariant I-3): the cut
// list, the hardware, the labor and the drawing are four projections of one member array, so a
// sheet can never describe a different building from the one on screen.
//
// Two deliberate refusals:
//   · Nothing here is filled in for the operator. Unit, date, prepared-by and approver are blank
//     lines, because a document that pre-signs itself is a document nobody checked.
//   · Every (PH) citation stays visible. The point of a command sheet is that the person signing
//     it can see which numbers have been page-checked and which have not.

import type { StructureModel } from '../../timber/families/index';
import type { BuildingSpec } from '../../timber/spec';
import { bomSummary, classifyNominal } from '../../timber/bom';
import { fastenerTakeoff, sheetTakeoff } from '../../timber/fasteners';
import { fmtFtIn } from './studio';
import { plainName } from './labels';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SheetInput {
  model: StructureModel;
  title: string;
  lineage: string;
  /** A still of the 3D view, as a data URI, when the canvas could give one. */
  viewImage?: string | null;
}

/** Feet as a plan reads them: 6.7 → 6'-8". */
function ft(v: number): string {
  return fmtFtIn(v * 12);
}

function dimensionRows(spec: BuildingSpec): [string, string][] {
  const rows: [string, string][] = [
    ['Plan size', `${ft(spec.dims.lengthFt)} × ${ft(spec.dims.widthFt)}`],
    ['Floor area', `${Math.round(spec.dims.lengthFt * spec.dims.widthFt)} sq ft`],
    ['Wall height', ft(spec.stories[0]?.wallHeightFt ?? 0)],
    ['Stories', String(spec.stories.length)],
  ];
  const roof = spec.roof;
  if (roof.kind !== 'none') {
    const pitch = 'risePer12' in roof ? `${roof.risePer12} in 12` : `drain ${'drainPer12' in roof ? roof.drainPer12 : 1} in 12`;
    rows.push(['Roof', `${roof.kind} · ${pitch} · ${ft(roof.overhangFt)} eave overhang`]);
  }
  const f = spec.foundation;
  rows.push([
    'Foundation',
    f.kind === 'basement' ? `basement, ${ft(f.depthFt)} deep`
      : f.kind === 'piers' ? `piers and footings, ${ft(f.crawlFt)} crawl`
        : f.kind === 'wall' ? `continuous wall, ${ft(f.crawlFt)} crawl`
          : f.kind,
  ]);
  rows.push([
    'Spacing',
    `studs ${spec.spacing.studSpacingIn}" · joists ${spec.spacing.joistSpacingIn}" · rafters ${spec.spacing.rafterSpacingIn}" o.c.`,
  ]);
  const c = spec.coverings;
  rows.push(['Closing in', `sheathing ${c.wallSheathing} · siding ${c.siding} · deck ${c.roofDeck} · roofing ${c.roofing}`]);
  const openings = Object.entries(spec.stories[0]?.openings ?? {});
  if (openings.length > 0) {
    rows.push([
      'Openings',
      openings.map(([w, list]) => `${w}: ${(list ?? []).length}`).join(' · ') +
        ` (${openings.reduce((a, [, l]) => a + (l ?? []).length, 0)} total)`,
    ]);
  }
  return rows;
}

/**
 * The whole document as one HTML string. Returned rather than written to the DOM so a caller can
 * put it in a print window, a new tab, or a test.
 */
export function commandSheetHtml(input: SheetInput): string {
  const { model, title, lineage, viewImage } = input;
  const spec = model.spec as BuildingSpec;
  const bom = bomSummary(model.members, model.stagePlan);
  const hardware = fastenerTakeoff(model.members);
  const sheets = sheetTakeoff(model.members);

  const lumber = bom.stages
    .flatMap((s) => s.lines)
    .filter((l) => classifyNominal(l.nominal) === 'lumber');
  // One line per stock-and-length, summed across stages: a cut list is ordered by what you cut,
  // not by when you cut it, and a runner going to the lumber pile wants one row per length.
  const byCut = new Map<string, { nominal: string; cutLengthIn: number; count: number; roles: Set<string> }>();
  for (const l of lumber) {
    const key = `${l.nominal}|${l.cutLengthIn}`;
    const row = byCut.get(key) ?? { nominal: l.nominal, cutLengthIn: l.cutLengthIn, count: 0, roles: new Set<string>() };
    row.count += l.count;
    l.roles.forEach((r) => row.roles.add(r));
    byCut.set(key, row);
  }
  const cutRows = [...byCut.values()]
    .sort((a, b) => a.nominal.localeCompare(b.nominal) || b.cutLengthIn - a.cutLengthIn)
    .map((r) => `<tr><td>${esc(r.nominal)}</td><td class="n">${fmtFtIn(r.cutLengthIn)}</td><td class="n">${r.count}</td><td>${esc([...r.roles].map((x) => plainName(x as never)).join(', '))}</td></tr>`)
    .join('');

  const stageRows = bom.stages
    .map((s) => `<tr><td class="n">${s.stage}</td><td>${esc(s.name)}</td><td class="n">${s.memberCount}</td><td class="n">${s.boardFeet.toFixed(0)}</td><td class="n">${s.manHours.toFixed(1)}</td></tr>`)
    .join('');

  const hwRows = hardware.lines
    .map((l) => `<tr><td>${esc(l.spec)}</td><td class="n">${l.count.toLocaleString()}</td><td class="n">${l.poundsApprox ? `${l.poundsApprox} lb` : '—'}</td></tr>`)
    .join('');
  const sheetRows = sheets
    .map((l) => `<tr><td>${esc(l.nominal)}</td><td class="n">${l.count}</td><td class="n">—</td></tr>`)
    .join('');

  // A crew figure is arithmetic on the man-hours, not a second estimate: state the divisor so
  // the reader can redo it with their own crew size.
  const crew = 6;
  const days = model.stagePlan.length > 0 ? bom.totalManHours / crew / 8 : 0;

  const unread = hardware.unparsed.length > 0
    ? `<p class="warn">Hardware not fully counted: ${hardware.unparsed.length} nailing schedule(s) were not
       recognised by the take-off (${hardware.unparsed.map((u) => `${esc(u.schedule)} × ${u.members}`).join('; ')}).
       Add them by hand before ordering.</p>`
    : '';

  const issues = model.issues.length > 0
    ? `<section><h2>Adjusted from what was entered</h2><ul>${model.issues.map((i) => `<li>${esc(i.message)}</li>`).join('')}</ul></section>`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(title)} — construction sheet</title>
<style>
  @page { size: letter portrait; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font: 11px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: -0.01em; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; margin: 16px 0 5px;
       padding-bottom: 3px; border-bottom: 1px solid #111; }
  .lineage { font-size: 10.5px; color: #555; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th, td { text-align: left; padding: 2.5px 6px 2.5px 0; border-bottom: 0.5px solid #ccc; vertical-align: top; }
  th { font-weight: 600; border-bottom: 1px solid #888; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .facts { display: grid; grid-template-columns: 130px 1fr; gap: 1px 10px; font-size: 11px; }
  .facts dt { color: #555; }
  .facts dd { margin: 0; font-weight: 500; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; align-items: start; }
  /* The capture is the whole viewport, and the viewport is mostly empty stage around a small
     building. Left at width:100% it printed as a foot of grey with a shed in the middle and
     pushed the build sequence onto page two. Crop to the centre, where the building is. */
  .shot { display: block; width: 100%; height: 2.9in; object-fit: cover; object-position: center;
          border: 0.5px solid #bbb; border-radius: 3px; margin-top: 6px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 22px 30px; margin-top: 10px; }
  .sign div { border-bottom: 1px solid #111; padding-top: 26px; font-size: 10px; color: #555; }
  .warn { border-left: 3px solid #b00; padding-left: 8px; font-size: 10.5px; }
  footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #111; font-size: 9.5px; color: #444; }
  section { break-inside: avoid; }
  /* A cut list is a runner's document — it starts at the top of a page, not two rows above a
     fold. Screen rendering ignores this; print honours it. */
  section.page { break-before: page; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <p class="lineage">${esc(lineage)}</p>

  <div class="two">
    <section>
      <h2>The structure</h2>
      <dl class="facts">${dimensionRows(spec).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <h2>Effort</h2>
      <dl class="facts">
        <dt>Members</dt><dd>${bom.totalMembers}</dd>
        <dt>Lumber</dt><dd>${bom.totalBoardFeet.toFixed(0)} board feet</dd>
        <dt>Sheet goods</dt><dd>${bom.totalPanels} sheets</dd>
        <dt>Labor</dt><dd>${bom.totalManHours.toFixed(0)} man-hours (PH rates)</dd>
        <dt>Crew estimate</dt><dd>${days.toFixed(1)} days at ${crew} × 8 hr</dd>
      </dl>
    </section>
    <section>
      <h2>As designed</h2>
      ${viewImage ? `<img class="shot" src="${viewImage}" alt="3D view of the structure" />` : '<p>(no view captured)</p>'}
    </section>
  </div>

  ${issues}

  <section>
    <h2>Build sequence</h2>
    <table><thead><tr><th class="n">#</th><th>Stage</th><th class="n">Pieces</th><th class="n">BF</th><th class="n">MH</th></tr></thead>
    <tbody>${stageRows}</tbody></table>
  </section>

  <section class="page">
    <h2>Cut list — lumber</h2>
    <table><thead><tr><th>Stock</th><th class="n">Cut to</th><th class="n">Pieces</th><th>Use</th></tr></thead>
    <tbody>${cutRows}</tbody></table>
  </section>

  <section>
    <h2>Draw from supply — sheet goods and hardware</h2>
    <table><thead><tr><th>Item</th><th class="n">Quantity</th><th class="n">Weight</th></tr></thead>
    <tbody>${sheetRows}${hwRows}</tbody></table>
    <p style="font-size:9.5px;color:#555;margin:4px 0 0">Nail counts are read off each member's nailing
      schedule; sheathing field nails assume supports at ${hardware.fieldSupportSpacingIn} in. Pieces-per-pound
      are common published figures (PH).</p>
    ${unread}
  </section>

  <section>
    <h2>Submitted / approved</h2>
    <div class="sign">
      <div>Unit</div><div>Date</div>
      <div>Prepared by (name, rank)</div><div>Signature</div>
      <div>Approved by (name, rank)</div><div>Signature</div>
    </div>
  </section>

  <footer>
    Generated by the Combat Engineer Toolkit — wood-frame planning. Framing follows FM 5-426 (public
    release); life-safety values cite EM 385-1-1. <strong>Citations marked (PH) are pending a manual page
    check</strong> and every labor rate on this sheet is one of them. Occupied or permanent structures
    follow local building code and qualified review. Every figure above is derived from the same member
    model as the drawing — nothing on this page was entered twice.
  </footer>
</body></html>`;
}

/** Open the sheet in its own window and hand it to the print dialog. */
export function openCommandSheet(input: SheetInput): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(commandSheetHtml(input));
  w.document.close();
  // Let the image decode before the print dialog measures the page.
  w.setTimeout(() => w.print(), 350);
  return true;
}
