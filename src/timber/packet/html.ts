// COMMAND PACKET — the printed document (TRAINING_AND_PACKETS_PLAN §4.1/§4.5).
//
// A pure string function over `PacketModel`. It computes nothing: every number on the page was
// decided in `model.ts` and is testable there. What lives here is layout, and two rules that
// are layout decisions with real consequences:
//
//   THE HONESTY STRIP REPEATS IN EVERY PAGE FOOTER (R-T2). Packets get photocopied a section
//   at a time. A middle sheet that has lost "PLANNING ESTIMATE — not a build-to field
//   document" is a middle sheet somebody builds from.
//
//   NO SCRIPT, NO EXTERNAL ANYTHING (R-B2). The document has to open from a thumb drive on a
//   machine with no network, three years from now. Inline SVG with a viewBox, inline CSS,
//   captures as data URIs, and nothing that fetches.
//
// R-B3: no clock. Nothing here reads a date. The DATE line is a blank with a note beside it
// saying that whatever the browser stamps in the header is the browser's, not the document's.

import { fmtFtIn } from '../units';
import { PURCHASE_NOTES } from '../purchase';
import { MEMBERS_PER_WORKER_NOTE, timelineSvg } from './labor';
import { honestyStrip, type PacketModel } from './model';
import {
  APPROVAL_SCOPE, CLASS_IV_COLUMNS, DATE_NOTE, DECISION_LINE, EQUIPMENT_NOTE,
  FIDELITY, LS_BANNER, REQUEST_PROMPTS, RISK_PROMPT,
} from './copy';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const blank = (label: string, width = '100%'): string =>
  `<span class="fill" style="min-width:${width}"><i></i><em>${esc(label)}</em></span>`;

const rows = (body: string): string => body || '<tr><td colspan="9" class="none">none in this build</td></tr>';

function coverPage(p: PacketModel): string {
  return `<section class="page cover">
    <div class="strip">${esc(honestyStrip(p))}</div>
    <h1>${esc(p.title)}</h1>
    <p class="sum">${esc(p.summaryLine)}</p>
    <p class="lineage">${esc(p.lineage)}</p>
    ${p.coverArt ? `<div class="art">${p.coverArt}</div>` : ''}
    ${p.isBunker ? `<p class="boundary">${esc(p.coverDepthNote)}</p>` : ''}

    <h2>Routing</h2>
    <div class="grid2">
      ${blank('SUBMITTED TO')}${blank('THROUGH')}
      ${blank('SUSPENSE')}${blank('POINT OF CONTACT + PHONE')}
      ${blank('REQUESTING UNIT')}${blank('DATE')}
      ${blank('PREPARED BY (name, rank)')}${blank('SIGNATURE')}
    </div>
    <p class="fine">${esc(DATE_NOTE)} A prepared-by line is attested, not authenticated — this tool records nothing about who filled it in.</p>

    <h2>Contents</h2>
    <ol class="toc">${p.sections.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  </section>`;
}

