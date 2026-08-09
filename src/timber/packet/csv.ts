// COMMAND PACKET — the supply-shop export (§4.5, R-T4, R-B1).
//
// A materials page is a thing to read; a CSV is a thing to ACT on. The supply section pastes
// it into whatever their requisition tool is, and the alternative is retyping ninety rows of
// stock and lengths by hand at two in the morning, which is where transcription errors come
// from.
//
// Three rules make it safe to hand over:
//
//   EVERY QUANTITY CARRIES ITS UNIT OF ISSUE. A column of bare numbers is not a requisition —
//   "37" could be pieces, board-feet or sheets, and each is a different pile of wood.
//
//   THE WARNINGS TRAVEL WITH IT. A CSV is exactly the artifact that gets separated from its
//   packet, so the honesty strip and the estimate's limits are rows in the file, at the top,
//   before anything that looks like a quantity. A spreadsheet with no provenance is a
//   spreadsheet that becomes fact.
//
//   NO COVER-DEPTH FIELD, EVER (R-T4). The bunker's cover depth is a survivability decision
//   the operator stated and this tool consumed; putting it in a machine-readable column is how
//   it gets read back as something this tool computed. The boundary sentence appears in the
//   warning block as prose and nowhere else.

import { fmtFtIn } from '../units';
import { PURCHASE_NOTES } from '../purchase';
import { FIDELITY } from './copy';
import { honestyStrip, type PacketModel } from './model';

/**
 * RFC 4180 quoting. Every field goes through it, unconditionally — a nominal like
 * `4x8 panel 1/2"` carries a quote character, and a role list carries commas.
 */
function q(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (...cells: (string | number)[]): string => cells.map(q).join(',');

export function packetCsv(p: PacketModel): string {
  const out: string[] = [];
  const section = (name: string, ...header: string[]): void => {
    out.push('');
    out.push(row(`# ${name}`));
    if (header.length > 0) out.push(row(...header));
  };

  // META and WARNING first, so a reader who opens this in a spreadsheet meets the provenance
  // before the first number.
  out.push(row('# META'));
  out.push(row('field', 'value'));
  out.push(row('structure', p.title));
  out.push(row('configuration', p.summaryLine));
  out.push(row('spec', p.specHash));
  out.push(row('lineage', p.lineage));
  out.push(row('members', p.counts.members));
  out.push(row('citations pending page check', `${p.counts.phCites} of ${p.counts.cites}`));
  out.push(row('life-safety values', `${p.counts.ls} (${p.counts.lsPending} pending review)`));

  section('WARNING', 'note');
  out.push(row(honestyStrip(p)));
  out.push(row(FIDELITY.labor));
  out.push(row(FIDELITY.stockFit));
  out.push(row(FIDELITY.spans));
  out.push(row(PURCHASE_NOTES.waste));
  out.push(row(PURCHASE_NOTES.squares));
  // Prose, in the warning block, adjacent to nothing that looks like a field.
  if (p.isBunker) out.push(row(p.coverDepthNote));
  out.push(row('ON HAND / REQUISITION / LEAD TIME are left empty for the requesting unit.'));

  section('STOCK', 'nominal', 'grade', 'stock length ft', 'pieces', 'unit', 'waste LF', 'cuts served', 'on hand', 'requisition', 'lead time');
  for (const r of p.purchase.stock) {
    out.push(row(
      r.nominal, r.grade, r.stockLengthFt, r.pieces, 'EA', r.wasteLF,
      r.cutsServed.map((c) => `${fmtFtIn(c.lengthIn)} x${c.count}`).join('; '),
      '', '', '',
    ));
  }

  section('LONG RUNS', 'nominal', 'grade', 'run', 'count', 'lineal ft', 'unit', 'use', 'note');
  for (const r of p.purchase.longRuns) {
    out.push(row(r.nominal, r.grade, fmtFtIn(r.lengthIn), r.count, r.linealFt, 'LF',
      r.roles.map(p.plain).join(', '), 'longer than stock — splice per FM 5-426, locations not computed'));
  }

  section('CUTS', 'nominal', 'cut to', 'pieces', 'unit', 'board feet', 'grade', 'treatment', 'use');
  for (const l of p.cuts.filter((x) => x.klass === 'lumber')) {
    out.push(row(l.nominal, fmtFtIn(l.cutLengthIn), l.count, 'EA', l.boardFeet.toFixed(1), l.grade,
      l.treatment ?? '', l.roles.map(p.plain).join(', ')));
  }

  section('SHEETS', 'item', 'pieces cut', 'area sq ft', 'buy', 'unit', 'on hand', 'requisition', 'lead time');
  for (const s of p.purchase.sheets) {
    out.push(row(s.nominal, s.pieces, s.areaSqFt, s.quantity, s.unit, '', '', ''));
  }

  section('CONCRETE', 'item', 'lineal ft', 'volume', 'unit', 'on hand', 'requisition', 'lead time');
  for (const c of p.purchase.concrete) {
    out.push(row(c.nominal, c.linealFt, c.cubicYards, 'CY', '', '', ''));
  }

  section('HARDWARE', 'item', 'count', 'unit', 'weight lb', 'on hand', 'requisition', 'lead time');
  for (const l of p.fasteners.lines) {
    out.push(row(l.spec, l.count, 'EA', l.poundsApprox ?? '', '', '', ''));
  }
  for (const u of p.fasteners.unparsed) {
    out.push(row(`UNCOUNTED — schedule not recognised: ${u.schedule}`, '', '', '', '', '', ''));
  }

  section('LABOR', 'stage', 'name', 'pieces', 'man-hours', 'max useful crew');
  for (const s of p.labor.stages) out.push(row(s.ordinal, s.name, s.members, s.manHours.toFixed(1), s.maxUsefulCrew));
  out.push(row('', 'TOTAL', p.counts.members, p.labor.totalManHours.toFixed(1), p.labor.ceiling));

  section('CREW SCENARIOS', 'crew', 'crew-hours', 'whole shifts', 'note');
  for (const r of p.labor.crewRows) {
    out.push(r.suppressed
      ? row(r.crew, '', '', r.suppressed)
      : row(r.crew, r.crewHours.toFixed(1), r.shifts, `${p.labor.productiveHoursPerDay} productive hours per shift, ${p.labor.crewModel} scaling`));
  }

  section('LIFE SAFETY', 'value', 'as used', 'citation', 'status', 'doctrine id');
  for (const r of p.ls) out.push(row(r.label, r.value, r.cite, r.ph ? 'REVIEW REQUIRED' : 'verified', r.key));

  section('CITATIONS', 'citation', 'members', 'status');
  for (const c of p.cites) out.push(row(c.cite, c.members, c.ph ? 'PENDING PAGE CHECK' : 'verified'));

  if (p.issues.length > 0) {
    section('ADJUSTED FROM WHAT WAS ENTERED', 'path', 'message');
    for (const i of p.issues) out.push(row(i.path, i.message));
  }

  // CRLF: a spreadsheet on a Windows desktop is the likeliest destination, and RFC 4180 says
  // CRLF. Trailing newline so a concatenation does not glue two files' rows together.
  return `${out.join('\r\n')}\r\n`;
}

/** What to call the file. Content-addressed, so two packets can never collide by name. */
export function csvFilename(p: PacketModel): string {
  const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'structure';
  return `${slug}-${p.specHash}.materials.csv`;
}
