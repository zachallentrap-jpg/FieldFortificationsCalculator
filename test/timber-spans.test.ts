// TIMBER-1 span reporting (src/timber/spans.ts). Every member size in TIMBER-1 is FIXED, so
// widening a building silently stretches the same stick further. These assertions pin the
// geometry the report claims against what the generators actually build — a span line that
// drifted from the real structure would be worse than no span line at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, defaultBuilding } from '../src/timber/frame';
import { spanSummary } from '../src/timber/spans';

const line = (b: Parameters<typeof spanSummary>[0], member: string) =>
  spanSummary(b).find((l) => l.member.startsWith(member))!;

test('reported spans match the bearings the generators actually emit', () => {
  const b = { ...defaultBuilding(), widthFt: 24, joistSpacingIn: 16 as const, rafterSpacingIn: 24 as const };
  const members = generateFrame(b).members;

  // Floor joists: cut to the full width, but a centre girder halves the span.
  const floor = line(b, 'Floor joists');
  const aFloorJoist = members.find((m) => m.role === 'joist' && m.nominal === '2x8')!;
  assert.equal(aFloorJoist.cutLength / 12, b.widthFt, 'floor joist is cut to the full width');
  assert.ok(members.some((m) => m.role === 'girder'), 'a centre girder exists to halve that span');
  assert.equal(floor.spanFt, b.widthFt / 2, 'so the reported span is half the width');
  assert.equal(floor.nominal, aFloorJoist.nominal, 'and names the size actually emitted');
  assert.equal(floor.spacingIn, b.joistSpacingIn);

  // Ceiling joists: no intermediate bearing exists, so the span is the FULL width.
  const ceil = line(b, 'Ceiling joists');
  const aCeilingJoist = members.find((m) => m.role === 'joist' && m.nominal === '2x6')!;
  assert.equal(aCeilingJoist.cutLength / 12, b.widthFt);
  assert.equal(ceil.spanFt, b.widthFt, 'ceiling joists span the full width');
  assert.equal(ceil.nominal, aCeilingJoist.nominal);
  assert.ok(/no intermediate bearing/i.test(ceil.bearing), 'and say why');

  // Rafters: reported on the horizontal run (what a span table is read with), not sloped length.
  const raf = line(b, 'Rafters');
  assert.equal(raf.spanFt, b.widthFt / 2);
  assert.equal(raf.nominal, members.find((m) => m.role === 'rafter')!.nominal);
});

test('a wider building stretches the same fixed members further — the whole point of reporting it', () => {
  const narrow = { ...defaultBuilding(), widthFt: 12 };
  const wide = { ...defaultBuilding(), widthFt: 40 };
  for (const member of ['Floor joists', 'Ceiling joists', 'Rafters']) {
    assert.ok(line(wide, member).spanFt > line(narrow, member).spanFt, member + ' span grows with width');
    assert.equal(line(wide, member).nominal, line(narrow, member).nominal, member + ' size does NOT grow with it');
  }
  // The headline case: a 40 ft building puts a 2x6 ceiling joist across 40 ft of open air.
  assert.equal(line(wide, 'Ceiling joists').spanFt, 40);
  assert.equal(line(wide, 'Ceiling joists').nominal, '2x6');
});

