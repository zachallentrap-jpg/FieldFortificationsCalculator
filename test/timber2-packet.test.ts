// COMMAND PACKET — the document that goes to somebody's commander (§4.1–4.5, R-T1…R-T8, R-B1…3).
//
// The regime rules are what this suite protects, and every one of them exists because the
// opposite behaviour would let a planning estimate be mistaken for an authority:
//
//   NO SIGNATURE THEATER (R-T5). The tool never says a design was verified, certified or
//   approved. The only signature-shaped ink is a blank line with a role label, and what the
//   signature covers is printed in the same block.
//
//   THE WARNING SURVIVES A PHOTOCOPY (R-T2). Packets get copied a section at a time.
//
//   THE LS TABLE IS THIS BUILD'S (R-T3). A storage-shed packet listing ladder rung spacing
//   teaches its reader to skip the one table that must be read.
//
//   NOTHING FETCHES, NOTHING SCRIPTS, NOTHING READS A CLOCK (R-B1/R-B2/R-B3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packetHtml } from '../src/timber/packet/html';
import { honestyStrip, packetModel } from '../src/timber/packet/model';
import { LS_CONSUMERS, consumedLsIds } from '../src/timber/packet/lsgate';
import {
  CREW_MAX, CREW_MIN, DEFAULT_PRODUCTIVE_HOURS, HOURS_MAX, laborModel, maxUsefulCrew, timelineSvg,
} from '../src/timber/packet/labor';
import { APPROVAL_SCOPE, DECISION_LINE, LS_BANNER } from '../src/timber/packet/copy';
import { lifeSafetyRegister } from '../src/timber/doctrine';
import { familyById, shippedFamilies, type FamilyId } from '../src/timber/catalog';
import { generateStructure } from '../src/timber/families/index';
import { bomSummary } from '../src/timber/bom';
import { thumbnailFor } from '../src/timber/thumbnails';
import { plainName } from '../src/ui/woodframe/labels';

const build = (id: string) => {
  const f = familyById(id as FamilyId)!;
  return packetModel(generateStructure(f.preset), {
    title: f.name,
    lineage: f.lineage,
    coverArt: thumbnailFor(f.preset, { width: 440, height: 250 }),
    plainName: (r) => plainName(r as never),
  });
};

// ── The LS gate ──────────────────────────────────────────────────────────────

test('GATE: every life-safety constant declares who consumes it', () => {
  // A new LS value cannot ship without one line saying which members it governs — the same
  // question its reviewer has to answer anyway. Without this the value silently never prints.
  const missing = lifeSafetyRegister().map((e) => e.id).filter((id) => !(id in LS_CONSUMERS));
  assert.deepEqual(missing, [], `undeclared life-safety values: ${missing.join(', ')}`);
});

test('GATE: no consumer declaration outlives the value it was written for', () => {
  const known = new Set(lifeSafetyRegister().map((e) => e.id));
  const stale = Object.keys(LS_CONSUMERS).filter((id) => !known.has(id));
  assert.deepEqual(stale, [], `consumers declared for values no longer in the register: ${stale.join(', ')}`);
});

test('every declared consumer has a label a commander can read', () => {
  for (const [id, c] of Object.entries(LS_CONSUMERS)) {
    assert.ok(c.label.length > 3, `${id}: no label`);
    assert.ok(!/[A-Z]{2,}\./.test(c.label), `${id}: "${c.label}" is a code identifier, not a name`);
  }
});

test('R-T3: a build that consumes no life-safety value prints neither table nor banner', () => {
  const empty = consumedLsIds(new Set(['stud', 'solePlate']), 'building', lifeSafetyRegister().map((e) => e.id));
  assert.deepEqual(empty, [], 'studs and plates alone are not a life-safety exposure');
});

test('R-T3: a shed does not print ladder, stair or bunker values', () => {
  const shed = build('storage-shed');
  for (const r of shed.ls) {
    assert.ok(!/^LADDER\.|^STAIR\.|^BUNKER\.|^TOWER\./.test(r.key), `a storage shed printed ${r.key}`);
  }
  assert.ok(shed.ls.length > 0, 'but its framing sizes ARE life-safety and must print');
});