function execPage(p: PacketModel): string {
  // Command's first question is "why is it this big", and the answers that answer it are the
  // ones with a number in them. A span TABLE ("table by 2x4 / 2x6 / …") is a pointer, not an
  // answer, so scalars lead and tables fall to the citation register where they belong.
  const why: string[] = [];
  const scalars = p.ls.filter((r) => !r.value.startsWith('table by'));
  for (const r of scalars.slice(0, 3)) why.push(`${r.label} fixed at ${r.value} — ${r.cite}`);
  for (const i of p.issues.slice(0, 3)) why.push(i.message);
  for (const c of p.cites.slice(0, Math.max(0, 6 - why.length))) why.push(`${c.cite} (${c.members} members)`);

  const rollup = p.rollup
    .map((r) => `<tr><td>${esc(r.klass)}</td><td class="n">${r.pieces.toLocaleString()}</td><td class="n">${r.quantity.toLocaleString()}</td><td>${esc(r.unit)}</td></tr>`)
    .join('');

  // The RANGE, not one scenario. An exec block that quotes the smallest crew reads as
  // "26 shifts" to somebody scanning, and the fastest crew the model will stand behind is the
  // number a planner is actually choosing between.
  const usable = p.labor.crewRows.filter((r) => !r.suppressed);
  const slow = usable[0];
  const fast = usable[usable.length - 1];
  const shiftWord = (n: number) => `${n} shift${n === 1 ? '' : 's'}`;
  const laborLine = !slow ? ''
    : slow === fast ? ` — ${slow.crew} Marines, ${shiftWord(slow.shifts)}`
      : ` — ${fast!.crew} Marines in ${shiftWord(fast!.shifts)}, or ${slow.crew} in ${shiftWord(slow.shifts)}`;

  return `<section class="page">
    <h2>Executive summary</h2>

    <h3>1 · What</h3>
    <p>${esc(p.title)} — ${esc(p.summaryLine)}.</p>

    <h3>2 · Why it is sized as stated</h3>
    <ul>${why.slice(0, 6).map((w) => `<li>${esc(w)}</li>`).join('') || '<li>No clamps or life-safety locks applied to this configuration.</li>'}</ul>

    <h3>3 · Labor</h3>
    <p><strong>${p.labor.totalManHours.toFixed(0)} man-hours</strong>${laborLine}, at ${p.labor.productiveHoursPerDay} productive hours per shift.
       Governing rates: ${p.rates.map((r) => `${esc(r.label)} ${esc(r.value)} ${esc(r.note)}`).join(' · ')}.</p>

    <h3>4 · Materials rollup</h3>
    <table><thead><tr><th>Class</th><th class="n">Pieces</th><th class="n">Quantity</th><th>Unit</th></tr></thead>
    <tbody>${rows(rollup)}</tbody></table>

    <h3>5 · Request</h3>
    <div class="grid1">${REQUEST_PROMPTS.map((t) => blank(t)).join('')}</div>

    <h3>6 · Risk / impact if not approved</h3>
    <p class="fine">${esc(RISK_PROMPT)}</p>
    <div class="grid1">${blank('1')}${blank('2')}${blank('3')}</div>

    <h3>7 · Decision</h3>
    <p class="decision">${esc(DECISION_LINE)}</p>
  </section>`;
}