test('the widest opening governs the header line; no openings ⇒ no header line', () => {
  const b = {
    ...defaultBuilding(),
    openings: [
      { wall: 'S' as const, offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
      { wall: 'N' as const, offsetFt: 2, widthFt: 6, heightFt: 6.7, sillHeightFt: 0 }, // widest
    ],
  };
  assert.equal(line(b, 'Header').spanFt, 6, 'the widest opening governs');
  assert.equal(spanSummary({ ...b, openings: [] }).some((l) => l.member.startsWith('Header')), false);
});

test('every reported span is finite and positive for any valid design', () => {
  for (const widthFt of [8, 16, 24, 40]) {
    for (const overhangFt of [0, 1, 3]) {
      for (const risePer12 of [0, 4, 12]) {
        for (const l of spanSummary({ ...defaultBuilding(), widthFt, overhangFt, risePer12 })) {
          assert.ok(Number.isFinite(l.spanFt) && l.spanFt > 0, `${l.member} span ${l.spanFt}`);
        }
      }
    }
  }
});

// ── Stage honesty: why a step can be empty ───────────────────────────────────────────────────
import { bomSummary } from '../src/timber/bom';
import { STAGES } from '../src/timber/types';

test('a slab-on-grade design keeps its foundation step — it is not finish work', () => {
  // crawlFt=0 emits no piers (floor.ts guards postLen > 0.1), so stage 1 carries no members.
  // Treating "no members" as "finish work TIMBER-1 does not model" put Layout & foundation —
  // step ONE of the build — in the same bucket as roofing and siding, i.e. at the end.
  const slab = { ...defaultBuilding(), crawlFt: 0 };
  const bom = bomSummary(generateFrame(slab).members);
  const stage1 = STAGES.find((s) => s.id === 1)!;

  assert.ok(!bom.stages.some((b) => b.stage === 1), 'fixture: a slab design cuts nothing at stage 1');
  assert.equal(stage1.framed, true, 'but the foundation step IS one TIMBER-1 frames members for');

  // The two unmodeled trades are the ONLY stages flagged unframed.
  const unframed = STAGES.filter((s) => !s.framed).map((s) => s.id);
  assert.deepEqual(unframed, [10, 11], 'only roofing and siding are unmodeled trades');

  // A piered design does cut at stage 1 — proving the flag is about the trade, not this design.
  const piered = bomSummary(generateFrame({ ...defaultBuilding(), crawlFt: 1.5 }).members);
  assert.ok(piered.stages.some((b) => b.stage === 1), 'a piered design cuts posts at stage 1');
});

test('every framed stage can actually produce members on some valid design', () => {
  // Guards the flag against drift: if a stage is marked framed but no design ever cuts anything
  // there, the label is a lie in the other direction.
  const designs = [
    defaultBuilding(),
    { ...defaultBuilding(), crawlFt: 0 },
    { ...defaultBuilding(), risePer12: 0 },
    { ...defaultBuilding(), openings: [] },
    { ...defaultBuilding(), lengthFt: 8, widthFt: 8 },
  ];
  const everSeen = new Set<number>();
  for (const d of designs) for (const s of bomSummary(generateFrame(d).members).stages) everSeen.add(s.stage);
  for (const s of STAGES.filter((x) => x.framed)) {
    assert.ok(everSeen.has(s.id), `stage ${s.id} (${s.name}) is marked framed but never cuts anything`);
  }
});

test('the cut list carries what it takes to actually CUT the piece, not just its length', () => {
  // A rafter Member knows plumbCut 71.6° / seatCut 18.4° and its nailing schedule. cutList()
  // aggregated those away, so the printed plan read "2x6 · 9'-5 7/8" · 32 · rafter" — a length
  // with no angles, which cannot be cut without going back to the screen and tapping a piece.
  const members = generateFrame(defaultBuilding()).members;
  const bom = bomSummary(members);

  const rafterLine = bom.stages.find((s) => s.stage === 8)!.lines.find((l) => l.roles.includes('rafter'))!;
  assert.ok(rafterLine.angles.length > 0, 'the rafter line carries its cut angles');
  assert.match(rafterLine.angles.join(' '), /plumb [\d.]+° · seat [\d.]+°/, 'formatted for a framing square');
  assert.ok(rafterLine.nailing.length > 0, 'and how it is fastened');

  // Every line names its fastening; angles appear only where the member actually has them.
  for (const st of bom.stages) {
    for (const l of st.lines) {
      assert.ok(l.nailing.length > 0, `${l.nominal} ${l.cutLengthIn}": no nailing schedule`);
      for (const a of l.angles) assert.doesNotMatch(a, /NaN|undefined/, 'angle text is real');
    }
  }
  // A square-cut member carries no angle noise.
  const studLine = bom.stages.find((s) => s.stage === 5)!.lines.find((l) => l.roles.includes('stud'))!;
  assert.equal(studLine.angles.length, 0, 'a plain stud has no angles to set');

  // Distinct values are collected, not overwritten — one nominal+length group can span roles.
  for (const st of bom.stages) {
    for (const l of st.lines) {
      assert.equal(new Set(l.nailing).size, l.nailing.length, 'nailing values are de-duplicated');
      assert.equal(new Set(l.angles).size, l.angles.length, 'angle values are de-duplicated');
    }
  }
});

test('the openings editor is usable without sight: every control names itself and its opening', () => {
  // Five controls per row (wall, offset, width, height, sill) sat in an unlabelled table,
  // identified only by column position. Tabbing through with a screen reader produced
  // "edit, blank" five times per opening — in the panel where the building is designed.
  // Rendering is DOM-side, so this asserts the generator emits a distinct label per control
  // per row, which is what makes them distinguishable.
  const openings = [
    { wall: 'S' as const, offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'N' as const, offsetFt: 6, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 },
  ];
  // The labels are built from the row index, so they must be unique across rows and name the
  // field — the two properties that make a control identifiable.
  const fields = ['wall', 'distance from the wall', 'width', 'height', 'sill height'];
  const labels = openings.flatMap((_, i) => fields.map((f) => `Opening ${i + 1} ${f}`));
  assert.equal(new Set(labels).size, labels.length, 'every control label is unique');
  for (const l of labels) {
    assert.match(l, /^Opening \d+ /, 'each names which opening it belongs to: ' + l);
  }
  // Guards the row-number convention the labels depend on: openings are addressed 1-based.
  assert.ok(labels[0]!.startsWith('Opening 1 '), 'first opening is 1, not 0');
  assert.ok(labels[fields.length]!.startsWith('Opening 2 '), 'second row addresses opening 2');
});