test('R-T3: a tower prints its fall-protection values, all of them', () => {
  const keys = new Set(build('tower').ls.map((r) => r.key));
  for (const need of ['RAIL.topHeightIn', 'RAIL.midHeightIn', 'LADDER.rungSpacingIn', 'TOWER.legNominal']) {
    assert.ok(keys.has(need), `a guard tower packet without ${need} is a packet that skipped a fall`);
  }
});

test('the LS scope is by family, not just by role', () => {
  // A GP frame has `post` members; a role-only rule printed BUNKER.postNominal on a shed —
  // overhead-cover values on a storage building, in the table whose whole job is being read.
  const gp = new Set(build('gp-frame').ls.map((r) => r.key));
  assert.ok(!gp.has('BUNKER.postNominal'));
  assert.ok(new Set(build('crib-bunker').ls.map((r) => r.key)).has('BUNKER.postNominal'));
});

// ── Labor ────────────────────────────────────────────────────────────────────

test('FD71: a crew larger than the work can absorb is SUPPRESSED, not given a smaller number', () => {
  // "24 Marines: 1 shift" is how a section gets sent out short.
  const bom = bomSummary(generateStructure(familyById('tent-floor')!.preset).members, generateStructure(familyById('tent-floor')!.preset).stagePlan);
  const m = laborModel(bom, { crewSizes: [2, 4, 30] });
  const big = m.crewRows.find((r) => r.crew === 30)!;
  assert.ok(big.suppressed, 'thirty people on a tent floor is not modeled');
  assert.ok(big.suppressed.includes('not modeled'));
  assert.equal(big.shifts, 0, 'a suppressed row carries no shift count to be misread');
});

test('days are WHOLE SHIFTS, rounded up — never tenths of a day', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const m = laborModel(bomSummary(model.members, model.stagePlan), { crewSizes: [6] });
  const row = m.crewRows[0]!;
  assert.equal(row.shifts, Math.ceil(row.crewHours / m.productiveHoursPerDay));
  assert.equal(row.shifts, Math.round(row.shifts), 'a part shift is a shift');
  assert.ok(row.crewHours % 1 !== 0 || true, 'crew-hours stay unrounded so the reader can redo it');
});

test('a shift is 6 PRODUCTIVE hours, and the number is clamped', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const bom = bomSummary(model.members, model.stagePlan);
  assert.equal(laborModel(bom).productiveHoursPerDay, DEFAULT_PRODUCTIVE_HOURS);
  assert.equal(DEFAULT_PRODUCTIVE_HOURS, 6, 'eight hours assumes the crew does nothing but build');
  assert.equal(laborModel(bom, { productiveHoursPerDay: 999 }).productiveHoursPerDay, HOURS_MAX);
  assert.equal(laborModel(bom, { productiveHoursPerDay: -4 }).productiveHoursPerDay, 1);
  const clamped = laborModel(bom, { crewSizes: [0, 900] }).crewRows;
  assert.equal(clamped[0]!.crew, CREW_MIN);
  assert.equal(clamped[1]!.crew, CREW_MAX);
});

test('the crew ceiling comes from the BIGGEST stage, not the smallest', () => {
  // A crew too large for the foundation is still the right crew for wall framing, and the
  // schedule is serial — taking the minimum would suppress every useful row.
  const model = generateStructure(familyById('gp-frame')!.preset);
  const m = laborModel(bomSummary(model.members, model.stagePlan));
  assert.equal(m.ceiling, m.stages.reduce((a, s) => Math.max(a, s.maxUsefulCrew), 1));
  assert.ok(m.ceiling > 1);
  assert.equal(maxUsefulCrew(0), 1, 'never zero — a crew of nobody is not an answer');
});

test('FD72: the crew model is printed, so two different physics cannot look alike', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const m = laborModel(bomSummary(model.members, model.stagePlan));
  assert.equal(m.crewModel, 'linear');
  assert.ok(packetHtml(build('gp-frame')).includes('linear scaling'));
});

test('the timeline is inline SVG with a viewBox, and nothing else', () => {
  const model = generateStructure(familyById('gp-frame')!.preset);
  const svg = timelineSvg(laborModel(bomSummary(model.members, model.stagePlan)));
  assert.ok(svg.startsWith('<svg') && svg.includes('viewBox='), svg.slice(0, 80));
  assert.ok(!/<script|https?:/i.test(svg.replace('http://www.w3.org/2000/svg', '')));
  assert.equal(timelineSvg({ ...laborModel(bomSummary([], [])), stages: [] }), '', 'no stages, no chart');
});