function materialsPage(p: PacketModel): string {
  const cuts = p.cuts
    .filter((l) => l.klass === 'lumber')
    .map((l) => `<tr><td>${esc(l.nominal)}</td><td class="n">${fmtFtIn(l.cutLengthIn)}</td><td class="n">${l.count}</td><td class="n">${l.boardFeet.toFixed(0)}</td><td>${esc(l.grade)}</td><td>${esc(l.treatment ?? '')}</td><td>${esc(l.roles.map(p.plain).join(', '))}</td></tr>`)
    .join('');

  const stock = p.purchase.stock
    .map((r) => `<tr><td>${esc(r.nominal)}</td><td>${esc(r.grade)}</td><td class="n">${r.stockLengthFt} ft</td><td class="n">${r.pieces}</td><td class="n">${r.wasteLF} LF</td>${CLASS_IV_COLUMNS.map(() => '<td class="fillcell"></td>').join('')}</tr>`)
    .join('');

  const long = p.purchase.longRuns
    .map((r) => `<tr><td>${esc(r.nominal)}</td><td class="n">${fmtFtIn(r.lengthIn)}</td><td class="n">${r.count}</td><td class="n">${r.linealFt} LF</td><td>${esc(r.roles.map(p.plain).join(', '))}</td></tr>`)
    .join('');

  const sheets = p.purchase.sheets
    .map((s) => `<tr><td>${esc(s.nominal)}</td><td class="n">${s.pieces}</td><td class="n">${s.areaSqFt.toFixed(0)} sf</td><td class="n">${s.quantity}</td><td>${esc(s.unit)}</td>${CLASS_IV_COLUMNS.map(() => '<td class="fillcell"></td>').join('')}</tr>`)
    .join('');

  const conc = p.purchase.concrete
    .map((c) => `<tr><td>${esc(c.nominal)}</td><td class="n">${c.linealFt} LF</td><td class="n">${c.cubicYards} CY</td>${CLASS_IV_COLUMNS.map(() => '<td class="fillcell"></td>').join('')}</tr>`)
    .join('');

  const nails = p.fasteners.lines
    .map((l) => `<tr><td>${esc(l.spec)}</td><td class="n">${l.count.toLocaleString()}</td><td class="n">${l.poundsApprox ? `${l.poundsApprox} lb` : '—'}</td>${CLASS_IV_COLUMNS.map(() => '<td class="fillcell"></td>').join('')}</tr>`)
    .join('');

  const unread = p.fasteners.unparsed.length > 0
    ? `<p class="warn">${p.fasteners.unparsed.length} nailing schedule(s) were not recognised by the take-off
       (${p.fasteners.unparsed.map((u) => `${esc(u.schedule)} × ${u.members}`).join('; ')}). Count them by hand before ordering.</p>`
    : '';

  const unpriced = p.purchase.unpriced.length > 0
    ? `<p class="warn">No section on file for ${p.purchase.unpriced.map(esc).join(', ')} — the volume column is left at zero rather than estimated. Price it by hand.</p>`
    : '';

  return `<section class="page">
    <h2>Materials</h2>
    ${p.isBunker ? `<p class="boundary">${esc(p.coverDepthNote)}</p>` : ''}
    <p class="fine">Columns marked ON HAND / REQUISITION / LEAD TIME are for the requesting unit to fill.</p>

    <h3>Order — lumber by stock length</h3>
    <table><thead><tr><th>Stock</th><th>Grade</th><th class="n">Length</th><th class="n">Pieces</th><th class="n">Waste</th>${CLASS_IV_COLUMNS.map((c) => `<th class="fillcol">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows(stock)}</tbody></table>
    <p class="fine">${esc(PURCHASE_NOTES.stockFit)} ${esc(PURCHASE_NOTES.waste)}</p>

    ${long ? `<h3>Runs longer than stock</h3>
    <table><thead><tr><th>Stock</th><th class="n">Run</th><th class="n">Count</th><th class="n">Lineal ft</th><th>Use</th></tr></thead>
    <tbody>${long}</tbody></table>
    <p class="fine">${esc(PURCHASE_NOTES.longRuns)}</p>` : ''}

    <h3>Order — sheet goods</h3>
    <table><thead><tr><th>Item</th><th class="n">Pieces cut</th><th class="n">Area</th><th class="n">Buy</th><th>Unit</th>${CLASS_IV_COLUMNS.map((c) => `<th class="fillcol">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows(sheets)}</tbody></table>
    <p class="fine">${esc(PURCHASE_NOTES.sheets)} ${esc(PURCHASE_NOTES.squares)}</p>

    ${conc ? `<h3>Order — concrete</h3>
    <table><thead><tr><th>Item</th><th class="n">Run</th><th class="n">Volume</th>${CLASS_IV_COLUMNS.map((c) => `<th class="fillcol">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${conc}</tbody></table>` : ''}
    ${unpriced}

    <h3>Order — nails and hardware</h3>
    <table><thead><tr><th>Item</th><th class="n">Count</th><th class="n">Weight</th>${CLASS_IV_COLUMNS.map((c) => `<th class="fillcol">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows(nails)}</tbody></table>
    <p class="fine">Nail counts are read off each member's nailing schedule; sheathing field nails assume supports at ${p.fasteners.fieldSupportSpacingIn} in. Pieces-per-pound are common published figures (PH).</p>
    ${unread}

    <h3>Equipment and prerequisites</h3>
    <ul class="tools">${p.tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <div class="grid1">${blank('POWER / GENERATOR')}${blank('TRANSPORT + DELIVERY POINT')}${blank('SITE PREPARATION')}</div>
    <p class="fine">${esc(EQUIPMENT_NOTE)}</p>
  </section>

  <section class="page">
    <h2>Cut list — lumber</h2>
    <p class="fine">One row per stock, length and grade. This is the runner's document; the order table above is supply's.</p>
    <table><thead><tr><th>Stock</th><th class="n">Cut to</th><th class="n">Pieces</th><th class="n">BF</th><th>Grade</th><th>Treatment</th><th>Use</th></tr></thead>
    <tbody>${rows(cuts)}</tbody></table>
  </section>`;
}

function laborPage(p: PacketModel): string {
  const stages = p.labor.stages
    .map((s) => `<tr><td class="n">${s.ordinal}</td><td>${esc(s.name)}</td><td class="n">${s.members}</td><td class="n">${s.manHours.toFixed(1)}</td><td class="n">${s.maxUsefulCrew}</td></tr>`)
    .join('');
  const crew = p.labor.crewRows
    .map((r) => r.suppressed
      ? `<tr class="off"><td class="n">${r.crew}</td><td colspan="2">${esc(r.suppressed)}</td></tr>`
      : `<tr><td class="n">${r.crew}</td><td class="n">${r.crewHours.toFixed(0)} crew-hours</td><td class="n">${r.shifts} shift${r.shifts === 1 ? '' : 's'}</td></tr>`)
    .join('');

  return `<section class="page">
    <h2>Labor and schedule</h2>
    <p class="rate">Governing rates: ${p.rates.map((r) => `<strong>${esc(r.label)}</strong> ${esc(r.value)} <span class="ph">${esc(r.note)}</span>`).join(' · ')}</p>

    <h3>By stage</h3>
    <table><thead><tr><th class="n">#</th><th>Stage</th><th class="n">Pieces</th><th class="n">MH</th><th class="n">Max useful crew</th></tr></thead>
    <tbody>${rows(stages)}</tbody></table>
    <p class="fine">${esc(MEMBERS_PER_WORKER_NOTE)}</p>

    <h3>Crew scenarios — days, ${esc(p.labor.crewModel)} scaling</h3>
    <table><thead><tr><th class="n">Crew</th><th class="n">Effort</th><th class="n">Whole shifts</th></tr></thead>
    <tbody>${rows(crew)}</tbody></table>
    <p class="fine">A shift is ${p.labor.productiveHoursPerDay} PRODUCTIVE hours — it excludes security, details, travel and tool contention. Shifts round up; a part shift is a shift. ${esc(FIDELITY.labor)}</p>

    <h3>Priorities of work</h3>
    ${timelineSvg(p.labor)}
    <p class="fine">Bars are man-hours per stage. Stages run in order; no overlap is modeled.</p>
  </section>`;
}

function assumptionsPage(p: PacketModel): string {
  const cites = p.cites
    .map((c) => `<tr><td>${esc(c.cite)}</td><td class="n">${c.members}</td><td>${c.ph ? 'PENDING PAGE CHECK' : 'verified'}</td></tr>`)
    .join('');
  const ls = p.ls
    .map((r) => `<tr><td>${esc(r.label)}<span class="key">${esc(r.key)}</span></td><td class="n">${esc(r.value)}</td><td>${esc(r.cite)}</td><td>${r.ph ? 'REVIEW REQUIRED' : 'verified'}</td></tr>`)
    .join('');
  const issues = p.issues
    .map((i) => `<li><strong>${esc(i.path)}</strong> — ${esc(i.message)}</li>`)
    .join('');

  return `<section class="page">
    <h2>Assumptions and citations</h2>

    ${p.ls.length > 0 ? `<h3>Life-safety values in this build</h3>
    <p class="warn">${esc(LS_BANNER)}</p>
    <table><thead><tr><th>Value</th><th class="n">As used</th><th>Citation</th><th>Status</th></tr></thead>
    <tbody>${ls}</tbody></table>` : '<h3>Life-safety values</h3><p class="fine">This build consumes none — no guardrail, ladder or stair geometry is in the model.</p>'}

    <h3>Citation register</h3>
    <table><thead><tr><th>Citation</th><th class="n">Members</th><th>Status</th></tr></thead>
    <tbody>${rows(cites)}</tbody></table>
    <p class="fine">${p.counts.phCites} of ${p.counts.cites} citations are pending a manual page check, carrying ${p.counts.members} members between them.</p>

    <h3>What this packet estimates rather than knows</h3>
    <ul>${Object.values(FIDELITY).map((f) => `<li>${esc(f)}</li>`).join('')}
    <li>${p.siteSoil
      ? `SITE: soil recorded by the operator as ${esc(p.siteSoil.toUpperCase())}. Recorded only — member and footer sizing does not read it; FM 5-426 sizes post footers per soil and those tables are pending a page check (PH).`
      : 'SITE: soil not recorded. FM 5-426 sizes post footers per soil; the reviewing engineer has nothing from this tool to check that against.'}</li></ul>
    ${p.isBunker ? `<p class="boundary">${esc(p.coverDepthNote)}</p>` : ''}

    ${issues ? `<h3>Adjusted from what was entered</h3><ul>${issues}</ul>` : ''}

    <h3>Unit review</h3>
    <p class="fine">${esc(APPROVAL_SCOPE)}</p>
    <div class="grid2">
      ${blank('REVIEWED BY (name, rank)')}${blank('SIGNATURE')}
      ${blank('APPROVED BY (name, rank)')}${blank('SIGNATURE')}
    </div>
  </section>`;
}

export function packetHtml(p: PacketModel): string {
  const strip = esc(honestyStrip(p));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(p.title)} — command packet ${esc(p.specHash)}</title>
<style>
  /* Letter and A4 both. A4 is the narrower of the two at 8.268 in, so the content box is sized
     to it: at 0.6 in side margins that leaves 7.068 in, and every block is capped below that.
     A box sized to Letter overflows A4 by a hair and Chrome silently clips the right edge. */
  @page { size: letter portrait; margin: 0.6in; }
  * { box-sizing: border-box; }
  /* TYPE FLOOR 9 pt (12 px at 96 dpi), footnotes 8 pt. This document is photocopied in grey,
     duplexed, and read in bad light; 8 pt body was chosen to fit more on a page and would have
     cost legibility in exactly the conditions it has to survive. Pages are cheap. */
  body { font: 12px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 22px; margin: 0 0 3px; letter-spacing: -0.015em; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; margin: 16px 0 6px;
       padding-bottom: 3px; border-bottom: 1.2px solid #111;
       break-after: avoid; page-break-after: avoid; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #333; margin: 13px 0 4px;
       break-after: avoid; page-break-after: avoid; }
  p { margin: 4px 0; }
  ul, ol { margin: 4px 0; padding-left: 18px; }
  li { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 4px; }
  th, td { text-align: left; padding: 2.6px 6px 2.6px 0; border-bottom: 0.5px solid #999; vertical-align: top; }
  th { font-weight: 650; border-bottom: 1px solid #444; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.off td { color: #555; font-style: italic; }
  td.none { color: #555; font-style: italic; text-align: center; padding: 6px 0; }
  /* Operator-fill columns print as a ruled cell, never as an omitted column: a Class IV list
     with no on-hand column and no lead time is not actionable. */
  th.fillcol { color: #444; font-weight: 500; font-size: 10.7px; }
  td.fillcell { border-bottom: 0.5px solid #999; min-width: 46px; }
  .sum { font-size: 13px; font-weight: 550; margin: 0 0 2px; }
  .lineage { font-size: 11px; color: #444; margin: 0 0 8px; }
  .fine { font-size: 10.7px; color: #333; line-height: 1.42; }
  /* Border, not a background fill: print drops backgrounds unless the operator ticks
     "Background graphics", and a rate block that vanishes takes the provenance with it. */
  .rate { font-size: 11px; padding: 5px 8px; border: 1px solid #111; border-left-width: 3px; }
  .ph { color: #6b3200; }
  .decision { font-size: 11.5px; border: 1px solid #111; padding: 7px 9px; }
  .warn { border-left: 3px solid #8a1a12; padding-left: 9px; font-size: 11px; }
  .boundary { border-left: 3px solid #111; padding-left: 9px; font-size: 11px; font-weight: 550; }
  .strip { font-size: 10.7px; letter-spacing: 0.02em; border: 1px solid #111; padding: 5px 8px; margin-bottom: 12px; }
  .art { margin: 8px 0; text-align: center; }
  .art svg { width: 100%; max-width: 4.6in; height: auto; }
  .shot { display: block; width: 100%; max-width: 7in; height: 3in; object-fit: cover; object-position: center;
          border: 0.5px solid #777; margin-top: 6px; }
  .grid1 { display: grid; gap: 14px 0; margin: 8px 0 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 26px; margin: 8px 0 4px; }
  .fill { display: block; }
  .fill i { display: block; border-bottom: 1px solid #111; height: 16px; }
  .fill em { font-style: normal; font-size: 10.7px; letter-spacing: 0.05em; color: #444; text-transform: uppercase; }
  .toc { font-size: 12px; }
  .tools { font-size: 11px; columns: 2; }
  .key { display: block; font-size: 10.7px; color: #555; font-family: ui-monospace, Menlo, monospace; }

  /* FD81 — no blank first page. \`break-before\` on EVERY section (or a break-after on the
     cover plus a break-before on what follows) makes engines emit a leading blank sheet, and
     an S-4 handed a packet whose page 1 is blank distrusts the rest of it. Only a section that
     FOLLOWS another one breaks. Legacy \`page-break-*\` alongside the modern spelling because
     WebKit honours the old names far more reliably (FD76). */
  section + section.page { break-before: page; page-break-before: always; }
  /* Deliberately NOT \`break-inside: avoid\` on sections: a materials table longer than a page
     inside an unbreakable box does not overflow onto the next sheet, it CLIPS, and the cut
     lines that fall off the bottom leave no symptom on screen. Headings hold to their first
     rows instead (break-after: avoid above), which is the part that actually reads badly. */
  thead { display: table-header-group; }

  /* R-T2 — THE STRIP REPEATS ON EVERY PRINTED SHEET, IN BOTH ENGINES.
     Two earlier attempts failed differently and neither failure is visible on screen:
       a CSS margin box in @page — Chrome does not implement margin boxes at all, so
         it rendered nowhere at all.
       \`position: fixed\` — repeats per page in Chrome, prints ONCE in Firefox, so a six-page
         packet would ship with page 1 stamped and five bare.
     A \`<tfoot>\` on a document-wrapping table repeats per page fragment in BOTH engines. That
     is why the whole body is inside one table; it is not layout, it is the warning.
     Packets get photocopied a section at a time, and a middle sheet that has lost "PLANNING
     ESTIMATE — not a build-to field document" is a middle sheet somebody builds from. */
  table.pagewrap { border-collapse: collapse; width: 100%; font-size: inherit; margin: 0; }
  table.pagewrap > tbody > tr > td, table.pagewrap > tfoot > tr > td {
    padding: 0; border: 0; vertical-align: top;
  }
  .runfoot { font-size: 10.7px; color: #222; border-top: 1px solid #111; padding-top: 3px; margin-top: 10px; }
</style></head>
<body>
<table class="pagewrap">
  <tfoot><tr><td><div class="runfoot">${strip}</div></td></tr></tfoot>
  <tbody><tr><td>
${coverPage(p)}
${execPage(p)}
${materialsPage(p)}
${laborPage(p)}
${assumptionsPage(p)}
${p.viewImage ? `<section class="page"><h2>Annex A — as designed</h2><img class="shot" src="${p.viewImage}" alt="View of the structure as configured" /></section>` : ''}
  </td></tr></tbody>
</table>
</body></html>`;
}