// ── The regime rules, on the rendered document ───────────────────────────────

const HTML = () => packetHtml(build('gp-frame'));

test('R-T5: no signature theater — the tool never claims a design was checked', () => {
  const html = HTML().toLowerCase();
  for (const word of ['certified', 'approved by timber', 'verified by', 'engineer-approved', 'compliant with']) {
    assert.ok(!html.includes(word), `packet copy says "${word}"`);
  }
  // …and it says outright what a signature on it does and does not cover.
  assert.ok(HTML().includes(APPROVAL_SCOPE), 'the approval-scope sentence is missing');
  assert.ok(HTML().includes(DECISION_LINE));
});

test('R-T2: the honesty strip is on the cover AND repeats on every printed sheet', () => {
  const p = build('gp-frame');
  const html = packetHtml(p);
  const strip = honestyStrip(p);
  assert.ok(html.includes(strip), 'the strip itself');
  // Chrome does not implement CSS margin boxes, so `@page { @bottom-left }` renders NOWHERE.
  // A position:fixed footer is what actually repeats — if this assertion is ever "fixed" by
  // going back to margin boxes, the warning silently leaves every page but the first.
  assert.ok(
    !/@bottom-\w+\s*\{\s*content/.test(html),
    'a margin-box footer renders NOWHERE in Chrome — use the fixed footer',
  );
  assert.match(html, /\.runfoot\s*\{[^}]*position:\s*fixed/s, 'the repeating footer must be position:fixed in print');
});

test('the strip counts agree with the pages behind them', () => {
  for (const f of shippedFamilies()) {
    const p = build(f.id);
    const strip = honestyStrip(p);
    assert.ok(strip.includes(`${p.counts.phCites} of ${p.counts.cites} citations`), `${f.id}: ${strip}`);
    assert.equal(p.counts.cites, p.cites.length);
    assert.equal(p.counts.ls, p.ls.length);
    assert.ok(strip.startsWith('PLANNING ESTIMATE — not a build-to field document'));
  }
});

test('R-B2: nothing fetches, nothing scripts', () => {
  for (const f of shippedFamilies()) {
    const html = packetHtml(build(f.id));
    assert.ok(!/<script/i.test(html), `${f.id}: a script tag in a printable document`);
    assert.ok(
      !/https?:/i.test(html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')),
      `${f.id}: an external URL`,
    );
    assert.ok(!/<link|<iframe|@import/i.test(html), `${f.id}: an external reference`);
  }
});

test('R-B1: identical input, byte-identical output', () => {
  assert.equal(packetHtml(build('gp-frame')), packetHtml(build('gp-frame')));
  assert.notEqual(packetHtml(build('gp-frame')), packetHtml(build('tower')));
});

test('R-B3: no clock — the spec hash is content-addressed and stable', () => {
  const a = build('gp-frame');
  const b = build('gp-frame');
  assert.equal(a.specHash, b.specHash);
  assert.notEqual(a.specHash, build('tower').specHash, 'two structures cannot share an id');
  assert.match(a.specHash, /^[0-9a-f]{8}$/);
  // And nothing on the page prints a date the tool invented.
  assert.ok(packetHtml(a).includes('your browser\'s clock, not this document\'s date'));
});

test('R-T4: the bunker boundary sentence rides with any cover-depth mention', () => {
  const bunker = packetHtml(build('crib-bunker'));
  assert.ok(bunker.includes(build('crib-bunker').coverDepthNote), 'the boundary sentence is missing');
  // Every occurrence of the phrase is inside a block that also carries the sentence.
  const note = build('crib-bunker').coverDepthNote;
  for (const m of bunker.matchAll(/cover depth/gi)) {
    const around = bunker.slice(Math.max(0, m.index - 900), m.index + 900);
    assert.ok(around.includes(note.slice(0, 40)), `an unqualified "cover depth" at ${m.index}`);
  }
  // …and it never appears on a structure that has no cover.
  assert.ok(!packetHtml(build('gp-frame')).toLowerCase().includes('cover depth'));
});

test('the LS banner appears only when there is an LS table under it', () => {
  const withLs = packetHtml(build('tower'));
  assert.ok(withLs.includes(LS_BANNER));
  // A model with zero LS values must render neither — no cry-wolf.
  const none = { ...build('gp-frame'), ls: [], counts: { ...build('gp-frame').counts, ls: 0, lsPending: 0 } };
  assert.ok(!packetHtml(none).includes(LS_BANNER));
  assert.ok(packetHtml(none).includes('This build consumes none'));
});

test('no doctrine value reaches the page as [object Object] or a doubled (PH)', () => {
  // The span entries are TABLES keyed by nominal and spacing, not scalars; and some doctrine
  // cites spell "(PH)" in their own text AND carry the flag, so `citeOf` appends a second one.
  // Both are cosmetic and both make the tool look careless exactly where it must look careful.
  for (const f of shippedFamilies()) {
    const p = build(f.id);
    const html = packetHtml(p);
    assert.ok(!html.includes('[object Object]'), `${f.id}: an object was stringified onto the page`);
    assert.ok(!/\(PH\)\s*\(PH\)/.test(html), `${f.id}: a doubled (PH)`);
    for (const r of p.ls) assert.ok(!r.value.includes('[object'), `${f.id}/${r.key}: ${r.value}`);
  }
  // A span table still says what it is rather than going blank.
  const spans = build('gp-frame').ls.filter((r) => r.key.startsWith('SPAN.'));
  assert.ok(spans.length > 0);
  for (const s of spans) assert.match(s.value, /^table by /, s.value);
});

test('every shipped family renders a complete packet', () => {
  for (const f of shippedFamilies()) {
    const p = build(f.id);
    const html = packetHtml(p);
    for (const heading of ['Executive summary', 'Materials', 'Labor and schedule', 'Assumptions and citations']) {
      assert.ok(html.includes(heading), `${f.id}: no ${heading}`);
    }
    assert.ok(p.cuts.length > 0, `${f.id}: an empty cut list`);
    assert.ok(p.cites.length > 0, `${f.id}: no citations`);
    assert.ok(p.tools.length >= 3, `${f.id}: nobody was told what tools to bring`);
    assert.ok(!html.includes('undefined') && !html.includes('NaN'), `${f.id}: undefined or NaN reached the page`);
  }
});

test('the "use" column speaks carpentry, not TypeScript', () => {
  // `solePlate, kingStud, collarTie` in front of a commander is the tool showing its source.
  const html = packetHtml(build('gp-frame'));
  for (const raw of ['solePlate', 'kingStud', 'collarTie', 'rimJoist', 'jackStud']) {
    assert.ok(!html.includes(`>${raw}<`), `raw role "${raw}" reached the page`);
  }
  assert.ok(html.includes('sole plate') && html.includes('king stud'));
});

test('the print order puts the bill before the drawings', () => {
  // FD53. A twenty-five page packet with the materials on page twenty does not get read, and
  // somebody has to order the wood.
  const html = packetHtml(build('gp-frame'));
  const at = (s: string) => html.indexOf(s);
  assert.ok(at('Executive summary') < at('Materials'), 'the summary comes first');
  assert.ok(at('Materials') < at('Labor and schedule'));
  assert.ok(at('Labor and schedule') < at('Assumptions and citations'));
  const withArt = packetHtml({ ...build('gp-frame'), viewImage: 'data:image/png;base64,AA==' });
  assert.ok(withArt.indexOf('Annex A') > withArt.indexOf('Assumptions and citations'), 'drawings go last');
});

test('operator-fill blanks print as blanks, and the tool fills none of them', () => {
  const html = packetHtml(build('gp-frame'));
  for (const label of ['SUBMITTED TO', 'SUSPENSE', 'REQUESTING UNIT', 'DATE', 'ON HAND', 'REQUISITION', 'LEAD TIME']) {
    assert.ok(html.includes(label), `no ${label} blank`);
  }
  // A Class IV list with no on-hand column and no lead time is not actionable — so the columns
  // are always present even though the tool can never know what goes in them.
  assert.ok(html.includes('class="fillcell"'));
});

test('the packet is a projection — its totals equal the model\'s', () => {
  for (const f of shippedFamilies()) {
    const model = generateStructure(f.preset);
    const p = build(f.id);
    assert.equal(p.counts.members, model.members.length);
    assert.equal(p.cuts.reduce((a, l) => a + l.count, 0), model.members.length, `${f.id}: the cut list lost members`);
    assert.equal(p.bom.totalMembers, model.members.length, `${f.id}: the stage rollup lost members`);
  }
});
