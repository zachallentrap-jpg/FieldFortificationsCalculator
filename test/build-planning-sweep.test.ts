// Cross-cutting sweep over the BUILD-PLANNING surfaces of both tools.
//
// Why this exists: the panels in this area were each correct in isolation and wrong in
// combination. Five consecutive defects were found not by testing a panel, but by varying a
// cross-cutting input (count, unit, teamSize, machineAssist/threat, crawlFt) and checking what
// the panel then claimed. This locks that method in: every position/design × every axis, asserting
// the invariants those defects violated. Ad-hoc probes found them; this keeps them found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { compute } from '../src/engine/compute';
import { computeStages, scheduleStages } from '../src/engine/stages';
import { CODES } from '../src/engine/codes';
import { RATES_ARE_PLACEHOLDERS, ratesNote } from '../src/engine/labor';
import { planForTime } from '../src/engine/plan';
import { aggregateMission } from '../src/engine/mission';
import { scheduleOverlay, compareOverlay, missionOverlay, planOverlay, scenariosOverlay } from '../src/layout/tools';
import { specsPanel, bomPanel, summaryBar, laborPanel, validationPanel } from '../src/layout/panels';
import { stageCaption, renderApp } from '../src/layout/shell';
import { jobSheet } from '../src/render/jobSheet';
import { describe, statusAnnouncement } from '../src/render/a11y';
import { drawPlan } from '../src/render/drawPlan';
import { CALLOUTS } from '../src/render/svg';
import { drawSection } from '../src/render/drawSection';
import { drawIso } from '../src/render/drawIso';
import type { GeometryModel } from '../src/engine/geometry';
import { toCsv } from '../src/render/csv';
import { fmtBomQty } from '../src/doctrine/units';
import { positions } from '../src/doctrine/positions';
import { soils } from '../src/doctrine/soils';
import { labor as laborDoctrine } from '../src/doctrine/labor';
import { buildScene3D } from '../src/render3d/scene3d';
import { controlsHtml } from '../src/layout/controls';
import { helpHtml } from '../src/layout/help';
import { validateInputs } from '../src/state/schema';
import { positionLabel, soilLabel, standardLabel, threatLabel, problemsHeading, parapetBagsLabel } from '../src/doctrine/labels';
import { revetments, sump, excavation } from '../src/doctrine/materials';
import { standards } from '../src/doctrine/standards';
import { threats, threatClasses, threatClassOf } from '../src/doctrine/protection';
import type { Box3 } from '../src/render3d/scene3d';
import { STAGE_ORDER } from '../src/doctrine/stages';
import { generateFrame, defaultBuilding, wallRunFt, designProblems, sanitizeBuilding, OPENING_BOUNDS } from '../src/timber/frame';
import { bomSummary, type BomSummary } from '../src/timber/bom';
import { spanSummary } from '../src/timber/spans';
import { describeModel, stageText } from '../src/timber/describe';
import { layoutStrip } from '../src/timber/elevation';
import { STAGES, STAGE_PHASES } from '../src/timber/types';
import { fmtLength } from '../src/doctrine/units';
import { esc as escHtml } from '../src/render/svg';
import { defaultInputs } from './helpers';

const ctxOf = (r: ReturnType<typeof compute>) => ({
  unit: r.inputs.unit,
  machineAssist: r.inputs.machineAssist,
  engineeredRoof: r.cover.roofPath === 'engineered_required',
  errors: r.validation.filter((v) => v.severity === 'error').map((v) => v.message),
});

// Anything that reaches a user as a number must be a real one. These are the shapes that leak
// when a formatter is skipped or a field is read off the wrong object.
const LEAKS = /NaN|Infinity|undefined|null|\[object|\d\.\d{4,}/;

test('SAP-1: every position type produces a coherent build plan on every axis', () => {
  for (const positionType of Object.keys(positions)) {
    for (const unit of ['imperial', 'metric'] as const) {
      for (const count of [1, 7]) {
        for (const machineAssist of [false, true]) {
          const r = compute(defaultInputs({
            positionType, unit, count, machineAssist,
            teamSize: 6, revetment: 'pickets_wire', sump: true, overheadCover: true, camouflage: true,
          }));
          const sched = scheduleStages(computeStages(r), {
            teamSize: r.inputs.teamSize, availableHours: 12, securityPostureFrac: 0.75, positions: r.inputs.count,
          });
          const ctx = `${positionType}/${unit}/n=${count}/machine=${machineAssist}`;

          // Stage plan: doctrinal order, exact partition of the position total.
          const order = STAGE_ORDER.map((s) => s.id);
          const seen = sched.steps.map((s) => s.id);
          assert.deepEqual(seen, order.filter((id) => seen.includes(id)), ctx + ': stages stay in doctrinal order');
          const sum = sched.steps.reduce((a, s) => a + s.manHours, 0);
          assert.ok(Math.abs(sum - r.labor.manHoursPerPosition) < 1e-9, ctx + ': man-hours partition the total');

          // Readiness is judged on the whole job and can never claim ready when labor overruns.
          assert.ok(sched.allPositionsHours >= sched.totalElapsedHours - 1e-9, ctx + ': job ≥ one position');
          assert.equal(sched.positions, count, ctx + ': the order count is carried');
          if (r.labor.elapsedHours > sched.availableHours + 1e-9 && sched.effectiveDiggers >= r.inputs.teamSize) {
            assert.equal(sched.feasible, false, ctx + ': cannot report ready when labor overruns');
          }

          // Rendered surfaces carry no leaked internals, and quantities obey the unit system.
          const overlay = scheduleOverlay(sched, r.inputs.teamSize, 12, 0.75, ctxOf(r));
          const sheet = jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' });
          for (const [name, html] of [['overlay', overlay], ['sheet', sheet]] as const) {
            const draws = (html.match(/Draw now:[^<]*/g) ?? []).join(' ');
            assert.doesNotMatch(draws, LEAKS, `${ctx}/${name}: leaked value in materials: ${draws.slice(0, 120)}`);
            if (unit === 'metric') {
              assert.doesNotMatch(draws, /\d\s*ft³|\d\s*ft\b/, `${ctx}/${name}: imperial unit in a metric plan`);
            }
          }

          // The 3D scrubber names every stage and never contradicts the plan about what exists.
          STAGE_ORDER.forEach((s, i) => {
            const cap = stageCaption(i, r);
            assert.doesNotMatch(cap, LEAKS, `${ctx}: caption ${i} leaked a value`);
            const built = sched.steps.some((x) => x.id === s.id);
            assert.equal(/Not part of this design/.test(cap), !built, `${ctx}: caption ${i} agrees with the plan`);
          });
        }
      }
    }
  }
});

test('TIMBER-1: every design variant keeps a complete, correctly-ordered build sequence', () => {
  const variants: Array<[string, Partial<ReturnType<typeof defaultBuilding>>]> = [
    ['default', {}],
    ['slab on grade', { crawlFt: 0 }],
    ['flat roof', { risePer12: 0 }],
    ['no overhang', { overhangFt: 0 }],
    ['no openings', { openings: [] }],
    ['24in framing', { studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24 }],
    ['smallest', { lengthFt: 8, widthFt: 8 }],
    ['largest', { lengthFt: 60, widthFt: 40 }],
  ];
  for (const [label, over] of variants) {
    const b = { ...defaultBuilding(), ...over };
    const model = generateFrame(b);
    const bom = bomSummary(model.members);

    // Members are all real and validly staged.
    const stageIds = new Set<number>(STAGES.map((s) => s.id));
    for (const m of model.members) {
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${label}: ${m.id} non-finite`);
      }
      assert.ok(m.cutLength > 0, `${label}: ${m.id} cutLength ${m.cutLength}`);
      assert.ok(stageIds.has(m.stage), `${label}: ${m.id} bad stage`);
    }

    // The sequence is monotonic and every stage that carries members is one TIMBER-1 frames.
    const staged = bom.stages.map((s) => s.stage);
    assert.deepEqual([...staged].sort((x, y) => x - y), staged, `${label}: stages ascend`);
    for (const s of bom.stages) {
      const def = STAGES.find((d) => d.id === s.stage)!;
      assert.equal(def.framed, true, `${label}: stage ${s.stage} carries members so it must be framed`);
      assert.ok(s.memberCount > 0 && s.manHours >= 0, `${label}: stage ${s.stage} totals`);
    }

    // Spans are always reportable and positive — the figure a user checks against a span table.
    for (const l of spanSummary(b)) {
      assert.ok(Number.isFinite(l.spanFt) && l.spanFt > 0, `${label}: ${l.member} span ${l.spanFt}`);
      assert.ok(l.nominal.length > 0 && l.bearing.length > 0, `${label}: ${l.member} incomplete`);
    }
  }
});

test('TIMBER-1: crew size divides man-hours and never produces a nonsense duration', () => {
  const bom = bomSummary(generateFrame(defaultBuilding()).members);
  let prev = Infinity;
  for (const crew of [1, 2, 4, 8, 20]) {
    const hours = bom.totalManHours / crew;
    assert.ok(Number.isFinite(hours) && hours > 0, `crew ${crew}: ${hours}`);
    assert.ok(hours < prev, `crew ${crew}: more hands must not take longer`);
    prev = hours;
  }
});

test('SAP-1: no soil/position combination is ever shown as ready while the design is rejected', () => {
  // The readiness verdict is about time; a validation error is about the design. Reporting the
  // first without the second turned "Ready with 21.6 hr to spare" into apparent approval for a
  // position whose walls the app says will cave in.
  let sawAnError = false;
  for (const positionType of Object.keys(positions)) {
    for (const soil of Object.keys(soils)) {
      for (const revetment of ['none', 'pickets_wire']) {
        const r = compute(defaultInputs({ positionType, soil, revetment, standard: 'deliberate' }));
        const errs = r.validation.filter((v) => v.severity === 'error');
        const sched = scheduleStages(computeStages(r), {
          teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 1,
        });
        const html = scheduleOverlay(sched, 4, 999, 1, ctxOf(r));
        const ctx = `${positionType}/${soil}/${revetment}`;
        if (errs.length) {
          sawAnError = true;
          assert.match(html, /Fix before building/i, ctx + ': errors must be stated');
          for (const e of errs) assert.ok(html.includes(e.message.replace(/&/g, '&amp;')), ctx + ': names ' + e.code);
        } else {
          assert.doesNotMatch(html, /Fix before building/i, ctx + ': no phantom problem block');
        }
      }
    }
  }
  assert.ok(sawAnError, 'sweep must actually exercise the error path');
});

test('SAP-1: nothing the engine attaches to a step is dropped before it reaches paper or screen', () => {
  // The recurring failure in this area was never a wrong calculation — it was a correct one that
  // never reached the surface. Materials, target dimensions, cost and the tick box are all
  // per-step data; this asserts each one survives the trip to BOTH rendered surfaces, for every
  // position and both unit systems, so the next addition cannot quietly go missing either.
  for (const positionType of Object.keys(positions)) {
    for (const unit of ['imperial', 'metric'] as const) {
      const r = compute(defaultInputs({
        positionType, unit, revetment: 'pickets_wire', sump: true, overheadCover: true, camouflage: true,
      }));
      const sched = scheduleStages(computeStages(r), {
        teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: r.inputs.count,
      });
      const overlay = scheduleOverlay(sched, 4, 999, 1, ctxOf(r));
      const sheet = jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' });
      const where = `${positionType}/${unit}`;

      for (const step of sched.steps) {
        for (const [name, html] of [['overlay', overlay], ['sheet', sheet]] as const) {
          assert.ok(html.includes(escHtml(step.label)), `${where}/${name}: lost stage ${step.id}`);
          assert.ok(html.includes(escHtml(step.detail)), `${where}/${name}: lost the why for ${step.id}`);
          // Target dimensions — the size the step builds to.
          for (const d of step.dims) {
            const shown = fmtLength(d.valueFt, unit);
            assert.ok(html.includes(shown), `${where}/${name}: ${step.id} lost ${d.key} (${shown})`);
          }
          // Materials emplaced during the step.
          for (const b of step.bom) {
            assert.ok(html.includes(escHtml(b.label)), `${where}/${name}: ${step.id} lost ${b.id}`);
          }
        }
      }
      // The printed plan is a checklist: one tick cell per stage, always.
      assert.equal((sheet.match(/<td class="tick">/g) ?? []).length, sched.steps.length, where + ': one tick per stage');
    }
  }
});

test('TIMBER-1: every cut line keeps what it takes to cut and fasten the piece', () => {
  for (const [label, over] of [
    ['default', {}],
    ['flat roof', { risePer12: 0 }],
    ['steep roof', { risePer12: 12 }],
    ['24in framing', { studSpacingIn: 24 as const, rafterSpacingIn: 24 as const }],
  ] as const) {
    const bom = bomSummary(generateFrame({ ...defaultBuilding(), ...over }).members);
    for (const st of bom.stages) {
      for (const l of st.lines) {
        assert.ok(l.nailing.length > 0, `${label}: ${l.nominal} ${l.cutLengthIn}" has no nailing schedule`);
        assert.ok(l.count > 0 && Number.isFinite(l.cutLengthIn), `${label}: ${l.nominal} bad line`);
        for (const a of l.angles) assert.doesNotMatch(a, LEAKS, `${label}: bad angle text "${a}"`);
      }
    }
    // A pitched roof must publish rafter angles; a flat one legitimately has none to set.
    const roof = bom.stages.find((s) => s.stage === 8);
    const rafter = roof?.lines.find((l) => l.roles.includes('rafter'));
    if (rafter && over.risePer12 !== 0) {
      assert.ok(rafter.angles.length > 0, `${label}: a pitched rafter must state its cut angles`);
    }
  }
});

test('every view draws the same structure: platform width and sump count agree across all four', () => {
  // The recurring cross-view failure was one view inventing a dimension another read from
  // doctrine (the section drew a 0.7 ft firing platform where doctrine and the plan said 2 ft).
  // These two are the load-bearing cases — a feature you stand on and a feature you count — so
  // they are pinned across plan, section, 3D and the bill at once.
  for (const positionType of Object.keys(positions)) {
    const doctrine = positions[positionType]!;
    const r = compute(defaultInputs({ positionType, standard: 'deliberate', firingStep: true, sump: true }));
    const geo = r.geometry as {
      plan: { platform: { W: number } | null; sumps: unknown[]; holeW: number };
      section: { platformW: number };
    };
    const parts = buildScene3D(r).parts;
    const ctx = positionType;

    // Firing platform — doctrine width, clamped to the bay, identical in every view that draws it.
    if (doctrine.firingPlatform) {
      const expected = Math.min(doctrine.firingPlatform.W.value, geo.plan.holeW);
      assert.equal(geo.plan.platform?.W, expected, ctx + ': plan platform width');
      assert.equal(geo.section.platformW, expected, ctx + ': section platform width');
      const p3 = parts.find((x) => (x as { role?: string }).role === 'platform') as { d?: number } | undefined;
      if (p3) assert.ok(Math.abs((p3.d ?? 0) - expected) < 0.01, ctx + ': 3D platform depth');
    } else {
      assert.equal(geo.plan.platform, null, ctx + ': no doctrine platform ⇒ none drawn');
      assert.equal(geo.section.platformW, 0, ctx + ': and none in section');
    }

    // Grenade sumps — a doctrine COUNT, so the plan marks, the 3D solids and the bill must tally.
    assert.equal(geo.plan.sumps.length, doctrine.grenadeSumps, ctx + ': plan sump marks');
    const s3 = parts.filter((x) => (x as { role?: string }).role === 'sump').length;
    if (doctrine.grenadeSumps > 0) assert.equal(s3, doctrine.grenadeSumps, ctx + ': 3D sump count');
    const billed = r.bom.find((b) => b.id === 'grenade_sumps')?.qtyPerPosition ?? 0;
    assert.equal(billed, doctrine.grenadeSumps, ctx + ': billed sump count');
  }
});

test('every billed line reaches every output surface — screen, paper and spreadsheet', () => {
  // Three independent renderers consume the same bill. Each has, at some point, dropped
  // something the engine computed (materials, units, findings), so the invariant is stated once
  // and checked for every position rather than trusted per surface.
  for (const positionType of Object.keys(positions)) {
    for (const unit of ['imperial', 'metric'] as const) {
      const r = compute(defaultInputs({
        positionType, unit, count: 3, revetment: 'pickets_wire', sump: true, camouflage: true, overheadCover: true,
      }));
      const sched = scheduleStages(computeStages(r), {
        teamSize: 6, availableHours: 24, securityPostureFrac: 0.75, positions: r.inputs.count,
      });
      const surfaces = {
        schedule: scheduleOverlay(sched, 6, 24, 0.75, ctxOf(r)),
        sheet: jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' }),
        csv: toCsv(r, { scenario: 'Sweep', date: '2026-07-13' }),
      };
      for (const line of r.bom) {
        for (const [name, out] of Object.entries(surfaces)) {
          // CSV is plain text; the HTML surfaces escape ampersands ("Pickets & wire").
          const needle = name === 'csv' ? line.label : escHtml(line.label);
          assert.ok(out.includes(needle), `${positionType}/${unit}/${name}: dropped "${line.label}"`);
        }
      }
      // …and the quantity each surface prints is the unit-converted one, never the raw figure.
      for (const line of r.bom) {
        const conv = fmtBomQty(line.qtyTotal, line.unit, unit);
        if (conv.unit !== line.unit) {
          assert.ok(
            !surfaces.csv.includes(`${line.label},`) || !surfaces.csv.includes(line.unit + '\n'),
            `${positionType}/${unit}: CSV kept the raw unit for ${line.label}`,
          );
        }
      }
    }
  }
});

// A checklist you can tick to 100% on a position that has no roof is worse than no checklist.
// When the threat forces an engineer-designed roof there is no doctrinal labor and no BOM for it,
// so the "drop stages with neither" rule silently deleted the overhead step — leaving camouflage
// as the final instruction on a roofless hole. The step must survive as a handoff, on paper and
// on screen, without disturbing the man-hour partition.
test('SAP-1: an engineered roof stays IN the build sequence as a handoff step', () => {
  const engineered = ['at-rpg', 'at-recoilless', 'at-tank', 'at-he-contact', 'blast-vbied'];
  for (const threat of engineered) {
    const r = compute(defaultInputs({ threat, overheadCover: true, camouflage: true, teamSize: 4 }));
    assert.equal(r.cover.roofPath, 'engineered_required', threat);

    const plan = computeStages(r);
    const step = plan.steps.find((s) => s.id === 'overhead');
    assert.ok(step, `${threat}: overhead step vanished from the sequence`);
    assert.equal(step!.manHours, 0, `${threat}: engineered roof must not invent man-hours`);
    assert.equal(step!.bom.length, 0, `${threat}: engineered roof must not invent materials`);
    assert.match(step!.label, /engineer/i, `${threat}: step label must say who builds it`);

    // It is not the last word: camouflage still follows it, as in STAGE_ORDER.
    const ids = plan.steps.map((s) => s.id);
    assert.ok(ids.indexOf('overhead') < ids.indexOf('camo'), `${threat}: order broke`);

    // The partition the whole scheduler rests on is untouched by a zero-hour step.
    const sum = plan.steps.reduce((a, s) => a + s.manHours, 0);
    assert.ok(Math.abs(sum - r.labor.manHoursPerPosition) < 1e-9, `${threat}: partition drifted`);

    // EVERY surface that names this stage carries the handoff — including the 3D stage caption,
    // which reads the static doctrine row and so kept telling a crew to place "stringers and cover
    // material overhead" after the schedule and the printed sheet had both stopped.
    const sched = scheduleStages(plan, {
      teamSize: 4, availableHours: 12, securityPostureFrac: 0.5, positions: r.inputs.count,
    });
    const screen = scheduleOverlay(sched, 4, 12, 0.5, ctxOf(r));
    const paper = jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' });
    const caption = stageCaption(STAGE_ORDER.findIndex((d) => d.id === 'overhead'), r);
    for (const [name, out] of Object.entries({ screen, paper, caption })) {
      assert.match(out, /by engineer/i, `${threat}/${name}: handoff step not shown`);
      assert.doesNotMatch(out, /stringers and cover material/i,
        `${threat}/${name}: still instructs the crew to build an engineer-only roof`);
    }
  }
});

// The mirror case: when the roof IS field-expedient, nothing above changed it.
test('SAP-1: an earth-on-stringers roof still carries real labor and materials', () => {
  const r = compute(defaultInputs({ threat: 'ind-art-105', overheadCover: true, teamSize: 4 }));
  assert.equal(r.cover.roofPath, 'earth_on_stringers');
  const step = computeStages(r).steps.find((s) => s.id === 'overhead');
  assert.ok(step && step.manHours > 0 && step.bom.length > 0, 'earth roof lost its work');
  assert.doesNotMatch(step!.label, /engineer/i, 'earth roof mislabelled as a handoff');
  assert.ok(step!.dims.some((d) => d.key === 'cover_t'), 'earth roof lost its thickness dimension');
});

// The 3D scrubber is the build sequence a user actually watches, so it must build in the SAME
// order as the schedule beside it. Revetment is emplaced at revet_sump, but the wall it faces is
// dug at the hasty scrape and the finish was baked in at build time — so the model showed a fully
// revetted hole during the scrape, and "Revet walls & dig sumps" then appeared to add only a sump.
test('3D model does not clad the walls before the revetment stage', () => {
  const REVET = STAGE_ORDER.findIndex((s) => s.id === 'revet_sump');
  const HASTY = STAGE_ORDER.findIndex((s) => s.id === 'hasty');
  for (const revetment of ['sandbag_facing', 'pickets_wire', 'corrugated_metal', 'timber_plywood']) {
    const r = compute(defaultInputs({ revetment, sump: true, soil: 'sand' }));
    const wallsAt = (stage?: number) =>
      buildScene3D(r, stage === undefined ? {} : { stage })
        .parts.filter((p): p is Box3 => p.kind === 'box' && p.role === 'bayWall');

    // Before the revet stage the face is bare earth and no picket posts are placed…
    for (let s = HASTY; s < REVET; s++) {
      for (const w of wallsAt(s)) {
        assert.equal(w.finish, 'earth', `${revetment}: wall clad at stage ${s}, before revetting`);
        assert.equal(w.picketSpacing, undefined, `${revetment}: posts placed at stage ${s}`);
      }
    }
    // …and from the revet stage on it carries the operator's actual choice.
    const clad = wallsAt(REVET);
    assert.ok(clad.length > 0, `${revetment}: no walls at the revet stage`);
    for (const w of clad) assert.notEqual(w.finish, 'earth', `${revetment}: never got its facing`);

    // Only the FACING waits — the cut profile is identical at every stage, because a hole you
    // intend to revet is dug to its vertical profile from the start. If the taper moved, the
    // model would be implying excavation the BOM never billed.
    const taperOf = (stage?: number) => wallsAt(stage).map((w) => w.taperAmount ?? 0).join(',');
    assert.equal(taperOf(HASTY), taperOf(REVET), `${revetment}: wall profile changed when clad`);
    assert.equal(taperOf(REVET), taperOf(undefined), `${revetment}: profile drifted by the final state`);
  }
});

// An unrevetted design is untouched by the above: its faces are earth throughout, and they keep
// the soil's angle-of-repose slope that the revetted cases deliberately do not have.
test('3D model leaves an unrevetted position sloped at every stage', () => {
  const r = compute(defaultInputs({ revetment: 'none', soil: 'sand' }));
  const walls = buildScene3D(r, {}).parts.filter((p): p is Box3 => p.kind === 'box' && p.role === 'bayWall');
  assert.ok(walls.length > 0);
  for (const w of walls) {
    assert.equal(w.finish, 'earth');
    assert.ok((w.taperAmount ?? 0) > 0, 'a bare sand wall must batter back');
  }
});

// The design panel's help text makes FACTUAL claims about what each input does to the frame
// ("length sets how many posts get cut", "0 crawl cuts no posts at all"). Help that quietly stops
// being true is worse than none, so the claims are asserted against the generators rather than
// trusted. If a generator changes, this fails and the wording gets revisited with it.
test('TIMBER-1: the design panel’s help text is true of the model', () => {
  const base = defaultBuilding();
  const count = (b: typeof base, role: string) =>
    generateFrame(b).members.filter((m) => m.role === role).length;
  const maxLen = (b: typeof base, role: string) =>
    Math.max(0, ...generateFrame(b).members.filter((m) => m.role === role).map((m) => m.cutLength));

  // "Length … sets how many joists, rafters and posts get cut."
  const longer = { ...base, lengthFt: base.lengthFt * 2 };
  for (const role of ['joist', 'rafter', 'post']) {
    assert.ok(count(longer, role) > count(base, role), `length must add ${role}s`);
  }

  // "Width … sets how far joists reach and how long rafters are." Reach, not count.
  const wider = { ...base, widthFt: base.widthFt + 8 };
  assert.ok(maxLen(wider, 'joist') > maxLen(base, 'joist'), 'width must lengthen joists');
  assert.ok(maxLen(wider, 'rafter') > maxLen(base, 'rafter'), 'width must lengthen rafters');

  // "0 sets the sills at grade and cuts no posts at all. Above 0 stands the floor on posts."
  assert.equal(count({ ...base, crawlFt: 0 }, 'post'), 0, 'a slab design must cut no posts');
  assert.ok(count({ ...base, crawlFt: 2 }, 'post') > 0, 'a crawl space must stand on posts');

  // "Steeper means longer rafters and more sheathing."
  const steep = { ...base, risePer12: 9 };
  assert.ok(maxLen(steep, 'rafter') > maxLen({ ...base, risePer12: 1 }, 'rafter'), 'pitch lengthens rafters');
  assert.ok(count(steep, 'roofPanel') >= count({ ...base, risePer12: 1 }, 'roofPanel'), 'pitch adds sheathing');

  // "How far the rafters run past the wall."
  assert.ok(maxLen({ ...base, overhangFt: 3 }, 'rafter') > maxLen({ ...base, overhangFt: 0 }, 'rafter'),
    'overhang lengthens rafters');

  // "16\" OC packs more members into the same run … 24\" OC uses fewer."
  const at = (n: 16 | 24) => generateFrame({ ...base, studSpacingIn: n, joistSpacingIn: n, rafterSpacingIn: n }).members.length;
  assert.ok(at(16) > at(24), '16in OC must produce more members than 24in OC');
});

// STAGE_BOM is meant to PARTITION the bill: every billed line is drawn during exactly one step.
// If a line were claimed by no stage it would appear in the totals and in no build step at all —
// materials you are billed for but never told to draw. If claimed by two, the per-stage lists
// would double-count it. Neither is visible from any single panel, so it is asserted here.
test('SAP-1: every billed line belongs to exactly one build step', () => {
  for (const positionType of Object.keys(positions)) {
    for (const revetment of ['none', 'sandbag_facing', 'pickets_wire', 'timber_plywood']) {
      for (const threat of ['none', 'ind-art-105', 'at-rpg']) {
        const r = compute(defaultInputs({
          positionType, revetment, threat, overheadCover: true, camouflage: true, sump: true,
        }));
        const ctx = `${positionType}/${revetment}/${threat}`;
        const steps = computeStages(r).steps;
        for (const line of r.bom) {
          const owners = steps.filter((s) => s.bom.some((b) => b.id === line.id));
          assert.equal(owners.length, 1,
            `${ctx}: "${line.label}" is drawn in ${owners.length} steps, not exactly 1`);
        }
      }
    }
  }
});

// The spreadsheet is the one surface a logistics request gets built from, and it carried the bill
// without the build order — so it could not answer "what must be on site before step 4".
test('SAP-1: the CSV export carries the build order, not just the bill', () => {
  const r = compute(defaultInputs({
    threat: 'at-rpg', overheadCover: true, camouflage: true, revetment: 'pickets_wire', sump: true, count: 3,
  }));
  const csv = toCsv(r, { scenario: 'Sweep', date: '2026-07-13' });
  const rows = csv.split('\r\n');

  // Every billed row names the step that draws it.
  const bomRows = rows.filter((l) => l.startsWith('BOM,'));
  assert.equal(bomRows.length, r.bom.length, 'every billed line is exported');
  for (const line of bomRows) {
    const step = line.split(',')[1];
    assert.match(step ?? '', /^\d+$/, `a billed row has no build step: ${line}`);
  }

  // The sequence itself is exported, in order, with every step — including the ones that draw
  // nothing, which are exactly the steps a bill-only export used to lose.
  const seq = rows.filter((l) => l.startsWith('Sequence,')).map((l) => l.split(','));
  const steps = computeStages(r).steps;
  assert.equal(seq.length, steps.length, 'every step is exported, including the empty ones');
  seq.forEach((cells, i) => {
    assert.equal(Number(cells[1]), i + 1, 'steps are numbered in build order');
    assert.ok((cells[2] ?? '').includes(steps[i]!.label.split(' —')[0]!), `step ${i + 1} label matches the plan`);
  });
  // The engineer hand-off reaches the spreadsheet too, at zero hours.
  assert.match(csv, /Sequence,\d+,"?Overhead cover — by engineer/, 'handoff step missing from the CSV');
});

// "Every option available" is checkable, not aspirational: every row in a doctrine table must be
// selectable in the planner. A doctrine row with no control is an option the user cannot choose
// and no panel would ever reveal — the engine would simply never see it. This fails the moment a
// table gains an entry that nobody wires to a dropdown.
test('SAP-1: every doctrine option is reachable from the controls', () => {
  const valuesOf = (threat: string): Set<string> => {
    const html = controlsHtml(compute(defaultInputs({ threat })).inputs);
    return new Set([...html.matchAll(/value="([^"]+)"/g)].map((m) => m[1]!));
  };
  const base = valuesOf('none');
  for (const [table, ids] of [
    ['position', Object.keys(positions)],
    ['soil', Object.keys(soils)],
    ['revetment', Object.keys(revetments)],
    ['standard', Object.keys(standards)],
  ] as const) {
    for (const id of ids) assert.ok(base.has(id), `${table} "${id}" has no control — unreachable`);
  }

  // Threats cascade off the class picker, so each is checked against its OWN class's render:
  // every threat appears under its class, and no class leaks another's munitions into the list.
  for (const cls of threatClasses) {
    const own = Object.entries(threats).filter(([, d]) => d.class === cls.id).map(([k]) => k);
    assert.ok(own.length > 0, `threat class "${cls.id}" has no munitions at all`);
    const shown = valuesOf(own[0]!);
    for (const id of own) assert.ok(shown.has(id), `threat "${id}" unreachable under ${cls.id}`);
    for (const [id, d] of Object.entries(threats)) {
      if (d.class !== cls.id) {
        assert.ok(!shown.has(id), `${cls.id} leaks "${id}" from ${d.class}`);
      }
    }
  }
});

// The 3D holds one bay at final depth, so "hasty scrape" already shows the finished cut and the
// step after it — the biggest labor item in the plan — can look like it does nothing. The caption
// says so on that step, and ONLY that step: a caveat repeated everywhere is noise, and one that
// leaked onto the warning channel would read as a fault in the design rather than a limit of the
// drawing.
test('SAP-1: the scrubber admits the model does not stage depth, on the step that needs it', () => {
  const r = compute(defaultInputs({ overheadCover: true, camouflage: true, revetment: 'pickets_wire' }));
  const NOTE = /model draws the finished cut/i;
  STAGE_ORDER.forEach((s, i) => {
    const cap = stageCaption(i, r);
    if (s.id === 'hasty') {
      assert.match(cap, NOTE, 'the hasty scrape must admit the model shows the full cut');
      // It is a note about the drawing, not a warning about the design: the caption's <em> is
      // warn-coloured, so this one carries its own class to opt out of that channel.
      assert.match(cap, /class="stage-modelnote"/, 'the caveat must not use the warning channel');
    } else {
      assert.doesNotMatch(cap, NOTE, `step ${i + 1} (${s.id}) repeats the caveat`);
    }
  });
  // And it never displaces the real content of that step.
  const hasty = stageCaption(STAGE_ORDER.findIndex((s) => s.id === 'hasty'), r);
  assert.match(hasty, /Hasty scrape/, 'the step still names itself');
  assert.match(hasty, /man-hrs?/, 'the step still carries its labor');
});

// Everything a user reads must name the thing they picked, not the key the code filed it under.
// The job sheet a crew carries to the site printed "at-rpg", "sand" and "deliberate" while the
// screen beside it said "RPG (shaped charge)", "Sand" and "Deliberate" — and the engineer hand-off
// block, the page you physically hand to a qualified designer, listed the threat as a slug too.
// Only the position was resolved, so one table mixed labels and internal ids row by row.
test('SAP-1: no export surface prints a raw doctrine id', () => {
  for (const threat of ['at-rpg', 'ind-art-105', 'none']) {
    for (const soil of Object.keys(soils)) {
      const r = compute(defaultInputs({
        threat, soil, standard: 'reinforced', positionType: 'mg_crew',
        overheadCover: true, camouflage: true, revetment: 'pickets_wire',
      }));
      const surfaces = {
        sheet: jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' }),
        csv: toCsv(r, { scenario: 'Sweep', date: '2026-07-13' }),
      };
      // The id and its label differ for every one of these, so finding the id in a "field" cell
      // means the raw key reached paper.
      const pairs: [string, string][] = [
        [soil, soilLabel(soil)],
        ['reinforced', standardLabel('reinforced')],
        ['mg_crew', positionLabel('mg_crew')],
        ...(threat === 'none' ? [] : ([[threat, threatLabel(threat)]] as [string, string][])),
      ];
      for (const [name, out] of Object.entries(surfaces)) {
        for (const [id, label] of pairs) {
          assert.notEqual(id, label, `fixture: "${id}" must differ from its label to be a real test`);
          assert.ok(out.includes(label), `${name}: "${label}" never printed (${threat}/${soil})`);
          assert.ok(!out.includes('>' + id + '<') && !out.includes(',' + id + '\r'),
            `${name}: raw id "${id}" reached the output (${threat}/${soil})`);
        }
      }
    }
  }
});

// A wall's framed run was worked out in the engine (which subtracts a sill thickness for the E/W
// walls that fit BETWEEN the N/S ones) and then written a second time in the render layer WITHOUT
// the subtraction. The printed plate-layout strip therefore drew the East and West rulers a sill
// thickness too long: a carpenter marking from that sheet measures to 30'-0" on a plate that is
// 29'-10 1/2". Anchored to the generator itself — the run every surface measures from must equal
// the plate the generator actually cuts, so neither can drift from the other again.
test('TIMBER-1: the shared wall run equals the plate the generator cuts', () => {
  const designs = [
    defaultBuilding(),
    { ...defaultBuilding(), lengthFt: 8, widthFt: 8 },
    { ...defaultBuilding(), lengthFt: 60, widthFt: 40 },
    { ...defaultBuilding(), lengthFt: 24, widthFt: 24 },
  ];
  for (const b of designs) {
    const plates = generateFrame(b).members.filter((m) => m.role === 'solePlate');
    assert.equal(plates.length, 4, `${b.lengthFt}x${b.widthFt}: expected one sole plate per wall`);
    for (const p of plates) {
      const wall = p.id[0]!; // ids are "S-solePlate-01"
      assert.ok('SNEW'.includes(wall), `unexpected wall id in ${p.id}`);
      assert.ok(Math.abs(p.cutLength - wallRunFt(b, wall) * 12) < 1e-6,
        `${b.lengthFt}x${b.widthFt} ${wall}: run ${wallRunFt(b, wall) * 12}" vs plate ${p.cutLength}"`);
    }
    // And the E/W run really is shorter — otherwise this test would pass on the old, wrong code.
    assert.ok(wallRunFt(b, 'E') < b.widthFt, 'E/W walls must lose a sill thickness');
    assert.equal(wallRunFt(b, 'S'), b.lengthFt, 'N/S walls span the full length');
  }
});

// SAP-1's stage plan is asserted to partition its position total exactly; TIMBER-1's had no such
// check. A stage total that did not sum to the whole frame would mean members you are told to cut
// at no step, or counted twice across two — and the rail shows one step at a time, so neither is
// visible from the screen. Anchored to the model's own member list, not just to the summary's
// self-reported total, so a bug that corrupted both consistently still fails.
test('TIMBER-1: per-stage totals partition the whole frame exactly', () => {
  const variants: Array<[string, Partial<ReturnType<typeof defaultBuilding>>]> = [
    ['default', {}],
    ['slab on grade', { crawlFt: 0 }],
    ['flat roof', { risePer12: 0 }],
    ['no openings', { openings: [] }],
    ['24in framing', { studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24 }],
    ['largest', { lengthFt: 60, widthFt: 40 }],
    ['smallest', { lengthFt: 8, widthFt: 8 }],
  ];
  for (const [label, over] of variants) {
    const b = { ...defaultBuilding(), ...over };
    const members = generateFrame(b).members;
    const bom = bomSummary(members);
    const sum = (pick: (s: BomSummary['stages'][number]) => number): number =>
      bom.stages.reduce((a, s) => a + pick(s), 0);

    assert.ok(Math.abs(sum((s) => s.manHours) - bom.totalManHours) < 1e-6, `${label}: man-hours drift`);
    assert.ok(Math.abs(sum((s) => s.boardFeet) - bom.totalBoardFeet) < 1e-6, `${label}: board feet drift`);
    assert.equal(sum((s) => s.memberCount), bom.totalMembers, `${label}: member count drift`);
    // Every member the engine generated is claimed by exactly one stage.
    assert.equal(sum((s) => s.memberCount), members.length, `${label}: a member belongs to no stage`);
  }
});

// The sequence's SHAPE, independent of any one design. The rail groups steps under phase headings
// and a user reads it top to bottom as the order to build in, so the phases must run in their
// declared order and each must be contiguous — a stray "Walls" step sitting between two "Roof"
// ones would render as a second Walls heading further down the rail and read as "go back and frame
// more wall after the rafters are up". Nothing in the types prevents that; this does.
test('TIMBER-1: the build sequence is structurally well-formed', () => {
  // Ids are 1..N with no gaps, so "Step 7 of 11" always means the 7th thing you do.
  STAGES.forEach((s, i) => {
    assert.equal(s.id, i + 1, `stage at index ${i} is numbered ${s.id}`);
    assert.ok(s.name.trim().length > 0, `stage ${s.id} has no name`);
    assert.ok(s.does.trim().length > 0, `stage ${s.id} does not say what it is for`);
    assert.ok((STAGE_PHASES as readonly string[]).includes(s.phase), `stage ${s.id}: unknown phase "${s.phase}"`);
  });

  // Phases appear in declared order and never resume once left.
  const seen = STAGES.map((s) => s.phase);
  const firstAppearance = [...new Set(seen)];
  assert.deepEqual(firstAppearance, STAGE_PHASES.filter((p) => seen.includes(p)),
    'phases are out of order relative to STAGE_PHASES');
  for (const phase of firstAppearance) {
    const idx = seen.reduce<number[]>((a, p, i) => (p === phase ? [...a, i] : a), []);
    assert.equal(idx[idx.length - 1]! - idx[0]!, idx.length - 1,
      `phase "${phase}" is split across the sequence — its steps are not contiguous`);
  }

  // Framing comes before the trades TIMBER-1 does not model. An unframed step in the middle would
  // put "finish work — not framed" between two steps that still cut lumber.
  const lastFramed = STAGES.map((s) => s.framed).lastIndexOf(true);
  const firstUnframed = STAGES.map((s) => s.framed).indexOf(false);
  if (firstUnframed !== -1) {
    assert.ok(firstUnframed > lastFramed,
      'an unmodelled trade is scheduled before framing finishes');
  }
});

// Two openings cannot share a run of wall — and nothing checked it. The editor's own "+ Window"
// button seeded every new opening at the same fixed offset, so clicking it twice stacked two
// openings at one spot; the generator framed both, emitting two full sets of king studs, jack
// studs, headers, sills and cripples at IDENTICAL coordinates, all of it billed in the cut list,
// with no warning on any surface.
test('TIMBER-1: overlapping openings are reported, touching ones are not', () => {
  const at = (wall: 'S' | 'N', offsetFt: number, widthFt = 3) =>
    ({ wall, offsetFt, widthFt, heightFt: 3.5, sillHeightFt: 3 });
  const problemsFor = (openings: ReturnType<typeof at>[]) =>
    designProblems({ ...defaultBuilding(), openings }).filter((m) => /overlap/i.test(m));

  assert.equal(problemsFor([at('S', 2), at('S', 2)]).length, 1, 'two identical openings must be flagged');
  assert.equal(problemsFor([at('S', 2), at('S', 4)]).length, 1, 'a partial overlap must be flagged');
  assert.equal(problemsFor([at('S', 2), at('S', 3), at('S', 4)]).length, 3, 'every overlapping pair is named');
  // Touching is deliberately allowed: how much wall must separate two openings is a framing rule
  // this tool has no verified value for, so it is not asserted as one.
  assert.equal(problemsFor([at('S', 2), at('S', 5)]).length, 0, 'openings that merely touch are fine');
  assert.equal(problemsFor([at('S', 2), at('S', 6)]).length, 0, 'openings clear of each other are fine');
  assert.equal(problemsFor([at('S', 2), at('N', 2)]).length, 0, 'the same offset on a different wall is fine');
});

// The structural consequence of the above, stated independently of how it is detected: if the
// design reports no problems, no two members may occupy the same point. Coincident members mean
// lumber specified — and billed — twice in one place. (Designs that ARE flagged can produce them,
// which is why the check is conditional rather than absolute: being told the design is wrong is
// the correct outcome there.)
test('TIMBER-1: a design with no reported problems frames no two members in the same place', () => {
  const variants: Array<[string, Partial<ReturnType<typeof defaultBuilding>>]> = [
    ['default', {}],
    ['slab on grade', { crawlFt: 0 }],
    ['flat roof', { risePer12: 0 }],
    ['no openings', { openings: [] }],
    ['24in framing', { studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24 }],
    ['largest', { lengthFt: 60, widthFt: 40 }],
    ['one opening per wall', { openings: (['S', 'N', 'E', 'W'] as const).map((wall) =>
      ({ wall, offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 })) }],
  ];
  for (const [label, over] of variants) {
    const b = { ...defaultBuilding(), ...over };
    assert.deepEqual(designProblems(b), [], `fixture "${label}" must be a clean design`);
    const seen = new Map<string, string[]>();
    for (const m of generateFrame(b).members) {
      const key = m.role + '@' + m.position.map((v) => v.toFixed(4)).join(',');
      seen.set(key, [...(seen.get(key) ?? []), m.id]);
    }
    const coincident = [...seen.entries()].filter(([, ids]) => ids.length > 1);
    assert.equal(coincident.length, 0,
      `${label}: ${coincident.length} position(s) framed twice, e.g. ${coincident[0]?.[1].join(' + ')}`);
  }
});

// The printed sheet is the copy that goes to the ground being dug, and it stated a labour total
// with none of the caveats that qualify it. The engine publishes them, the screen shows them and
// the CSV writes every line — the sheet dropped all of it, so paper claimed a timeline without
// saying the rates are illustrative placeholders, or that an engineered roof's labour is not in
// the number at all.
test('SAP-1: the printed sheet states what its labour figure assumes', () => {
  for (const [label, over] of [
    ['earth roof', { threat: 'ind-art-105' }],
    ['engineered roof', { threat: 'at-rpg' }],
    ['machine assisted', { threat: 'ind-art-105', machineAssist: true }],
  ] as [string, Record<string, unknown>][]) {
    const r = compute(defaultInputs({ ...over, overheadCover: true, camouflage: true }));
    const sheet = jobSheet(r, { scenario: 'Sweep', date: '2026-07-13' });
    assert.ok(r.labor.assumptions.length > 0, `${label}: fixture publishes no assumptions`);
    for (const a of r.labor.assumptions) {
      assert.ok(sheet.includes(escHtml(a)), `${label}: sheet dropped "${a}"`);
    }
    // The one that must never be missing from a field document, however the design is configured.
    assert.match(sheet, /ILLUSTRATIVE placeholders/i, `${label}: sheet does not disclose placeholder rates`);
  }

  // An engineered roof contributes no labour, and the sheet has to say so beside the total —
  // otherwise the printed hours read as covering the whole position, roof included.
  const eng = compute(defaultInputs({ threat: 'at-rpg', overheadCover: true }));
  assert.match(jobSheet(eng, { scenario: 'S', date: '2026-07-13' }), /labor is NOT included/i);
});

// When the time planner finds nothing that fits, the panel offers one option as "closest
// over-budget". It was taking the highest-PROTECTION option — which is the one furthest over
// budget — so a team with 6 hours was told the closest was 98.9 hr when the quickest build was
// 46.1 hr: a 93-hour shortfall reported for a 40-hour one. The nearest miss is the floor on the
// job, and the only figure a leader can act on.
test('SAP-1: when nothing fits, the planner offers the option nearest to fitting', () => {
  const base = defaultInputs({ positionType: 'bunker_op_cp', soil: 'sand', count: 3 });
  const everything = planForTime({ availableHours: 1e6, teamSize: 2, base });
  assert.ok(everything.feasible.length > 1, 'fixture must produce a spread of options');
  assert.equal(everything.infeasibleBest, null, 'nothing is over budget when the budget is huge');

  for (const availableHours of [0.5, 6, 20]) {
    const res = planForTime({ availableHours, teamSize: 2, base });
    assert.equal(res.feasible.length, 0, `fixture: ${availableHours} hr should fit nothing`);
    const best = res.infeasibleBest;
    assert.ok(best, `${availableHours} hr: no guidance offered at all`);

    // It is the quickest of everything that did not fit…
    const overBudget = everything.feasible.filter((o) => o.elapsedHours > availableHours);
    const quickestValid = Math.min(...overBudget.filter((o) => !o.hasErrors).map((o) => o.elapsedHours));
    assert.equal(best!.elapsedHours, quickestValid,
      `${availableHours} hr: offered ${best!.elapsedHours} hr, nearest valid miss is ${quickestValid} hr`);

    // …and never a combination the app's own validation rejects, however quick it is.
    assert.equal(best!.hasErrors, false,
      `${availableHours} hr: offered a design the app itself rejects as the way to make budget`);
    const anyQuicker = overBudget.some((o) => o.elapsedHours < best!.elapsedHours && !o.hasErrors);
    assert.equal(anyQuicker, false, `${availableHours} hr: a quicker valid build existed`);
  }
});

// The build-sequence stepper lives on the 3D card and was gated entirely on WebGL, so a device
// that cannot render 3D lost the only walk-the-build-in-order control on the main screen — with
// nothing pointing at the build schedule, which is a table and needs no WebGL at all. The card
// also told that device to "drag to turn it around" over a static SVG.
//
// renderApp had no test coverage before this: it dereferenced the bundler-injected import.meta.env
// unconditionally, which throws under a bare runtime. Only `layoutMode` is read off the state, so
// a minimal object is a faithful stand-in.
test('SAP-1: a device without WebGL still gets a route into the build sequence', () => {
  const r = compute(defaultInputs({ overheadCover: true, camouflage: true }));
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];
  const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const withGl = renderApp(state, r, true, false);
  assert.match(withGl, /three-scrubber/, 'the stepper must be there when 3D works');
  assert.match(withGl, /three-stage-caption/, 'and it must name the stage it is parked on');
  assert.match(strip(withGl), /drag to turn/, 'a live model says it can be turned');

  const noGl = renderApp(state, r, false, false);
  assert.doesNotMatch(noGl, /three-scrubber/, 'there is no model to scrub without WebGL');
  assert.doesNotMatch(strip(noGl), /drag to turn/, 'a static image must not claim to be draggable');
  assert.match(strip(noGl), /Step-by-step build order/, 'the sequence must still be findable');
  assert.match(noGl, /data-action="schedule"/, 'and reachable in one press');

  // The dev-only breakpoint picker is a QA affordance and must never reach a built page; it is
  // also the expression that used to make this whole function untestable.
  for (const [name, html] of [['withGl', withGl], ['noGl', noGl]] as const) {
    assert.doesNotMatch(html, /layout-override/, `${name}: dev-only layout override leaked`);
  }
});

// Soil difficulty must scale the DIGGING, not the fixed cost of starting a hole. Each doctrine
// leaf says which term it belongs to — perVolMH is "excavation labor per bank ft³", digFactor is
// "×labor multiplier for excavation difficulty", baseMH is "base per-position labor" — but
// digFactor was multiplied into baseMH and left off the per-volume term entirely. Soil therefore
// barely moved the timeline of a big excavation: a vehicle turret defilade in frozen ground
// planned at 227 man-hours against the ~750 its own doctrine implies. Nothing caught it, because
// no test asserted soil had any effect on labour at all.
test('SAP-1: soil difficulty scales the excavation, not the flat per-position cost', () => {
  const bare = { revetment: 'none', sump: false, overheadCover: false, camouflage: false, threat: 'none' };
  const base = laborDoctrine.baseMH.value;

  for (const positionType of ['two_man', 'bunker_op_cp', 'vehicle_turret_defilade']) {
    const mhFor = (soil: string) =>
      compute(defaultInputs({ ...bare, positionType, soil })).labor.manHoursPerPosition;
    const loamDig = mhFor('loam') - base;
    assert.ok(loamDig > 0, `${positionType}: fixture has no excavation to scale`);

    for (const soil of Object.keys(soils)) {
      const factor = soils[soil]!.digFactor.value;
      const dig = mhFor(soil) - base;
      // Published man-hours are rounded to 1 dp, so compare proportionally with a small tolerance.
      const ratio = dig / loamDig;
      assert.ok(Math.abs(ratio - factor) / factor < 0.02,
        `${positionType}/${soil}: dig scaled ×${ratio.toFixed(3)}, doctrine says ×${factor}`);
    }
  }
});

// The other half of the same rule: the flat term is NOT soil-scaled. Two positions in rock differ
// only by their excavation, so the fixed cost must cancel out of the difference.
test('SAP-1: the flat per-position labour is the same in rock as in loam', () => {
  const bare = { revetment: 'none', sump: false, overheadCover: false, camouflage: false, threat: 'none' };
  const base = laborDoctrine.baseMH.value;
  const rockDig = compute(defaultInputs({ ...bare, positionType: 'two_man', soil: 'rock' }))
    .labor.manHoursPerPosition - base;
  const loamDig = compute(defaultInputs({ ...bare, positionType: 'two_man', soil: 'loam' }))
    .labor.manHoursPerPosition - base;
  // If the flat term were still being multiplied by digFactor, subtracting a single baseMH would
  // leave 2 extra baseMH in the rock figure and this ratio would land near 2.9, not 3.
  assert.ok(Math.abs(rockDig / loamDig - soils['rock']!.digFactor.value) < 0.06,
    'the fixed per-position cost is being scaled by soil');
});

// The app prints its own account of how the man-hour figure was derived, on screen and now on
// paper. That account makes three checkable claims, so they are checked here rather than left as
// prose that can drift away from the formula it describes.
test('SAP-1: the labour model does what the app says it does', () => {
  const bare = { revetment: 'none', sump: false, overheadCover: false, camouflage: false, threat: 'none' };
  const mh = (o: Record<string, unknown>) =>
    compute(defaultInputs({ ...bare, ...o })).labor.manHoursPerPosition;
  const sizes = ['two_man', 'mg_crew', 'bunker_op_cp', 'vehicle_turret_defilade'];
  const rockFactor = soils['rock']!.digFactor.value;

  // Claim 1: "one flat base rate (the same for every position type)". The base is the intercept —
  // recover it by removing the soil-scaled dig, which is the only other term left in `bare`.
  const bases = sizes.map((positionType) => {
    const loam = mh({ positionType, soil: 'loam' });
    const rock = mh({ positionType, soil: 'rock' });
    const digAtLoam = (rock - loam) / (rockFactor - 1); // dig portion at ×1
    return loam - digAtLoam;
  });
  for (const b of bases) {
    assert.ok(Math.abs(b - laborDoctrine.baseMH.value) < 0.2,
      `implied base ${b.toFixed(2)} mh differs from the doctrine base ${laborDoctrine.baseMH.value}`);
  }
  assert.ok(Math.max(...bases) - Math.min(...bases) < 0.2,
    'the base rate is NOT the same for every position type, as the model description claims');

  // Claim 2: overhead cover, revetment and camouflage "each add a fixed amount that does not grow
  // with the position" — the same switch must cost the same on a foxhole and on a bunker, in any
  // soil. (An earlier version of the description put sumps in this group too; measuring showed it
  // was wrong, which is the reason these assertions exist.)
  const fixedAdders: [string, Record<string, unknown>, number][] = [
    ['camouflage', { camouflage: true }, laborDoctrine.camoAdd.value],
    ['revetment', { revetment: 'pickets_wire' }, laborDoctrine.revetAdd.value],
    ['overhead cover', { overheadCover: true, threat: 'ind-art-105' }, laborDoctrine.overheadAdd.value],
  ];
  for (const [label, on, expected] of fixedAdders) {
    const deltas: number[] = [];
    for (const positionType of sizes) {
      for (const soil of ['loam', 'rock']) {
        const base = mh({ positionType, soil, ...(on['threat'] ? { threat: on['threat'] } : {}) });
        deltas.push(mh({ positionType, soil, ...on }) - base);
      }
    }
    for (const d of deltas.filter((x) => x !== 0)) {
      assert.ok(Math.abs(d - expected) < 0.15, `${label}: adds ${d.toFixed(2)} mh, doctrine says ${expected}`);
    }
    const live = deltas.filter((x) => x !== 0);
    assert.ok(Math.max(...live) - Math.min(...live) < 0.15,
      `${label}: the adder grows with position size or soil, contradicting the model description`);
  }

  // Claim 3: sumps "add a fixed amount plus the earth they move" — so the delta must EXCEED the
  // flat adder wherever a sump is actually dug, and must grow in harder ground.
  const sumpAt = (positionType: string, soil: string) =>
    mh({ positionType, soil, sump: true }) - mh({ positionType, soil });
  const dug = sizes.filter((p) => sumpAt(p, 'loam') > 0);
  assert.ok(dug.length > 0, 'fixture: no position in this set digs a sump');
  for (const positionType of dug) {
    const loam = sumpAt(positionType, 'loam');
    const rock = sumpAt(positionType, 'rock');
    assert.ok(loam > laborDoctrine.sumpAdd.value,
      `${positionType}: sump costs only the flat adder — its excavation is not being charged`);
    assert.ok(rock > loam,
      `${positionType}: sump costs the same in rock as in loam — its earth is not soil-scaled`);
  }
});

// positions.ts requires the volume-model statement to be an honest account of the formula —
// "formulas get the same honesty treatment as constants". It described only the CUT, while the
// engine digs holeVol + platformVol + sumpVol + rampVol, so the three positions with a firing
// platform reported up to 17% more spoil than the stated formula yields. Each clause of the
// corrected sentence is held to the numbers here.
test('SAP-1: the excavation is the cut PLUS the platform and sumps, as the model says', () => {
  const bare = { revetment: 'none', sump: false, overheadCover: false, camouflage: false, threat: 'none' };
  const bank = (o: Record<string, unknown>) => {
    const r = compute(defaultInputs({ ...bare, ...o }));
    const loose = r.bom.find((b) => b.id === 'excavation_loose')?.qtyPerPosition ?? 0;
    return { vol: loose / excavation.swellFactor.value, r };
  };
  const oneSump = sump.L.value * sump.W.value * sump.D.value;

  for (const positionType of Object.keys(positions)) {
    const row = positions[positionType]!;
    if (row.volumeModel === 'prism_ramp') continue; // ramp wedge is covered by its own clause below
    const { vol, r } = bank({ positionType });
    const box = r.resolved.holeL * r.resolved.holeW * r.resolved.depthOfCut;
    const cut = row.volumeModel === 'cylinder' ? (Math.PI / 4) * box : box;
    const plat = row.firingPlatform
      ? row.firingPlatform.L.value * row.firingPlatform.W.value * row.firingPlatform.depthBelowHole.value
      : 0;
    assert.ok(Math.abs(vol - (cut + plat)) < 0.6,
      `${positionType}: dug ${vol.toFixed(1)} ft³, stated model gives ${(cut + plat).toFixed(1)} ft³`);
    // The platform clause must be doing real work where the position has one.
    if (row.firingPlatform) assert.ok(plat > 0 && vol > cut + 0.5, `${positionType}: platform not excavated`);
  }

  // "…and any grenade sumps dug" — switching them on adds exactly the sumps' own volume.
  for (const positionType of Object.keys(positions)) {
    const n = positions[positionType]!.grenadeSumps;
    const delta = bank({ positionType, sump: true }).vol - bank({ positionType }).vol;
    assert.ok(Math.abs(delta - n * oneSump) < 0.4,
      `${positionType}: sumps added ${delta.toFixed(2)} ft³, ${n} sump(s) measure ${(n * oneSump).toFixed(2)} ft³`);
  }

  // "a box cut plus the access-ramp wedge" — the ramp is the dominant term of a defilade, so the
  // dug volume must clearly exceed the bare box rather than merely differ from it.
  for (const positionType of ['vehicle_hull_defilade', 'vehicle_turret_defilade']) {
    const { vol, r } = bank({ positionType });
    const box = r.resolved.holeL * r.resolved.holeW * r.resolved.depthOfCut;
    assert.ok(vol > box * 1.1, `${positionType}: no ramp wedge in the excavation (${vol.toFixed(0)} vs box ${box.toFixed(0)})`);
  }
});

// The derivation panel is the app explaining its own arithmetic — click a number, see the formula
// and the operands that produced it. When the labour formula changed (digFactor moved onto the
// spoil term, where its doctrine says it belongs) this string was left describing the old one, so
// the panel told anyone who opened it that soil multiplies the flat rate — the very mistake the
// engine had just stopped making. Rather than re-check the wording by eye, the operands are
// evaluated here and must reproduce the result the panel prints beside them.
test('SAP-1: the man-hours derivation computes the number it claims to', () => {
  const cases = [
    { soil: 'loam', standard: 'deliberate' },
    { soil: 'rock', standard: 'reinforced', positionType: 'bunker_op_cp', camouflage: true },
    { soil: 'frozen', standard: 'hasty', positionType: 'mg_crew', sump: true, revetment: 'pickets_wire' },
    { soil: 'clay', machineAssist: true, overheadCover: true, threat: 'ind-art-105' },
  ];
  for (const over of cases) {
    const r = compute(defaultInputs(over as Record<string, unknown>));
    const d = r.derivations.find((x) => x.key === 'manHoursPerPosition');
    assert.ok(d, `${JSON.stringify(over)}: no man-hours derivation`);
    const v = (name: string): number => {
      const o = d!.operands.find((x) => x.name === name);
      assert.ok(o, `${JSON.stringify(over)}: derivation omits operand "${name}"`);
      return o!.value;
    };
    // Exactly the formula the panel prints: baseMH×laborMul + excavBank×perVolMH×digFactor×
    // machineFactor + adders. The formula used to say base/labor/spoil/perVol/dig/machine while the
    // operands beneath it were named baseMH/laborMul/excavBank/perVolMH/digFactor/machineFactor —
    // so this test had to translate between the two vocabularies, and so did every reader of a
    // panel whose entire job is showing the work. Same arrangement, one set of names.
    const adders = d!.operands
      .filter((o) => /Add$/.test(o.name))
      .reduce((a, o) => a + o.value, 0);
    const expected =
      v('baseMH') * v('laborMul') +
      v('excavBank') * v('perVolMH') * v('digFactor') * v('machineFactor') +
      adders;
    assert.ok(Math.abs(expected - d!.result) < 0.06,
      `${JSON.stringify(over)}: operands give ${expected.toFixed(3)}, panel shows ${d!.result}`);
    // …and the printed formula names the terms in that arrangement, so the words and the
    // arithmetic cannot drift apart independently.
    assert.match(d!.formula, /baseMH×laborMul/, 'formula no longer matches the operand arrangement');
    assert.match(d!.formula, /perVolMH×digFactor/, 'formula still puts soil on the spoil term, not the flat one');
    // Every name the formula uses must exist in the list below it — that correspondence is the
    // whole point of the panel, and it is what had quietly lapsed.
    for (const term of d!.formula.split(/[+×]/).map((t) => t.trim()).filter(Boolean)) {
      assert.ok(d!.operands.some((o) => o.name === term), `formula term "${term}" has no operand row`);
    }
  }
});

// The spoil derivation exists to account for a number, and it named "(bay + platform + sumps)"
// while the engine also digs the access ramp — which on a turret defilade is 1,080 of 2,664 ft³,
// so 41% of the excavation had no term in the formula that explains it. Each term must now appear
// exactly when that volume is actually dug, and when no extra term is named the bank volume must
// BE the bare cut — otherwise something unnamed is again hiding inside it.
test('SAP-1: the spoil formula names every volume it actually digs', () => {
  const bare = { revetment: 'none', overheadCover: false, camouflage: false, threat: 'none' };
  for (const positionType of Object.keys(positions)) {
    const row = positions[positionType]!;
    for (const sumpOn of [false, true]) {
      const r = compute(defaultInputs({ ...bare, positionType, sump: sumpOn }));
      const d = r.derivations.find((x) => x.key === 'excavLoose');
      assert.ok(d, `${positionType}: no spoil derivation`);
      const ctx = `${positionType}/sump=${sumpOn}`;

      const hasPlatform = row.firingPlatform !== undefined;
      const hasSumps = sumpOn && row.grenadeSumps > 0;
      const hasRamp = row.volumeModel === 'prism_ramp';
      assert.equal(/\bplatform\b/.test(d!.formula), hasPlatform, `${ctx}: platform term wrong in "${d!.formula}"`);
      assert.equal(/\bsumps\b/.test(d!.formula), hasSumps, `${ctx}: sumps term wrong in "${d!.formula}"`);
      assert.equal(/\bramp\b/.test(d!.formula), hasRamp, `${ctx}: ramp term wrong in "${d!.formula}"`);

      // With nothing but the bay named, the operand must equal the bare cut for this model.
      if (!hasPlatform && !hasSumps && !hasRamp) {
        const bank = d!.operands.find((o) => o.name === 'excavBank')!.value;
        const box = r.resolved.holeL * r.resolved.holeW * r.resolved.depthOfCut;
        const cut = row.volumeModel === 'cylinder' ? (Math.PI / 4) * box : box;
        assert.ok(Math.abs(bank - cut) < 0.01,
          `${ctx}: formula names only the bay but the bank is ${bank.toFixed(1)} vs cut ${cut.toFixed(1)}`);
      }
    }
  }
});

// A derivation exists to explain a number the user is looking at, so its result must BE that
// number. Nothing tied the two together: the panel could drift onto a different figure — a
// per-position value where the screen shows a job total, a pre-rounding value, a stale field —
// and every other test would still pass while the explanation quietly described something else.
test('SAP-1: every derivation resolves to the value the app publishes', () => {
  const fromBom: Record<string, string> = {
    excavLoose: 'excavation_loose', sandbagsParapet: 'sandbags_parapet',
    coverSoilFill: 'cover_soil_fill', pickets: 'pickets', revetWire: 'revet_wire',
    gravelSump: 'gravel_sump', camoNet: 'camo_net', stringers: 'stringers',
  };
  const fromResult: Record<string, (r: ReturnType<typeof compute>) => number> = {
    depthOfCut: (r) => r.resolved.depthOfCut,
    setback: (r) => r.resolved.setback,
    coverThickness: (r) => r.cover.thickness,
    manHoursPerPosition: (r) => r.labor.manHoursPerPosition,
    manHoursTotal: (r) => r.labor.manHoursTotal,
    elapsed: (r) => r.labor.elapsedHours,
  };

  let checked = 0;
  for (const positionType of Object.keys(positions)) {
    for (const soil of ['loam', 'rock']) {
      for (const count of [1, 4]) {
        const r = compute(defaultInputs({
          positionType, soil, count, revetment: 'pickets_wire', sump: true,
          overheadCover: true, camouflage: true, threat: 'ind-art-105',
        }));
        for (const d of r.derivations) {
          const published = fromBom[d.key]
            ? r.bom.find((b) => b.id === fromBom[d.key])?.qtyPerPosition
            : fromResult[d.key]?.(r);
          if (published === undefined) continue; // no single published counterpart (e.g. ratios)
          checked++;
          // Both sides are already rounded for display; they must agree to that precision.
          assert.ok(Math.abs(published - d.result) <= 0.051,
            `${positionType}/${soil}/n=${count} — "${d.label}" explains ${d.result} but the app shows ${published}`);
        }
      }
    }
  }
  assert.ok(checked > 400, `only ${checked} derivation/published pairs compared — coverage collapsed`);
});

// codes.ts says of itself: "keeping them here means a test can assert every code is reachable and
// that codes never silently change severity". That test did not exist. An unreachable code is a
// safety check that can never fire — the kind of thing that looks like coverage in a catalog and
// is nothing in the field.
//
// Note the hasty/earth-roof case below: a first sweep of 13,600 configurations pinned the standard
// to 'deliberate' and concluded COVER_UNDER_THREAT was dead. It is not — it fires only on a hasty
// roof, which is exactly the combination that sweep never tried. Breadth is not coverage.
test('SAP-1: every validation code can actually fire', () => {
  const seen = new Set<string>();
  // Reaches every validation code, several of which only fire on ids doctrine does not have.
  const run = (o: Record<string, unknown>) =>
    compute(defaultInputs(o, { allowUnknownIds: true })).validation.forEach((v) => seen.add(v.code));

  for (const positionType of Object.keys(positions)) {
    for (const soil of Object.keys(soils)) {
      for (const standard of ['hasty', 'deliberate', 'reinforced']) {
        for (const threat of ['none', 'sa-762', 'ind-mtr-81', 'ind-art-155', 'at-rpg', 'blast-vbied']) {
          for (const revetment of ['none', 'pickets_wire']) {
            run({ positionType, soil, standard, threat, revetment,
              overheadCover: true, sump: true, camouflage: true });
          }
        }
      }
    }
  }
  // Inputs the UI cannot produce but an imported file or a stale link can.
  for (const bad of [
    { positionType: '__nope' }, { soil: '__nope' }, { threat: '__nope' },
    { standard: '__nope' }, { revetment: '__nope' },
    { count: 0 }, { count: 99999 }, { teamSize: 0 }, { teamSize: 99999 },
    { positionType: 'vehicle_turret_defilade', machineAssist: false },
  ]) run(bad as Record<string, unknown>);

  const unreachable = Object.keys(CODES).filter((c) => !seen.has(c));
  assert.deepEqual(unreachable, [], `validation codes that can never fire: ${unreachable.join(', ')}`);

  // Severity is part of the contract — an error quietly demoted to advisory stops blocking a build.
  for (const [key, defn] of Object.entries(CODES)) {
    assert.equal(defn.code, key, `${key}: code string does not match its catalog key`);
    assert.ok(['error', 'warning', 'advisory'].includes(defn.severity), `${key}: unknown severity`);
    assert.ok(defn.message.trim().length > 20, `${key}: message is too thin to act on`);
  }
});

// "Step to shoot from" was offered identically on all ten positions and changed nothing on nine of
// them — no drawing, no material, no man-hour — with no way to tell that from the control. An
// option that silently does nothing is worse than an absent one: the user cannot tell whether the
// tool ignored them or the design simply looks the same. The control now says why it does not
// apply, and this holds that explanation to what the engine actually does.
test('SAP-1: the firing-step control tells the truth about whether it applies', () => {
  const DRAWS = /shoot over the front wall/;
  const hintFor = (positionType: string): string => {
    const html = controlsHtml(compute(defaultInputs({ positionType })).inputs);
    const seg = html.split('Step to shoot from')[1] ?? '';
    return (seg.match(/ctrl-hint">([^<]*)/) ?? [])[1] ?? '';
  };

  let applies = 0;
  for (const positionType of Object.keys(positions)) {
    const r = compute(defaultInputs({ positionType, firingStep: true }));
    const on = (r.geometry as { section?: { firingStepOn?: boolean } }).section?.firingStepOn === true;
    const hint = hintFor(positionType);
    assert.ok(hint.length > 0, `${positionType}: firing-step control has no hint at all`);
    assert.equal(DRAWS.test(hint), on,
      `${positionType}: hint says ${DRAWS.test(hint) ? 'it draws' : 'it does not'} but the engine says ${on}`);
    if (!on) assert.match(hint, /^Not used here/, `${positionType}: an inert option must say so`);
    if (on) applies++;
  }
  assert.ok(applies > 0, 'the firing step now applies nowhere — the control is entirely dead');

  // And the flag itself must not claim a step that nothing renders: a position dug WITH a firing
  // platform draws the platform profile and never reaches the step branch.
  for (const positionType of Object.keys(positions)) {
    if (!positions[positionType]!.firingPlatform) continue;
    const r = compute(defaultInputs({ positionType, firingStep: true }));
    const on = (r.geometry as { section?: { firingStepOn?: boolean } }).section?.firingStepOn === true;
    assert.equal(on, false, `${positionType}: claims a firing step on top of its firing platform`);
  }
});

// The drawing description is what a screen-reader user gets INSTEAD of the drawing, so every
// feature it names must be a feature the drawing contains. Two were keyed on the raw input rather
// than the resolved fact: ticking "grenade sumps" announced them on a mortar pit and both vehicle
// defilades, which dig none, and an unrecognised revetment id — which is not normalised away and
// resolves to the no-face row — announced "revetted walls" with nothing revetted, drawn or billed.
// A description that disagrees with the picture is worse than none: the two audiences are handed
// different structures and only one of them can check.
test('SAP-1: the drawing description names only features the drawing has', () => {
  for (const positionType of Object.keys(positions)) {
    for (const sumpOn of [false, true]) {
      for (const revetment of ['none', 'pickets_wire', '__unrecognised']) {
        // '__unrecognised' in the revetment list is deliberate: the drawing must describe what it
        // actually drew when the id is not one doctrine knows.
        const r = compute(defaultInputs({ positionType, sump: sumpOn, revetment, camouflage: true }, { allowUnknownIds: true }));
        const geo = r.geometry as GeometryModel;
        const said = describe(r, 'plan').desc;
        const ctx = `${positionType}/sump=${sumpOn}/revet=${revetment}`;

        assert.equal(/grenade sumps/.test(said), geo.plan.sumps.length > 0,
          `${ctx}: sump claim disagrees with the ${geo.plan.sumps.length} sump(s) drawn`);
        assert.equal(/elbow rests/.test(said), geo.plan.elbows.length > 0,
          `${ctx}: elbow claim disagrees with the drawing`);
        assert.equal(/revetted walls/.test(said), revetments[revetment]?.buildsFace === true,
          `${ctx}: revetment claim disagrees with what is actually built`);
        // The roof claims must agree with the resolved path, not with the request.
        assert.equal(/earth-on-stringers/.test(said), r.cover.roofPath === 'earth_on_stringers', `${ctx}: roof claim`);
        assert.equal(/engineered roof/.test(said), r.cover.roofPath === 'engineered_required', `${ctx}: engineered claim`);
      }
    }
  }
});

// One facing sentence was shared by the plan, the section and the iso, and was wrong on two of
// them: it named "the top of the plan" while reading out a SECTION (whose FRONT is at the left),
// and promised a FRONT label on the iso, which has none. This text stands IN PLACE of the picture
// for anyone who cannot see it, so each claim is checked against the drawing it is attached to —
// by finding the labels in the SVG, not by trusting the sentence.
test('SAP-1: each view’s description matches where that view puts its labels', () => {
  const at = (svg: string, word: string): { x: number; y: number } | null => {
    const m = svg.match(new RegExp(`<text[^>]*x="([-\\d.]+)"[^>]*y="([-\\d.]+)"[^>]*>${word}<`));
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  };
  const r = compute(defaultInputs({ positionType: 'two_man' }));

  // Plan: FRONT above REAR — the description says "top of the plan".
  const plan = drawPlan(r);
  const pf = at(plan, 'FRONT'), pr = at(plan, 'REAR');
  assert.ok(pf && pr && pf.y < pr.y, 'fixture: the plan should put FRONT above REAR');
  assert.match(describe(r, 'plan').desc, /top of the plan/);

  // Section: FRONT left of REAR — so "top of the plan" would be describing a different image.
  const section = drawSection(r);
  const sf = at(section, 'FRONT'), sr = at(section, 'REAR');
  assert.ok(sf && sr && sf.x < sr.x, 'fixture: the section should put FRONT left of REAR');
  const sectionDesc = describe(r, 'section').desc;
  assert.match(sectionDesc, /left of the section/);
  assert.doesNotMatch(sectionDesc, /top of the plan/, 'the section description points at the plan');

  // Iso: no FRONT label exists, so the description must not send the reader looking for one.
  const iso = drawIso(r);
  assert.equal(iso.includes('>FRONT<'), false, 'fixture: the iso is expected to carry no FRONT label');
  assert.ok(iso.includes('>ENEMY<'), 'fixture: the iso is expected to carry an ENEMY arrow');
  const isoDesc = describe(r, 'iso').desc;
  assert.match(isoDesc, /ENEMY arrow/);
  assert.doesNotMatch(isoDesc, /FRONT and REAR are labeled/, 'the iso promises a FRONT label it does not draw');

  // A through-route has no facing in ANY view, and no view may claim otherwise.
  const trench = compute(defaultInputs({ positionType: 'connecting_trench' }));
  for (const [view, svg] of [['plan', drawPlan(trench)], ['section', drawSection(trench)], ['iso', drawIso(trench)]] as const) {
    assert.equal(svg.includes('>FRONT<'), false, `${view}: a corridor must carry no FRONT label`);
    assert.match(describe(trench, view).desc, /no facing direction/, `${view}: corridor description`);
  }
});

// The 3D pane is a WebGL canvas and exposed no text at all, so the one thing showing the state of
// the build was silent to anyone not looking at it. Its description must track the SAME members
// the scene draws (rebuild() places every member with stage ≤ current), and must not read the same
// for the two very different reasons a step can raise nothing.
test('TIMBER-1: the model description tracks the frame the scene actually draws', () => {
  for (const [label, over] of [
    ['default', {}],
    ['slab on grade', { crawlFt: 0 }],   // step 1 frames nothing on this design
    ['no openings', { openings: [] }],
  ] as Array<[string, Partial<ReturnType<typeof defaultBuilding>>]>) {
    const b = { ...defaultBuilding(), ...over };
    const members = generateFrame(b).members;
    const total = members.length;

    for (const stage of STAGES.map((s) => s.id)) {
      const said = describeModel(members, stage, b);
      const def = STAGES.find((s) => s.id === stage)!;
      const standing = members.filter((m) => m.stage <= stage).length;
      const raised = members.filter((m) => m.stage === stage).length;
      const ctx = `${label}/step ${stage}`;

      // Case-insensitive: naming the building first made "Step N of 11" the start of its own
      // sentence. What this pins is WHICH step is named, not how it is capitalised.
      assert.match(said, new RegExp(`step ${stage} of ${STAGES.length}`, 'i'), `${ctx}: wrong step named`);
      // The RESOLVED name, not the doctrine row's: a step whose text no longer matches what this
      // design frames is renamed for it ("Floor joists" where no bridging is cut, "Layout" where
      // there are no piers to set), and the description must follow that rather than the table.
      assert.ok(said.includes(stageText(stage, members).name), `${ctx}: does not name the step`);

      if (!def.framed) {
        // An unmodelled trade: the frame is DONE, not partially built.
        assert.match(said, /finish work TIMBER-1 does not model/, `${ctx}: unmodelled trade mis-described`);
        assert.match(said, new RegExp(`complete at ${total} members`), `${ctx}: wrong total`);
      } else if (raised === 0) {
        // A framed step that this design happens to skip — different sentence, deliberately.
        assert.match(said, /Nothing is cut at this step in this design/, `${ctx}: empty step mis-described`);
        assert.doesNotMatch(said, /does not model/, `${ctx}: a skipped step read as an unmodelled trade`);
        assert.match(said, new RegExp(`${standing} of ${total} members`), `${ctx}: wrong standing count`);
      } else {
        assert.match(said, new RegExp(`${standing} of ${total} members standing`), `${ctx}: wrong standing count`);
        assert.match(said, new RegExp(`${raised} raised at this step`), `${ctx}: wrong raised count`);
      }
    }
    // By the last framed step every member is standing — the description cannot claim otherwise.
    const lastFramed = Math.max(...STAGES.filter((s) => s.framed).map((s) => s.id));
    assert.match(describeModel(members, lastFramed as typeof STAGES[number]['id'], b),
      new RegExp(`${total} of ${total} members standing`), `${label}: frame not complete at the last framed step`);
  }
});

// The 3D card's own label is a fixed string while the scrubber walks the model through seven
// construction stages — so landing on the figure said "Interactive 3D model" and nothing about
// which stage is on screen. The caption beneath it already states the stage, its labour and its
// materials and updates live, so the figure is pointed at THAT rather than given a second
// description that could drift from it. The reference has to resolve on both branches: without
// WebGL the caption is different text (a route to the build schedule) but must still carry the id.
test('SAP-1: the 3D card is described by the caption that tracks the stage', () => {
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];
  const r = compute(defaultInputs({ overheadCover: true, camouflage: true }));

  for (const webglOk of [true, false]) {
    const html = renderApp(state, r, webglOk, false);
    const ctx = webglOk ? 'with WebGL' : 'without WebGL';
    assert.match(html, /class="panel-card three-card"[^>]*aria-describedby="three-stage-caption"/,
      `${ctx}: the 3D card does not point at its caption`);
    // …and the element it names must exist exactly once, or the reference is dead markup.
    const ids = html.match(/id="three-stage-caption"/g) ?? [];
    assert.equal(ids.length, 1, `${ctx}: expected exactly one caption to carry the id, found ${ids.length}`);
  }

  // With WebGL the caption is the live stage description; the slider points at the same element,
  // so the two controls can never describe different stages.
  const live = renderApp(state, r, true, false);
  assert.match(live, /id="three-stage"[^>]*aria-describedby="three-stage-caption"/,
    'the scrubber and the figure must share one description');
  assert.match(live, /aria-live="polite"/, 'the caption must announce stage changes');
});

// The section drew the grenade sump at a size it made up — min(0.9, holeW × 0.22) wide by a flat
// 0.7 deep — while compute.ts billed that same sump's excavation and gravel from the doctrine's
// own sump.L/W/D. A two-man position therefore drew a 0.44 × 0.7 ft notch beside a bill for a
// 1 × 1 × 1 ft hole. Nothing needed inventing to fix it: the dimensions were already in doctrine
// and simply were not being read.
//
// The invariant that catches a bay-derived size: a sump is a fixed doctrinal thing, so positions
// with DIFFERENT bay depths must draw the SAME notch. Before this it scaled with the bay (0.44 on
// a two-man, 0.90 on a bunker) and this test would have failed on the first pair.
test('SAP-1: the drawn grenade sump is doctrine-sized, not bay-sized', () => {
  const notch = (positionType: string): { w: number; h: number } | null => {
    const svg = drawSection(compute(defaultInputs({ positionType, sump: true })));
    const label = svg.indexOf('aria-label="Grenade catch-pit (sump)"');
    if (label < 0) return null;
    const re = /<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="([\d.]+)"[^>]*fill="var\(--draw-timber\)"/g;
    let last: RegExpExecArray | null = null;
    for (let m = re.exec(svg); m; m = re.exec(svg)) if (m.index < label) last = m;
    return last ? { w: Number(last[1]), h: Number(last[2]) } : null;
  };

  const drawn = Object.keys(positions)
    .filter((p) => positions[p]!.grenadeSumps > 0)
    .map((p) => ({ p, holeW: compute(defaultInputs({ positionType: p })).resolved.holeW, n: notch(p) }))
    .filter((x) => x.n !== null);
  assert.ok(drawn.length >= 2, 'fixture: need at least two sump-digging positions to compare');

  // Pixel sizes are NOT comparable across positions: the section scales to fit its viewport, so a
  // bunker and a foxhole draw the same foot at different pixel counts. The scale-free invariant is
  // the notch's own proportion — it must carry doctrine's W:D on every position. The old bay-derived
  // sizes gave 0.44/0.70 = 0.63 on a two-man and 0.90/0.70 = 1.29 on a bunker; doctrine's is 1.00.
  const want = sump.W.value / sump.D.value;
  const bays = new Set(drawn.map((x) => x.holeW));
  assert.ok(bays.size > 1, 'fixture: the compared positions must have different bay depths');
  for (const { p, n } of drawn) {
    const ratio = n!.w / n!.h;
    assert.ok(Math.abs(ratio - want) < 1e-6,
      `${p}: notch drawn ${ratio.toFixed(3)} wide-to-deep, doctrine says ${want.toFixed(3)} — it is sized off the bay, not the doctrine`);
  }
});

// A spreadsheet is what a logistics request gets built from. This one exported a full bill AND a
// build sequence for a design the app REJECTS — "this soil requires revetment but none is selected
// — walls will slough" — without a word about it, so every quantity read exactly as authoritative
// as one from a sound design. The screen and the printed sheet both lead with those checks; the
// export dropped them entirely.
test('SAP-1: the CSV export carries the checks, not just the quantities', () => {
  const meta = { scenario: 'Sweep', date: '2026-07-13' };

  // A design with a BLOCKING error must say so in the file, at the stated severity.
  const bad = compute(defaultInputs({ soil: 'sand', revetment: 'none' }));
  const errors = bad.validation.filter((v) => v.severity === 'error');
  assert.ok(errors.length > 0, 'fixture: this design should be rejected');
  const csv = toCsv(bad, meta);
  for (const e of errors) {
    assert.ok(csv.includes(e.code), `CSV omits the code for "${e.message}"`);
    assert.ok(csv.includes(e.message), `CSV omits the message for ${e.code}`);
  }
  assert.match(csv, /^Check,error,/m, 'the severity must travel with the issue, not just the text');

  // The checks come BEFORE the numbers they qualify — a bill read first and caveated later is a
  // bill acted on first.
  const firstCheck = csv.indexOf('\r\nCheck,');
  const firstBom = csv.indexOf('\r\nBOM,');
  assert.ok(firstCheck > 0 && firstBom > 0 && firstCheck < firstBom,
    'the checks section must precede the bill of materials');

  // Every issue the engine raises reaches the file — advisories included, since they are the ones
  // explaining discrepancies the reader can otherwise only notice and distrust.
  for (const positionType of ['fifty_cal', 'atgm_javelin', 'mortar_pit']) {
    const r = compute(defaultInputs({ positionType, overheadCover: true, camouflage: true }));
    const out = toCsv(r, meta);
    for (const v of r.validation) {
      assert.ok(out.includes(v.code), `${positionType}: CSV dropped ${v.code} (${v.severity})`);
    }
  }
});

// The Result type says of the two model statements: "always shown, never implied to be doctrinal".
// The screen prints both and the printed sheet prints both; the export printed neither, so a
// spreadsheet of volumes and man-hours travelled with no statement of what produced them — not
// that the labour adders never scale with the position, nor that the base rate is identical for a
// bunker and a foxhole.
test('SAP-1: every surface states which models produced its numbers', () => {
  const meta = { scenario: 'Sweep', date: '2026-07-13' };
  for (const positionType of ['two_man', 'mortar_pit', 'vehicle_turret_defilade']) {
    const r = compute(defaultInputs({ positionType, overheadCover: true, threat: 'ind-art-105' }));
    const csv = toCsv(r, meta);
    const sheet = jobSheet(r, meta);
    const screen = specsPanel(r);

    for (const [name, out, needsEscaping] of [
      ['screen', screen, true], ['sheet', sheet, true], ['csv', csv, false],
    ] as const) {
      const vol = needsEscaping ? escHtml(r.fidelity.volume) : r.fidelity.volume;
      const lab = needsEscaping ? escHtml(r.fidelity.labor) : r.fidelity.labor;
      assert.ok(out.includes(vol), `${positionType}/${name}: volume model missing`);
      assert.ok(out.includes(lab), `${positionType}/${name}: labor model missing`);
    }

    // Both statements contain commas, so in the CSV they must be quoted or they silently become
    // extra columns and every field after them shifts.
    for (const line of csv.split('\r\n')) {
      if (!/^(Volume|Labor) model,/.test(line)) continue;
      const value = line.slice(line.indexOf(',') + 1);
      assert.ok(value.startsWith('"') && value.endsWith('"'),
        `${positionType}: "${line.slice(0, 24)}…" is not quoted despite containing commas`);
    }
  }
});

// The plate layout strip is what a carpenter marks a plate from before framing a wall: pencil X/K/
// J/C at these positions, stand a stud on each. So a mark in the wrong place is a wall framed
// wrong, and a MISSING mark is a stud that never gets stood. The existing coverage checks the S
// wall of one design for sortedness, range and real member ids — none of which would catch a mark
// that is simply at the wrong offset, and none of which touches the E/W walls, whose frames carry
// the `widthFt - T` run and a half-thickness start offset (the exact site of an earlier off-by-a-
// sill-thickness bug in the printed ruler).
test('TIMBER-1: every plate mark sits where its member actually stands', () => {
  const T = 1.5 / 12;
  // walls.ts wallFrames — start is the left end viewed from OUTSIDE, dir runs along the wall.
  const frameOf = (wall: string, L: number, W: number): { s: [number, number]; d: [number, number] } =>
    wall === 'S' ? { s: [0, 0], d: [1, 0] }
      : wall === 'N' ? { s: [L, W], d: [-1, 0] }
        : wall === 'E' ? { s: [L, T / 2], d: [0, 1] }
          : { s: [0, W - T / 2], d: [0, -1] };
  const MARKED: Record<string, string> = { stud: 'X', kingStud: 'K', jackStud: 'J', cripple: 'C' };

  const designs: Array<[string, Partial<ReturnType<typeof defaultBuilding>>]> = [
    ['default', {}],
    ['20x30', { lengthFt: 20, widthFt: 30 }],
    ['24in framing', { studSpacingIn: 24, joistSpacingIn: 24, rafterSpacingIn: 24 }],
    ['no openings', { openings: [] }],
    ['smallest', { lengthFt: 8, widthFt: 8, openings: [] }],
  ];

  for (const [label, over] of designs) {
    const b = { ...defaultBuilding(), ...over };
    const members = generateFrame(b).members;
    const byId = new Map(members.map((m) => [m.id, m]));

    for (const wall of ['S', 'N', 'E', 'W'] as const) {
      const f = frameOf(wall, b.lengthFt, b.widthFt);
      const marks = layoutStrip(members, wall, b.lengthFt, b.widthFt);
      const ctx = `${label}/wall ${wall}`;

      // 1. Each mark is at its member's real position, measured along that wall's own frame.
      for (const mk of marks) {
        const m = byId.get(mk.memberId);
        assert.ok(m, `${ctx}: mark ${mk.kind}@${mk.atIn} names a member that does not exist`);
        const u = (m!.position[0] - f.s[0]) * f.d[0] + (m!.position[2] - f.s[1]) * f.d[1];
        assert.ok(Math.abs(u * 12 - mk.atIn) < 0.13, // 1/8" — the strip rounds to eighths
          `${ctx}: ${mk.kind} marked at ${mk.atIn}" but ${m!.id} stands at ${(u * 12).toFixed(3)}"`);
      }

      // 2. No markable member on that wall is left off the plate. Cripples above and below an
      //    opening deliberately share one mark, so completeness is checked by POSITION per kind.
      const onWall = members.filter((m) => m.id.startsWith(wall + '-') && MARKED[m.role]);
      const marked = new Set(marks.map((mk) => `${mk.kind}@${mk.atIn.toFixed(3)}`));
      for (const m of onWall) {
        const u = (m.position[0] - f.s[0]) * f.d[0] + (m.position[2] - f.s[1]) * f.d[1];
        const key = `${MARKED[m.role]}@${(Math.round(u * 12 * 8) / 8).toFixed(3)}`;
        assert.ok(marked.has(key), `${ctx}: ${m.role} ${m.id} at ${(u * 12).toFixed(2)}" has no plate mark`);
      }
    }
  }
});

// A rafter is cut to these angles and this length before anyone lifts it: a wrong seat cut means
// it does not sit on the plate, a wrong length means the roof does not reach. The existing check
// asserts only that the angle fields are DEFINED, which a wrong formula would satisfy. These are
// pure trigonometry off the pitch — no doctrine is involved, so they can be checked exactly.
test('TIMBER-1: rafter cuts follow the pitch they are cut for', () => {
  for (const widthFt of [16, 30]) {
    for (const overhangFt of [0, 1, 2]) {
      for (const risePer12 of [0, 1, 3, 4, 6, 8, 12]) {
        const b = { ...defaultBuilding(), widthFt, overhangFt, risePer12 };
        const rafters = generateFrame(b).members.filter((m) => m.role === 'rafter');
        assert.ok(rafters.length > 0, `${widthFt}ft/${risePer12}:12 — no rafters generated`);
        const ctx = `${widthFt}ft wide, ${risePer12}:12, ${overhangFt}ft overhang`;

        const theta = Math.atan(risePer12 / 12);
        const seatDeg = (theta * 180) / Math.PI;
        // Rafter run is HALF the width for a simple gable; the overhang extends along the slope.
        const expectedLen = ((widthFt / 2 + overhangFt) / Math.cos(theta)) * 12;

        for (const r of rafters) {
          assert.ok(r.angles, `${ctx}: ${r.id} carries no cut angles`);
          const seat = r.angles!.seatCut ?? NaN;
          const plumb = r.angles!.plumbCut ?? NaN;
          assert.ok(Math.abs(seat - seatDeg) < 0.01,
            `${ctx}: seat cut ${seat.toFixed(2)}° but the pitch is ${seatDeg.toFixed(2)}°`);
          // The two cuts are complementary by construction — plumb is vertical, seat horizontal.
          assert.ok(Math.abs(plumb + seat - 90) < 0.01,
            `${ctx}: plumb ${plumb.toFixed(2)}° + seat ${seat.toFixed(2)}° should be 90°`);
          assert.ok(Math.abs(r.cutLength - expectedLen) < 0.5,
            `${ctx}: ${r.id} cut ${r.cutLength.toFixed(2)}" but the slope needs ${expectedLen.toFixed(2)}"`);
        }

        // A flat roof is the degenerate case that most easily hides a sign or unit error.
        if (risePer12 === 0) {
          assert.ok(Math.abs((rafters[0]!.angles!.seatCut ?? NaN)) < 1e-9, `${ctx}: a flat roof has no seat cut`);
          assert.ok(Math.abs((rafters[0]!.angles!.plumbCut ?? NaN) - 90) < 1e-9, `${ctx}: a flat roof cuts plumb at 90°`);
          assert.ok(Math.abs(rafters[0]!.cutLength - (widthFt / 2 + overhangFt) * 12) < 0.5,
            `${ctx}: a flat rafter is just run + overhang`);
        }
      }
    }
  }
});

// The threat is picked through a cascade — class, then caliber — but only the munition id is
// stored. So whenever a threat arrives from somewhere other than those two dropdowns (a restored
// session, an imported settings file, a loaded scenario, an applied plan option), the class picker
// has to be DERIVED back from it. If that derivation drifted, the panel would show a caliber from
// one class while the class box named another, and the next class change would silently retarget
// the design to a munition the user never chose.
test('SAP-1: both threat pickers agree for every threat, however it was set', () => {
  const selectedIn = (html: string, attr: string, val: string): string => {
    const start = html.indexOf(`${attr}="${val}"`);
    if (start < 0) return '(select missing)';
    const seg = html.slice(start, html.indexOf('</select>', start));
    return (seg.match(/value="([^"]+)"[^>]*\sselected/) ?? [])[1] ?? '(nothing selected)';
  };

  for (const id of Object.keys(threats)) {
    const html = controlsHtml(compute(defaultInputs({ threat: id })).inputs);
    assert.equal(selectedIn(html, 'data-action', 'threat-class'), threatClassOf(id),
      `${id}: the class picker does not show the class this munition belongs to`);
    assert.equal(selectedIn(html, 'data-field', 'threat'), id,
      `${id}: the caliber picker does not show the selected munition`);
  }

  // With no threat there is no caliber to choose, so that picker is disabled rather than offering
  // a live control that cannot mean anything.
  const noneHtml = controlsHtml(compute(defaultInputs({ threat: 'none' })).inputs);
  const calSeg = noneHtml.slice(noneHtml.indexOf('data-field="threat"'));
  assert.match(calSeg.slice(0, 40), /disabled/, 'the caliber picker must be disabled when no threat is set');
  assert.equal(selectedIn(noneHtml, 'data-action', 'threat-class'), 'none', 'the class picker should read none');
});

// The design panel edits openings live while sanitizeBuilding guards what comes back from storage,
// and the two enforced DIFFERENT rules: the editor accepted anything `>= 0`, storage clamped to
// real ranges. Typing 0 into a width was therefore accepted by the editor and generated a member
// with a non-positive cut length — a piece in the cut list with no length, and designProblems said
// nothing — while the identical value read back from storage became 0.5 ft. They now share one
// exported constant; this asserts the constant really is what storage enforces, so neither side can
// drift from it.
test('TIMBER-1: the opening editor and the storage boundary agree on what is valid', () => {
  const base = defaultBuilding();
  const one = (over: Partial<(typeof base)['openings'][number]>) =>
    sanitizeBuilding({ ...base, openings: [{ ...base.openings[0], ...over }] }).openings[0]!;

  for (const [field, [lo, hi]] of Object.entries(OPENING_BOUNDS)) {
    const k = field as keyof (typeof base)['openings'][number];
    // Below the floor and above the ceiling must land exactly on the shared bound.
    assert.equal(one({ [k]: lo - 1 } as never)[k], lo, `${field}: storage floor is not ${lo}`);
    assert.equal(one({ [k]: hi + 1 } as never)[k], hi, `${field}: storage ceiling is not ${hi}`);
    // A value inside the range passes through untouched — a clamp that alters valid input is a bug.
    const mid = (lo + hi) / 2;
    assert.equal(one({ [k]: mid } as never)[k], mid, `${field}: an in-range value was altered`);
  }

  // The point of the floors: no opening within bounds may produce a degenerate member. At width 0
  // — accepted by the old editor — this generated exactly one.
  for (const widthFt of [OPENING_BOUNDS.widthFt[0], 1, 3]) {
    for (const heightFt of [OPENING_BOUNDS.heightFt[0], 2, 6.7]) {
      const b = { ...base, openings: [{ wall: 'S' as const, offsetFt: 4, widthFt, heightFt, sillHeightFt: 0 }] };
      for (const m of generateFrame(b).members) {
        assert.ok(m.cutLength > 0, `${widthFt}x${heightFt}: ${m.id} has cut length ${m.cutLength}`);
        assert.ok(m.position.every((v) => Number.isFinite(v)), `${widthFt}x${heightFt}: ${m.id} is placed at a non-finite point`);
      }
    }
  }
});

// SAP-1's numeric inputs pass through THREE independent gates: the control's own min/max (which
// main.ts's coerce() clamps to), schema.ts (which rejects an imported file outright), and compute()
// (which clamps and reports COUNT_CLAMPED / TEAM_CLAMPED). Nothing tied them together, so they
// could drift apart the way TIMBER-1's editor and storage boundary had — where the panel accepted a
// value the loader would have refused, and the difference reached geometry as a member with no
// length. Here the three agree; this keeps them agreeing.
test('SAP-1: control, schema and engine agree on the numeric limits', () => {
  const html = controlsHtml(compute(defaultInputs({})).inputs);
  const attrOf = (field: string, name: string): number => {
    const i = html.indexOf(`data-field="${field}"`);
    assert.ok(i > 0, `${field}: control not rendered`);
    const seg = html.slice(Math.max(0, i - 200), i + 200);
    const m = seg.match(new RegExp(`${name}="([-\\d.]+)"`));
    assert.ok(m, `${field}: control declares no ${name}`);
    return Number(m![1]);
  };

  for (const [field, lo, hi] of [['count', 1, 999], ['teamSize', 1, 50]] as const) {
    // 1. The control's declared range IS the range — coerce() clamps to these attributes, so a
    //    wrong attribute silently becomes a wrong live clamp.
    assert.equal(attrOf(field, 'min'), lo, `${field}: control min`);
    assert.equal(attrOf(field, 'max'), hi, `${field}: control max`);

    // 2. An imported file outside that range is REFUSED, not quietly renormalised — schema.ts's
    //    contract is that ok:true means every field is already valid.
    for (const bad of [lo - 1, hi + 1, 0.5, NaN]) {
      const v = validateInputs({ ...defaultInputs({}), [field]: bad } as unknown);
      assert.equal(v.ok, false, `${field}: schema accepted ${String(bad)}`);
    }

    // 3. The engine clamps to the same edges, and says so rather than silently renormalising.
    for (const [given, want] of [[lo - 5, lo], [hi + 5, hi]] as const) {
      const r = compute(defaultInputs({ [field]: given } as Record<string, unknown>));
      assert.equal(r.inputs[field], want, `${field}: engine clamped ${given} to ${r.inputs[field]}, expected ${want}`);
      assert.ok(r.validation.some((x) => /CLAMPED/.test(x.code)), `${field}: clamping ${given} was not reported`);
    }
  }
});

// The in-app help explained every INPUT and none of the planning TOOLS, so the app's whole purpose
// — what to build, in what order, and whether it is done by stand-to — was discoverable only by
// opening the menu and guessing. Help that names a feature is also a claim ABOUT that feature, so
// each entry is tied to something that demonstrably exists: a menu item that opens it, or a control
// that is really there.
test('SAP-1: help documents the build-planning tools, and names real ones', () => {
  const help = helpHtml();
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];
  const shell = renderApp(state, compute(defaultInputs({})), true, false);

  // Each documented tool must correspond to a real action in the shell.
  for (const [term, action] of [
    ['Build schedule', 'schedule'],
    ['Time planner', 'plan'],
    ['Compare setups', 'compare'],
    ['Combine positions', 'mission'],
  ] as const) {
    assert.ok(help.includes(term), `help does not mention "${term}"`);
    assert.ok(shell.includes(`data-action="${action}"`), `help names "${term}" but no control opens it`);
  }

  // The stage slider and its jump-to-start button are described, so they must exist.
  assert.match(help, /Build stage slider/);
  assert.match(shell, /id="three-stage"/, 'help describes a stage slider the shell does not render');
  assert.match(shell, /data-action="three-stage-first"/, 'help promises a "Start at step 1" that is not there');

  // The claim about the two elapsed figures differing is a real, checkable property: the mission
  // roll-up assumes the whole team digs, the schedule holds part of it on watch.
  assert.match(help, /security posture/);
  const r = compute(defaultInputs({ teamSize: 4 }));
  const plan = computeStages(r);
  const whole = scheduleStages(plan, { teamSize: 4, availableHours: 99, securityPostureFrac: 1, positions: 1 });
  const posted = scheduleStages(plan, { teamSize: 4, availableHours: 99, securityPostureFrac: 0.5, positions: 1 });
  assert.ok(posted.totalElapsedHours > whole.totalElapsedHours,
    'help claims a security posture lengthens the timeline, but it does not');
});

test('a toggle that cannot do anything on the chosen position says so', () => {
  // The generalisation of the firing-step fix. Found by diffing compute() with each toggle off vs
  // on across every position: `sump` moved nothing on the mortar pit and both vehicle defilades
  // (doctrine gives those grenadeSumps = 0), yet its hint still promised a grenade catch-pit. A
  // control that silently absorbs a click is worse than one that explains itself.
  for (const [id, row] of Object.entries(positions)) {
    const html = controlsHtml(defaultInputs({ positionType: id }));
    const hint = html.split('id="f-sump"')[1]?.split('</label>')[0] ?? '';
    const inert = row.grenadeSumps < 1;

    const off = compute(defaultInputs({ positionType: id, sump: false }));
    const on = compute(defaultInputs({ positionType: id, sump: true }));
    const moved = JSON.stringify([off.labor, off.geometry, off.bom]) !== JSON.stringify([on.labor, on.geometry, on.bom]);
    assert.equal(moved, !inert, 'doctrine sump count must decide whether the toggle does anything: ' + id);

    if (inert) assert.match(hint, /Not used here/, 'inert sump toggle explains itself: ' + id);
    else assert.ok(hint.includes(String(row.grenadeSumps)), 'active sump toggle states its count: ' + id);
  }
});

test('the build-stage toggles are offered in the order the work happens', () => {
  // The form is where a user chooses; the schedule is where they read the order back. Listing the
  // roof above the sump above the firing step taught the sequence backwards before the sequence
  // panel ever got a chance to teach it forwards. Ordered by the stage each toggle creates.
  const html = controlsHtml(defaultInputs({}));
  const stageOf: Record<string, string> = {
    firingStep: 'deliberate', sump: 'revet_sump', overheadCover: 'overhead', camouflage: 'camo',
  };
  const seen = Object.keys(stageOf)
    .map((f) => ({ f, at: html.indexOf('id="f-' + f + '"') }))
    .sort((a, b) => a.at - b.at);
  assert.ok(seen.every((s) => s.at >= 0), 'every build-stage toggle is rendered');

  const doctrinal = seen.map((s) => STAGE_ORDER.findIndex((x) => x.id === stageOf[s.f]));
  assert.ok(doctrinal.every((v) => v >= 0), 'each toggle maps to a real stage');
  assert.deepEqual(doctrinal, [...doctrinal].sort((a, b) => a - b),
    'toggles must appear in STAGE_ORDER order, got: ' + seen.map((s) => s.f).join(' -> '));
});

test('when the clock runs out, the order says how far down it gets', () => {
  // The panel could say "NOT ready — short 21.6 hr" but not what the crew WOULD have standing when
  // the enemy arrived, which is the entire point of a priorities-of-work order. Everything needed
  // was already computed: each step's cumulative clock, the position count, the budget.
  const r = compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced', soil: 'rock' }));
  const plan = computeStages(r);

  // Sweep the budget across the whole build so every cutoff position is exercised, including the
  // two ends (nothing finishes; everything finishes).
  const full = scheduleStages(plan, { teamSize: 4, availableHours: 1e9, securityPostureFrac: 1, positions: 2 });
  const totalHours = full.allPositionsHours;
  let sawNone = false, sawPartial = false, sawAll = false;

  for (const frac of [0, 0.05, 0.2, 0.4, 0.6, 0.8, 0.99, 1.5]) {
    const budget = Math.max(0.1, totalHours * frac);
    const sched = scheduleStages(plan, { teamSize: 4, availableHours: budget, securityPostureFrac: 1, positions: 2 });
    const html = scheduleOverlay(sched, 4, budget, 1, ctxOf(r));
    const reached = sched.steps.filter((s) => s.cumulativeHours * sched.positions <= budget + 1e-9).length;
    const at = 'budget=' + budget.toFixed(1) + ' reached=' + reached;

    if (sched.feasible) {
      sawAll = true;
      assert.doesNotMatch(html, /sched-cutoff/, at + ': a job that fits has no cutoff line');
      assert.doesNotMatch(html, /past-budget/, at + ': a job that fits dims no rows');
      continue;
    }
    // The cutoff is drawn exactly once, and every step past it is marked — never the ones before.
    assert.equal((html.match(/sched-cutoff/g) ?? []).length, 1, at + ': exactly one cutoff line');
    assert.equal((html.match(/class="past-budget"/g) ?? []).length, sched.steps.length - reached, at + ': rows past the line');

    if (reached === 0) {
      sawNone = true;
      assert.match(html, /not even step 1/i, at + ': says nothing completes');
    } else {
      sawPartial = true;
      const label = sched.steps[reached - 1]!.label.replace(/&/g, '&amp;');
      assert.ok(html.includes('step ' + reached + ' of ' + sched.steps.length + ' — ' + label), at + ': names the step reached');
      // The step it names must be one that actually fits, and the next one must not.
      assert.ok(sched.steps[reached - 1]!.cumulativeHours * sched.positions <= budget + 1e-9, at + ': named step fits');
      assert.ok(sched.steps[reached]!.cumulativeHours * sched.positions > budget + 1e-9, at + ': the next step does not');
    }
  }
  assert.ok(sawNone && sawPartial && sawAll, 'sweep must cover no/partial/full completion');
});

test('two setups that differ can be told apart in the compare table', () => {
  // This table's own comment says its whole job is to make choosing easy, yet a setup differing
  // only in soil, revetment, sump, camouflage, machine assist or position count rendered with
  // every visible row identical and just the man-hours moving. A number that changes for no
  // stated reason is not a comparison — the reader cannot tell which column is which design.
  const AXES: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['revetment', { revetment: 'none' }, { revetment: 'pickets_wire' }],
    ['soil', { soil: 'loam' }, { soil: 'rock' }],
    ['sump', { sump: false }, { sump: true }],
    ['camouflage', { camouflage: false }, { camouflage: true }],
    ['machineAssist', { machineAssist: false }, { machineAssist: true }],
    ['count', { count: 1 }, { count: 5 }],
    ['overheadCover', { overheadCover: false }, { overheadCover: true }],
    ['standard', { standard: 'hasty' }, { standard: 'reinforced' }],
  ];
  // Rows that only ever carry a total. If these are the ONLY rows that move, the table has shown
  // an effect with no cause.
  const TOTALS = /Man-hours|Elapsed|Sandbags/;

  for (const [axis, a, b] of AXES) {
    const html = compareOverlay([compute(defaultInputs(a)), compute(defaultInputs(b))]);
    const rows = [...html.matchAll(/<tr>(.*?)<\/tr>/gs)]
      .map((m) => ({
        label: /<th scope="row">(.*?)<\/th>/.exec(m[1]!)?.[1] ?? '',
        cells: [...m[1]!.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => c[1]!.replace(/<[^>]+>/g, '')),
      }))
      .filter((r) => r.label && r.cells.length === 2);

    assert.ok(rows.length > 0, axis + ': compare table rendered rows');
    const moved = rows.filter((r) => r.cells[0] !== r.cells[1]).map((r) => r.label);
    assert.ok(moved.length > 0, axis + ': two different designs must not render identically');
    assert.ok(
      moved.some((l) => !TOTALS.test(l)),
      axis + ': only totals moved (' + moved.join(', ') + ') — nothing names the difference',
    );
  }
});

test('the group job list draws in the same units as every other panel', () => {
  // The group bill printed raw canonical quantities: in metric it read "217.5 ft³" of spoil while
  // the schedule panel beside it, same design and same materials, said "2.05 m³". A supply draw
  // taken off that is wrong by a factor of 35. Same defect class as the schedule panel's own
  // "Draw now" line and the job-sheet bill, both already fixed; this surface was missed.
  for (const unit of ['imperial', 'metric'] as const) {
    const inputs = defaultInputs({ unit, positionType: 'two_man', revetment: 'pickets_wire', count: 3 });
    const mission = aggregateMission([{ inputs }], {});
    const html = missionOverlay(mission, [{ inputs }], unit);
    const text = html.replace(/<[^>]+>/g, ' ');

    assert.ok(mission.lines.length > 0, unit + ': fixture has materials');
    if (unit === 'metric') {
      // No imperial unit may appear as a quantity anywhere in a metric list.
      assert.doesNotMatch(text, /\d\s*ft³|\d\s*ft²|\d\s*ft\b/, 'metric list leaked an imperial unit: ' + text.slice(0, 200));
    }
    for (const l of mission.lines) {
      const want = fmtBomQty(l.qtyTotal, l.unit, unit);
      assert.ok(text.includes(String(Math.round(want.qty * 1000) / 1000)) || text.includes(want.unit),
        `${unit}/${l.label}: converted quantity or unit must appear`);
    }
  }
});

test('on-hand typed in the shown units is stored as the same real quantity', () => {
  // The field shows the user's units but the store holds canonical, so the read-back must undo
  // exactly the scale the render applied — otherwise a metric user entering 2 cubic metres has
  // 2 cubic FEET filed against a 35x-larger requirement, and the shortfall column understates
  // what still has to be drawn.
  const inputs = defaultInputs({ unit: 'metric', positionType: 'two_man', revetment: 'pickets_wire' });
  const spoil = aggregateMission([{ inputs }], {}).lines.find((l) => l.unit === 'ft³');
  assert.ok(spoil, 'fixture must contain a volume line');

  // Round-trip: canonical -> shown -> canonical, the two conversions the UI actually performs.
  for (const canonical of [0, 1, 12.5, 217.5, 1000]) {
    const shown = fmtBomQty(canonical, spoil.unit, 'metric').qty;
    const factor = fmtBomQty(1, spoil.unit, 'metric').qty || 1;
    const back = shown / factor;
    assert.ok(Math.abs(back - canonical) < 1e-9, `round-trip drifted at ${canonical}: shown ${shown}, back ${back}`);
  }
  // And the render puts that same raw unit on the element for the handler to scale by.
  const html = missionOverlay(aggregateMission([{ inputs }], { onHand: { [spoil.id]: 100 } }), [{ inputs }], 'metric');
  assert.match(html, new RegExp('data-onhand-unit="' + spoil.unit + '"'), 'raw unit rides on the input');
  assert.match(html, /step="0\.01"/, 'a converted quantity accepts decimals');
});

test('no surface prints imperial quantities to a metric user', () => {
  // Found by sweeping every rendered surface in metric mode rather than checking one panel: the
  // group job list, the 3D stage caption and two engine advisories all printed raw feet. Each was
  // the same defect already fixed elsewhere, re-made in a surface nobody had swept. This asserts
  // the whole set at once so the next one cannot hide.
  // No 'in' alternative: this app renders inches ONLY as 5'-0" via feetInches(), never as a bare
  // "in", so that token can never match a real unit here — but it does match the English
  // preposition ("11 man-hr in loam", "On hand 3 in m³"), which would fail this sweep on prose the
  // moment a surface carrying one was added to it. Matching a word that cannot be a unit buys
  // nothing and costs a false alarm.
  const LEAK = /\d+(?:\.\d+)?\s*(?:ft³|ft²|ft\b|yd)|\d+'[-\s]?\d*"?/;

  for (const positionType of Object.keys(positions)) {
    const inputs = defaultInputs({
      unit: 'metric', positionType, revetment: 'pickets_wire',
      sump: true, overheadCover: true, camouflage: true, count: 3,
    });
    const r = compute(inputs);
    const sched = scheduleStages(computeStages(r), {
      teamSize: 4, availableHours: 40, securityPostureFrac: 0.75, positions: 3,
    });
    const surfaces: Record<string, string> = {
      specsPanel: specsPanel(r),
      bomPanel: bomPanel(r),
      scheduleOverlay: scheduleOverlay(sched, 4, 40, 0.75, ctxOf(r)),
      compareOverlay: compareOverlay([r, r]),
      missionOverlay: missionOverlay(aggregateMission([{ inputs }], {}), [{ inputs }], 'metric'),
      csv: toCsv(r, { scenario: 'probe', date: '2026-01-01' }),
      stageCaption: STAGE_ORDER.map((_, i) => stageCaption(i, r)).join(' '),
      // Advisories are engine-authored prose, and two of them baked in feet.
      validation: r.validation.map((v) => v.message).join(' '),
      // The control form gained numbers of its own (the standard ladder, the soil comparison) and
      // was never in this sweep — the surface most likely to grow new figures was the one not
      // being checked for them.
      controlsHtml: controlsHtml(inputs),
      // The three drawings are the most dimension-dense output in the app — every witness line
      // prints a length — and none of them were swept. The job sheet was excluded only because the
      // old regex matched its `max-width: 8.2in` print CSS; dropping the 'in' alternative (which
      // could never catch a real unit here) lets the sheet that goes to the site join too.
      drawPlan: drawPlan(r),
      drawSection: drawSection(r),
      drawIso: drawIso(r),
      jobSheet: jobSheet(r, { scenario: 'probe', date: '2026-01-01' }),
    };
    for (const [name, html] of Object.entries(surfaces)) {
      const text = html.replace(/<[^>]+>/g, ' ');
      const m = LEAK.exec(text);
      assert.equal(m, null,
        `${name} @ ${positionType}: imperial unit in a metric render — ` +
        JSON.stringify(text.slice(Math.max(0, (m?.index ?? 0) - 50), (m?.index ?? 0) + 30)));
    }
  }
});

test('the stage caption states one scope, not two', () => {
  // It printed per-position man-hours beside the WHOLE ORDER's quantity: an order for three read
  // "3.9 man-hrs. Draw: spoil (217.5 ft³)" — one hole's labour against three holes' spoil in one
  // sentence. The schedule panel had already been fixed for exactly this; the caption had not.
  const r = compute(defaultInputs({ positionType: 'two_man', revetment: 'pickets_wire', count: 3 }));
  const plan = computeStages(r).steps;
  const step = plan.find((s) => s.bom.length > 0);
  assert.ok(step, 'fixture has a step carrying materials');

  const cap = stageCaption(STAGE_ORDER.findIndex((x) => x.id === step.id), r).replace(/<[^>]+>/g, '');
  const line = step.bom[0]!;
  assert.ok(cap.includes(String(Math.round(line.qtyPerPosition * 100) / 100)), 'per-position quantity leads');
  assert.match(cap, /for all 3/, 'the order total is labelled as such');

  // With one position there is only one scope, so no suffix should appear at all.
  const one = compute(defaultInputs({ positionType: 'two_man', revetment: 'pickets_wire', count: 1 }));
  const capOne = stageCaption(STAGE_ORDER.findIndex((x) => x.id === step.id), one).replace(/<[^>]+>/g, '');
  assert.doesNotMatch(capOne, /for all/, 'a single position needs no scope suffix');
});

// The revetment loops in these cross-cutting sweeps read the doctrine table rather than a hand-
// written subset. A hardcoded ['none','pickets_wire'] makes the sweep's coverage an unstated
// assumption — and this work spent a whole session probing three of the five revetments before
// noticing the other two existed at all. A new revetment is now swept the day it is added.
test('screen, paper and CSV present the same build order', () => {
  // The highest-stakes parity in the app: the sheet carried to the site must be the sequence the
  // planner showed. Swept over 320 designs rather than spot-checked, and scoped to each surface's
  // SEQUENCE region — "Overhead cover" is also a spec row, so a whole-document search finds the
  // wrong occurrence and reports a phantom reordering.
  const between = (t: string, from: RegExp, to: RegExp): string => {
    const a = from.exec(t);
    if (!a) return t;
    const rest = t.slice(a.index + a[0].length);
    const b = to.exec(rest);
    return b ? rest.slice(0, b.index) : rest;
  };

  let checked = 0;
  for (const positionType of Object.keys(positions)) {
    for (const revetment of Object.keys(revetments)) {
      for (const overheadCover of [true, false]) {
        const r = compute(defaultInputs({ positionType, revetment, overheadCover, sump: true, camouflage: true, count: 2 }));
        const plan = computeStages(r).steps;
        const sched = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 2 });
        const at = `${positionType}/${revetment}/oh:${overheadCover}`;

        const surfaces: [string, string, boolean][] = [
          ['screen', between(scheduleOverlay(sched, 4, 999, 1, ctxOf(r)).replace(/<[^>]+>/g, ' '), /Do this, in this order/, /Stages run in doctrinal order/), true],
          ['paper', between(jobSheet(r, { scenario: 'p', date: '2026-01-01' }).replace(/<[^>]+>/g, ' '), /Priorities of work/i, /Bill of materials/i), true],
          // The CSV is not HTML — its labels carry a raw '&', not '&amp;'.
          ['csv', toCsv(r, { scenario: 'p', date: '2026-01-01' }).split('\n').filter((l) => l.startsWith('Sequence,')).join('\n'), false],
        ];
        const want = plan.map((s) => s.id).join(' > ');
        for (const [name, text, htmlEscaped] of surfaces) {
          const got = plan
            .map((s) => ({ id: s.id, i: text.indexOf(htmlEscaped ? s.label.replace(/&/g, '&amp;') : s.label) }))
            .filter((x) => x.i >= 0)
            .sort((a, b) => a.i - b.i)
            .map((x) => x.id)
            .join(' > ');
          assert.equal(got, want, `${at}/${name}: build order differs from the plan`);
        }
        checked++;
      }
    }
  }
  assert.ok(checked >= 40, 'swept a real spread of designs, got ' + checked);
});

test('the summary bar says whose numbers it is showing', () => {
  // Every cell is a whole-order figure, which was consistent but unstated: a 7-position order read
  // "Spoil 507.5 ft³" with nothing saying one hole or all seven — on the strip most likely to be
  // read without opening the panel that would have explained it.
  const one = summaryBar(compute(defaultInputs({ positionType: 'two_man', count: 1 })));
  const many = summaryBar(compute(defaultInputs({ positionType: 'two_man', count: 7 })));
  assert.doesNotMatch(one, /Positions/, 'a single position needs no scope cell');
  assert.match(many, /Positions<\/span><span class="s-v">7/, 'a multi-position order states its scope');

  // And the figures it scopes really are order-wide, so the label is true.
  const r = compute(defaultInputs({ positionType: 'two_man', count: 7 }));
  assert.ok(summaryBar(r).includes(String(Math.round(r.labor.manHoursTotal * 10) / 10)), 'man-hours cell is the order total');
});

test('the main screen offers a route to the build sequence, with or without 3D', () => {
  // The no-WebGL fallback has always carried an "Open build schedule" button, because losing the
  // scrubber leaves that device with no visible route to the order. The WebGL path had none — so
  // the app guided a user to the full sequence better when the 3D was BROKEN than when it worked,
  // where the only way through was the hamburger menu. This is the whole point of the tool; it
  // should not be a menu hunt on the primary path.
  const r = compute(defaultInputs({ positionType: 'two_man' }));
  const state = { inputs: r.inputs, layoutMode: 'desktop', layoutOverride: 'auto' } as never;

  for (const webglOk of [true, false]) {
    const html = renderApp(state, r, webglOk, false);
    // Routes that are NOT inside the hamburger menu panel.
    const outsideMenu = html.split('<div class="menu-panel"').map((chunk, i) => (i === 0 ? chunk : chunk.split('</details>').slice(1).join('</details>'))).join('');
    assert.match(outsideMenu, /data-action="schedule"/,
      `webglOk=${webglOk}: the main screen must reach the build sequence without opening a menu`);
  }

  // And the scrubber path still keeps its walk-the-build controls alongside it.
  const withGl = renderApp(state, r, true, false);
  assert.match(withGl, /data-action="three-stage-first"/, 'start-at-step-1 survives');
  assert.match(withGl, /id="three-stage"/, 'the scrubber survives');
});

test('a short schedule offers the tool that fixes it, carrying its own constraint', () => {
  // The verdict already named the fix — "cut the standard, add hands, build fewer positions" — and
  // the app already contained the tool that performs that search. They were connected only by the
  // user remembering a hamburger menu. And the handoff has to carry the schedule's own hours and
  // team: the planner's defaults are 8 hr / team of 2, so an unparameterised link would search a
  // budget the user never set.
  const r = compute(defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced', soil: 'rock', count: 3 }));
  const plan = computeStages(r);

  const short = scheduleStages(plan, { teamSize: 6, availableHours: 12, securityPostureFrac: 0.75, positions: 3 });
  assert.equal(short.feasible, false, 'fixture must not fit');
  const shortHtml = scheduleOverlay(short, 6, 12, 0.75, ctxOf(r));
  assert.match(shortHtml, /data-action="plan-from-schedule"/, 'a short schedule routes to the planner');
  assert.match(shortHtml, /data-hours="12"/, 'it carries the hours the user entered');
  assert.match(shortHtml, /data-team="6"/, 'it carries the real team, not the posture-reduced diggers');

  // A job that fits has nothing to solve, so it must not offer the escape hatch.
  const fits = scheduleStages(plan, { teamSize: 6, availableHours: 100000, securityPostureFrac: 0.75, positions: 3 });
  assert.equal(fits.feasible, true, 'fixture must fit at a huge budget');
  assert.doesNotMatch(scheduleOverlay(fits, 6, 100000, 0.75, ctxOf(r)), /plan-from-schedule/,
    'a schedule that fits offers no fix-it link');
});

test('the planner discloses that its clock ignores security posture', () => {
  // It divides by the whole team; the schedule divides by the diggers actually on the tools. For
  // the same design the two differ by exactly 1/posture, so an option can fit the planner's budget
  // and still miss stand-to — which matters most for a user who arrived from that very panel.
  const base = defaultInputs({ positionType: 'two_man', standard: 'deliberate', count: 3 });
  const result = planForTime({ availableHours: 40, teamSize: 4, base });
  const best = result.feasible[0];
  assert.ok(best, 'fixture yields a feasible option');

  const r = compute({ ...base, standard: best.standard, overheadCover: best.overheadCover, revetment: best.revetment, teamSize: 4 });
  const posture = 0.75;
  const sched = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 40, securityPostureFrac: posture, positions: 3 });
  // The gap is exactly the posture factor — this is a model difference, not a rounding wobble.
  assert.ok(Math.abs(sched.allPositionsHours - best.elapsedHours / posture) < 0.15,
    `the two clocks should differ by 1/posture: planner ${best.elapsedHours}, schedule ${sched.allPositionsHours}`);
  assert.match(planOverlay(result, 40, 4), /Assumes the whole team digs/,
    'the planner states which clock it is using');
});

test('the exported bill is ordered by the step that draws it', () => {
  // The Step column was added so the spreadsheet could answer "when do I need this". The rows
  // stayed in bill order, so it ran 3,4,5,6,4,4,6,4 down the page — the answer was in the file and
  // unreadable at a glance, in the one document a supply request gets built from.
  for (const positionType of Object.keys(positions)) {
    for (const revetment of Object.keys(revetments)) {
      for (const overheadCover of [true, false]) {
        const r = compute(defaultInputs({ positionType, revetment, overheadCover, sump: true, camouflage: true, count: 3 }));
        const csv = toCsv(r, { scenario: 'p', date: '2026-01-01' });
        const bom = csv.split('\r\n').filter((l) => l.startsWith('BOM,'));
        const at = `${positionType}/${revetment}/oh:${overheadCover}`;
        assert.equal(bom.length, r.bom.length, at + ': every bill line is exported exactly once');

        const steps = bom.map((l) => Number(l.split(',')[1]));
        assert.deepEqual(steps, [...steps].sort((a, b) => a - b), at + ': rows run in build order, got ' + steps.join(','));

        // Nothing lost or duplicated by the sort — same labels, same multiset.
        const exported = bom.map((l) => l.split(',')[2]).sort();
        const expected = r.bom.map((b) => (b.label.includes(',') ? '"' + b.label + '"' : b.label)).sort();
        assert.deepEqual(exported, expected, at + ': the sort reorders, it does not edit');

        // Stable within a step: lines drawn at the same step keep the bill's own grouping.
        const plan = computeStages(r);
        const stepOf = new Map<string, number>();
        plan.steps.forEach((s, i) => s.bom.forEach((b) => stepOf.set(b.id, i + 1)));
        const wantOrder = r.bom
          .map((b, i) => ({ label: b.label, i, step: stepOf.get(b.id) ?? Number.MAX_SAFE_INTEGER }))
          .sort((a, b) => a.step - b.step || a.i - b.i)
          .map((x) => x.label);
        const gotOrder = bom.map((l) => l.split(',')[2]!.replace(/^"|"$/g, ''));
        assert.deepEqual(gotOrder, wantOrder, at + ': stable within a step');
      }
    }
  }
});

test('no internal id reaches a user-facing surface', () => {
  // Fourth instance of one defect: the job sheet once printed "at-rpg", "sand" and "deliberate";
  // those were fixed and `cover.material` was missed, so a crew's sheet still read
  // `1'-2" sandbagged_soil`. Asserting the CLASS instead of the instance.
  //
  // Only ids containing '_' or '-' are checked. Those can never be legitimate prose, so this has
  // no false positives — where a bare id like 'sand' collides with the English word, the label
  // ("Sand") is what should appear and a substring test could not tell them apart.
  const slugs = [
    ...Object.keys(positions), ...Object.keys(soils), ...Object.keys(threats),
    ...Object.keys(revetments), ...Object.keys(standards),
    'sandbagged_soil', 'snow_ice',
  ].filter((id) => /[_-]/.test(id));
  assert.ok(slugs.length > 15, 'the id set under test is substantial, got ' + slugs.length);

  for (const positionType of ['two_man', 'fifty_cal', 'vehicle_hull_defilade', 'atgm_javelin']) {
    for (const threat of ['ind-mtr-81', 'at-rpg', 'sa-556']) {
      for (const revetment of Object.keys(revetments)) {
        const r = compute(defaultInputs({ positionType, threat, revetment, overheadCover: true, sump: true, camouflage: true, count: 3 }));
        const sched = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 3 });
        const at = `${positionType}/${threat}/${revetment}`;

        const surfaces: Record<string, string> = {
          specsPanel: specsPanel(r),
          bomPanel: bomPanel(r),
          jobSheet: jobSheet(r, { scenario: 'p', date: '2026-01-01' }),
          schedule: scheduleOverlay(sched, 4, 999, 1, ctxOf(r)),
          compare: compareOverlay([r]),
          stageCaption: STAGE_ORDER.map((_, i) => stageCaption(i, r)).join(' '),
          validation: r.validation.map((v) => v.message).join(' '),
          // Same coverage question as the metric sweep: the drawings carry a title, a legend and a
          // header naming the position; the control form's hints name soils and standards; the CSV
          // and the time planner both print chosen options. All four state ids in their MARKUP and
          // must state labels in their text — which is precisely the distinction this sweep draws.
          drawPlan: drawPlan(r),
          drawSection: drawSection(r),
          drawIso: drawIso(r),
          controlsHtml: controlsHtml(r.inputs),
          csv: toCsv(r, { scenario: 'p', date: '2026-01-01' }),
          planOverlay: planOverlay(planForTime({ availableHours: 24, teamSize: 4, base: r.inputs }), 24, 4),
        };
        for (const [name, html] of Object.entries(surfaces)) {
          // Visible text only: an id inside value="" or data-* is correct markup, not a leak.
          const text = html.replace(/<[^>]*>/g, ' ');
          for (const slug of slugs) {
            assert.ok(!text.includes(slug), `${name} @ ${at}: internal id "${slug}" printed as text`);
          }
        }
      }
    }
  }
});

test('the description names every structural feature its drawing calls out', () => {
  // The text that stands IN PLACE of the picture must not omit what the picture shows. Previously
  // every one of the ten positions did: the parapet was never named, both vehicle defilades left
  // out the berm and the 11 m access ramp, three positions left out the firing step, and the ATGM
  // position left out its backblast danger area — the one hazard on any of these drawings.
  //
  // The legend a drawing prints IS its own statement of what it contains, so that is what the
  // description is checked against. Matched on each callout's distinctive word: matching every word
  // of the label reported false passes ("wall" from "revetted walls", "vehicle" from the position's
  // own name) and hid all ten.
  const TERM: Record<string, string> = {
    parapet: 'parapet', overhead: 'overhead', sump: 'sump', firing_step: 'firing',
    berm: 'berm', ramp: 'ramp', elbow: 'elbow', backblast: 'backblast', engineered: 'engineer',
  };
  const usedIn = (svg: string): string[] =>
    Object.entries(CALLOUTS).filter(([, d]) => svg.includes(d.label)).map(([k]) => k);

  let checkedFeatures = 0;
  for (const positionType of Object.keys(positions)) {
    for (const overheadCover of [true, false]) {
      const r = compute(defaultInputs({ positionType, revetment: 'pickets_wire', sump: true, overheadCover, threat: 'ind-mtr-81' }));
      const drawn = [...new Set([...usedIn(drawPlan(r)), ...usedIn(drawSection(r))])].filter((k) => TERM[k]);
      const desc = (describe(r, 'plan').desc + ' ' + describe(r, 'section').desc).toLowerCase();
      for (const key of drawn) {
        assert.ok(desc.includes(TERM[key]!),
          `${positionType} (overhead:${overheadCover}): the drawing calls out "${CALLOUTS[key]!.label}" and the description never mentions it`);
        checkedFeatures++;
      }
    }
  }
  assert.ok(checkedFeatures > 50, 'the sweep exercised a real spread of features, got ' + checkedFeatures);

  // The hazard gets its own sentence rather than being buried mid-list between the elbow rests
  // and the camouflage.
  const atgm = describe(compute(defaultInputs({ positionType: 'atgm_javelin' })), 'plan').desc;
  assert.match(atgm, /backblast danger area[^.]*keep it clear\./i, 'the danger area is stated as its own sentence');
  assert.doesNotMatch(atgm.split('Features:')[1] ?? '', /backblast[^.]*,/, 'it is not an item in the feature list');
});

test('the front-protection step names the feature this design actually builds', () => {
  // The doctrine row cannot know which of the two a design has, so it read "Throw/place the
  // parapet or berm, front first" — a field document offering a crew a choice between two things
  // when only one applies to what they are standing in. And "front first" is an instruction a
  // through-route cannot follow: it has no front, which is why its drawing carries no FRONT/REAR
  // labels. Resolved from the same shape tests the drawings and the descriptions use.
  for (const positionType of Object.keys(positions)) {
    const r = compute(defaultInputs({ positionType }));
    const step = computeStages(r).steps.find((s) => s.id === 'parapet');
    if (!step) continue;
    const geo = r.geometry as GeometryModel;
    const detail = step.detail;

    assert.doesNotMatch(detail, /parapet or berm/i, positionType + ': must not offer both');
    if (geo.shape === 'vehicle_ramp') {
      assert.match(detail, /berm/i, positionType + ': a vehicle position builds a berm');
      assert.doesNotMatch(detail, /\bparapet\b/i, positionType + ': and not a parapet');
    } else {
      assert.match(detail, /parapet/i, positionType + ': every other shape builds a parapet');
      assert.doesNotMatch(detail, /\bberm\b/i, positionType + ': and not a berm');
    }
    if (geo.isOpenCorridor) {
      assert.doesNotMatch(detail, /front/i, positionType + ': a through-route has no front to build first');
    }
  }

  // The same resolved string reaches every surface — the schedule, the printed checklist and the
  // 3D caption all read it off computeStages, so none can go back to naming the other feature.
  const veh = compute(defaultInputs({ positionType: 'vehicle_turret_defilade' }));
  const idx = STAGE_ORDER.findIndex((x) => x.id === 'parapet');
  const sched = scheduleStages(computeStages(veh), { teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 1 });
  for (const [name, html] of [
    ['schedule', scheduleOverlay(sched, 4, 999, 1, ctxOf(veh))],
    ['job sheet', jobSheet(veh, { scenario: 'p', date: '2026-01-01' })],
    ['3D caption', stageCaption(idx, veh)],
  ] as const) {
    assert.match(html, /Doze the berm/i, name + ': names the berm');
    assert.doesNotMatch(html, /parapet or berm/i, name + ': no leftover both-ways wording');
  }
});

test('no build step names work this design does not do', () => {
  // Generalising the parapet/berm fix across the stage table. Two more rows named both halves of a
  // job a design may only half-do: with revetment 'none' the crew was told to "hold the walls
  // back", on the five positions doctrine gives no grenade sump they were told to dig them, and
  // every position was told to stake sectors of fire — including the five whose drawings show none
  // and whose own firing-step hint says they have no aiming direction.
  let sawRevetOnly = false, sawSumpOnly = false, sawBoth = false, sawNoSectors = false, sawSectors = false;

  for (const positionType of Object.keys(positions)) {
    for (const revetment of Object.keys(revetments)) {
      for (const sump of [true, false]) {
        const r = compute(defaultInputs({ positionType, revetment, sump, overheadCover: false, camouflage: false }));
        const geo = r.geometry as GeometryModel;
        const steps = computeStages(r).steps;
        const at = `${positionType}/${revetment}/sump:${sump}`;

        const revetsFace = revetments[revetment]?.buildsFace === true;
        const digsSumps = geo.plan.sumps.length > 0;

        const rs = steps.find((s) => s.id === 'revet_sump');
        if (rs) {
          const text = (rs.label + ' ' + rs.detail).toLowerCase();
          assert.equal(/revet|walls back|slough/.test(text), revetsFace, at + ': revetting named iff a face is built — ' + text);
          assert.equal(/sump/.test(text), digsSumps, at + ': sumps named iff sumps are dug — ' + text);
          if (revetsFace && digsSumps) sawBoth = true;
          else if (revetsFace) sawRevetOnly = true;
          else sawSumpOnly = true;
        }

        // A prone shell scrape describes an occupant lying down with an e-tool. The app's own
        // validation calls a vehicle position machine work, so neither the label nor the detail
        // may promise prone cover there.
        const hasty = steps.find((s) => s.id === 'hasty');
        if (hasty) {
          const text = (hasty.label + ' ' + hasty.detail).toLowerCase();
          const machineWork = r.validation.some((v) => v.code === 'MACHINE_REQUIRED_VEHICLE');
          if (machineWork) {
            assert.doesNotMatch(text, /prone|scrape/, at + ': a machine-dug cut is not a prone scrape — ' + text);
          } else {
            assert.match(text, /prone/, at + ': a hand-dug position still takes prone cover first');
          }
          // Either way the stage keeps its purpose: partial cover before the full cut.
          assert.match(text, /cover/, at + ': the step still says why it exists');
        }

        const sec = steps.find((s) => s.id === 'security');
        if (sec) {
          // Label AND detail: resolving only one leaves "Post security & stake sectors" sitting
          // over a detail that says only security is posted.
          const secText = sec.label + ' — ' + sec.detail;
          assert.equal(/sectors/i.test(secText), geo.plan.sectors.present,
            at + ': sectors named iff the plan draws them — ' + secText);
          // Security itself is never conditional — it is step 1 on every position.
          assert.match(sec.detail, /local security out/i, at + ': security is always posted');
          if (geo.plan.sectors.present) sawSectors = true; else sawNoSectors = true;
        }
      }
    }
  }
  assert.ok(sawBoth && sawRevetOnly && sawSumpOnly, 'the sweep covered all three revet/sump combinations');
  assert.ok(sawSectors && sawNoSectors, 'the sweep covered positions with and without sectors of fire');
});

test('every surface that turns placeholder rates into a claim says they are placeholders', () => {
  // The labor panel, the job sheet and the CSV all disclosed it. The priorities-of-work panel —
  // the ONE surface that turns those rates into a go/no-go verdict ("Ready with 21.6 hr to spare",
  // "By stand-to you are through step 2 of 7") — did not. A readiness call reads as an assurance;
  // it rests entirely on rates the app itself calls illustrative.
  const r = compute(defaultInputs({ positionType: 'two_man', count: 3 }));
  const plan = computeStages(r);

  for (const [label, hours] of [['fits', 100000], ['does not fit', 1]] as const) {
    const sched = scheduleStages(plan, { teamSize: 4, availableHours: hours, securityPostureFrac: 0.75, positions: 3 });
    const html = scheduleOverlay(sched, 4, hours, 0.75, ctxOf(r));
    const text = html.replace(/<[^>]+>/g, ' ');
    // Shown either way: a schedule that FITS is exactly where an unqualified verdict misleads most.
    assert.match(text, /ILLUSTRATIVE placeholders/, label + ': the schedule states the rates are placeholders');
    assert.match(text, /verdict above is an estimate/i, label + ': and that this qualifies the verdict');
  }

  // One string, shared with the engine's own assumption list — so the panel cannot drift from
  // what the job sheet and the CSV say.
  assert.ok(r.labor.assumptions.includes(RATES_ARE_PLACEHOLDERS), 'the engine publishes the same sentence');
  const sched = scheduleStages(plan, { teamSize: 4, availableHours: 40, securityPostureFrac: 0.75, positions: 3 });
  assert.ok(scheduleOverlay(sched, 4, 40, 0.75, ctxOf(r)).includes(RATES_ARE_PLACEHOLDERS.replace(/&/g, '&amp;')),
    'and the panel prints that same sentence, not a paraphrase');

  // The other labour surfaces keep theirs.
  for (const [name, html] of [
    ['labor panel', laborPanel(r)],
    ['job sheet', jobSheet(r, { scenario: 'p', date: '2026-01-01' })],
    ['csv', toCsv(r, { scenario: 'p', date: '2026-01-01' })],
  ] as const) {
    assert.match(html.replace(/<[^>]+>/g, ' '), /ILLUSTRATIVE placeholders/, name + ': still discloses');
  }
});

test('the standard picker states what each standard costs on this position', () => {
  // The hint said only that hasty is "fast" and reinforced "slowest" — on the biggest lever in the
  // tool, whose spread reaches 110 vs 300 man-hours on a vehicle turret-defilade. The planner and
  // the compare tool can both show it, but only after a trip to the hamburger menu.
  for (const positionType of Object.keys(positions)) {
    for (const soil of ['loam', 'rock']) {
      const inputs = defaultInputs({ positionType, soil });
      const hint = controlsHtml(inputs).split('id="f-standard"')[1]?.split('</label>')[0] ?? '';
      const at = `${positionType}/${soil}`;

      // Every standard is named with its own figure, and they are THIS design's numbers.
      const figures = (Object.keys(standards) as string[]).map((id) => {
        const mh = compute({ ...inputs, standard: id as typeof inputs.standard }).labor.manHoursPerPosition;
        return { id, shown: Math.round(mh) };
      });
      for (const f of figures) {
        assert.ok(hint.toLowerCase().includes(standards[f.id]!.label.toLowerCase()), `${at}: names ${f.id}`);
        assert.ok(hint.includes(String(f.shown)), `${at}: ${f.id} should show ${f.shown} man-hr — got: ${hint.slice(0, 160)}`);
      }
      // Placeholder-derived, and marked like every other such figure.
      assert.match(hint, /\(PH\)/, at + ': the ladder is marked as placeholder-derived');

      // The ladder must be ordered: more standard, more work. If that ever inverts, the hint is
      // teaching the trade backwards.
      const order = ['hasty', 'deliberate', 'reinforced'].map((id) => figures.find((f) => f.id === id)!.shown);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), at + ': hasty ≤ deliberate ≤ reinforced, got ' + order.join(' '));
    }
  }

  // It tracks the rest of the design, not just the position: a harder soil moves every rung.
  const loam = controlsHtml(defaultInputs({ positionType: 'bunker_op_cp', soil: 'loam' }));
  const rock = controlsHtml(defaultInputs({ positionType: 'bunker_op_cp', soil: 'rock' }));
  const rungs = (html: string): string => html.split('id="f-standard"')[1]!.split('</label>')[0]!;
  assert.notEqual(rungs(loam), rungs(rock), 'the ladder reflects the soil the user chose');
});

test('the soil picker states what the ground actually costs', () => {
  // Measured before writing: soil moves build time MORE than any other axis, on every position —
  // ×3.45 against the standard's ×2.74 on a vehicle turret-defilade — a consequence of digFactor
  // scaling the excavation term. The hint said only that it "changes how hard the dig is", which
  // is the one thing the user already knew. Unlike the standard this is not a choice; it decides
  // whether the job fits at all.
  const hintOf = (inputs: ReturnType<typeof defaultInputs>): string =>
    controlsHtml(inputs).split('id="f-soil"')[1]?.split('</label>')[0]?.replace(/<[^>]+>/g, '') ?? '';
  const easiest = (Object.keys(soils) as string[])
    .reduce((a, b) => (soils[a]!.digFactor.value <= soils[b]!.digFactor.value ? a : b));

  for (const positionType of Object.keys(positions)) {
    const shown: { dig: number; mh: number }[] = [];
    for (const soil of Object.keys(soils)) {
      const inputs = defaultInputs({ positionType, soil });
      const hint = hintOf(inputs);
      const at = `${positionType}/${soil}`;
      const dig = soils[soil]!.digFactor.value;

      assert.ok(hint.includes(soils[soil]!.label), at + ': names the soil');
      assert.ok(hint.includes('×' + dig), at + ': states the dig multiplier — got ' + hint.slice(-90));

      if (soil === easiest) {
        assert.match(hint, /easiest ground/, at + ': the easiest soil says so');
        assert.doesNotMatch(hint, /against/, at + ': and has nothing to compare against');
      } else {
        const here = Math.round(compute(inputs).labor.manHoursPerPosition);
        const best = Math.round(compute({ ...inputs, soil: easiest }).labor.manHoursPerPosition);
        assert.ok(hint.includes(String(here)) && hint.includes(String(best)), at + ': shows both figures');
        assert.ok(here >= best, at + ': harder ground cannot be quicker');
        assert.match(hint, /\(PH\)/, at + ': placeholder-derived figures are marked');
      }
      shown.push({ dig, mh: compute(inputs).labor.manHoursPerPosition });
    }
    // Across the whole soil table, more dig factor must never mean fewer man-hours — otherwise the
    // hint would rank the ground backwards.
    const byDig = [...shown].sort((a, b) => a.dig - b.dig).map((x) => Math.round(x.mh * 100) / 100);
    assert.deepEqual(byDig, [...byDig].sort((a, b) => a - b), positionType + ': man-hours rise with dig factor');
  }
});

test('a blocking problem is not headed "things to double-check"', () => {
  // Four surfaces carry the same validation data. Three escalated on an error — "do not build" in
  // the compare table, "Fix before building" in the schedule and in TIMBER-1's printed sheet — and
  // the fourth, the one always on screen, called a wall that will slough something to double-check.
  // The mildest reading of a blocking problem was the default view.
  const blocked = compute(defaultInputs({ positionType: 'two_man', soil: 'sand', revetment: 'none' }));
  const errs = blocked.validation.filter((v) => v.severity === 'error');
  assert.ok(errs.length > 0, 'fixture must produce a blocking error');

  const panel = validationPanel(blocked);
  assert.match(panel, /Fix before building/, 'the panel escalates when the design is blocked');
  assert.ok(panel.includes('Fix before building — ' + errs.length + ' problem' + (errs.length === 1 ? '' : 's')),
    'and counts them the way the other surfaces do');
  assert.doesNotMatch(panel, /Things to double-check/, 'and drops the mild heading entirely');
  assert.match(panel, /has-errors/, 'so the heading can be coloured like the severity chip beside it');

  // A design with only warnings/advisories keeps the mild heading — escalating everything would
  // make the escalation meaningless.
  const advisory = compute(defaultInputs({ positionType: 'two_man', soil: 'loam', revetment: 'none' }));
  assert.equal(advisory.validation.filter((v) => v.severity === 'error').length, 0, 'fixture has no errors');
  assert.ok(advisory.validation.length > 0, 'but does have something to say');
  const mild = validationPanel(advisory);
  assert.match(mild, /Things to double-check/, 'non-blocking issues stay a double-check');
  assert.doesNotMatch(mild, /Fix before building/, 'and do not borrow the blocking wording');
  assert.doesNotMatch(mild, /has-errors/, 'nor the blocking colour');

  // The wording matches what the other surfaces already say, rather than being a fourth phrasing.
  const sched = scheduleStages(computeStages(blocked), { teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 1 });
  assert.match(scheduleOverlay(sched, 4, 999, 1, ctxOf(blocked)), /Fix before building/, 'schedule agrees');
});

test('breaking a design is announced, not just shown', () => {
  // The live region read after every edit named only the labour figures. A screen-reader user could
  // switch the soil to one the app says will slough the walls and hear "Updated. 12.1 man-hours per
  // position" — the blocking state reachable only by navigating to a panel further down and
  // noticing it had changed, while a sighted user gets a heading that turns red.
  const blocked = compute(defaultInputs({ positionType: 'two_man', soil: 'sand', revetment: 'none' }));
  const errs = blocked.validation.filter((v) => v.severity === 'error').length;
  assert.ok(errs > 0, 'fixture must be blocked');

  const spoken = statusAnnouncement(blocked);
  // Leads with it: a live region is read in order, and the first clause is the one acted on.
  assert.ok(spoken.startsWith('Fix before building — ' + errs + ' problem' + (errs === 1 ? '' : 's') + '.'),
    'the blocking state comes first — got: ' + spoken);
  // Same words the panel shows, so the spoken and visible statements cannot diverge.
  assert.ok(validationPanel(blocked).includes('Fix before building — ' + errs + ' problem' + (errs === 1 ? '' : 's')),
    'and match the panel heading exactly');
  // The numbers are still there — the announcement gains the verdict, it does not lose the figures.
  assert.ok(spoken.includes(String(blocked.labor.manHoursPerPosition)), 'man-hours still announced');
  assert.ok(spoken.includes(String(blocked.labor.elapsedHours)), 'elapsed still announced');

  // A design with warnings/notes but no error is NOT escalated: this region speaks on every edit,
  // and one that cries wolf stops being listened to.
  const noisy = compute(defaultInputs({ positionType: 'bunker_op_cp', soil: 'rock', revetment: 'pickets_wire' }));
  assert.equal(noisy.validation.filter((v) => v.severity === 'error').length, 0, 'fixture has no errors');
  assert.ok(noisy.validation.some((v) => v.severity !== 'error'), 'but does have warnings or notes');
  assert.ok(statusAnnouncement(noisy).startsWith('Updated.'), 'non-blocking edits stay quiet about severity');

  // And it changes when the design becomes blocked, or the region would never re-announce.
  assert.notEqual(statusAnnouncement(blocked), statusAnnouncement(compute(defaultInputs({ positionType: 'two_man', soil: 'sand', revetment: 'pickets_wire' }))),
    'fixing the design changes what is spoken');
});

test('saved setups say what they are, not just what they are called', () => {
  // The list showed a name and three buttons. Every scenario carries its full inputs, and none of
  // them were shown — so telling "OP North" from "OP North copy" meant LOADING one, which replaces
  // the design being worked on. A chooser that cannot be chosen from.
  const mk = (id: string, name: string, over: Parameters<typeof defaultInputs>[0]) =>
    ({ schemaVersion: 1, id, name, inputs: defaultInputs(over) });
  const list = [
    mk('a', 'OP North', { positionType: 'bunker_op_cp', standard: 'reinforced', soil: 'rock', threat: 'at-rpg' }),
    mk('b', 'OP North copy', { positionType: 'two_man', standard: 'hasty', soil: 'sand', threat: 'none', count: 4 }),
  ];
  const html = scenariosOverlay(list, 'a');

  // Each row states the four facts that decide what a position is.
  assert.match(html, /Bunker \/ OP-CP/, 'names the first position');
  assert.match(html, /Reinforced/, 'and its standard');
  assert.match(html, /Rock/, 'and its soil');
  assert.match(html, /RPG \(shaped charge\)/, 'and its threat');
  assert.match(html, /Two-man fighting position/, 'names the second position');
  assert.match(html, /Hasty/, 'and its standard');
  assert.match(html, /None/, 'threat "none" is a real answer, not a blank');
  assert.match(html, /×4/, 'a multi-position order says so');

  // Through the shared label helpers, so this list can never be the surface that prints a raw id.
  for (const slug of ['bunker_op_cp', 'two_man', 'at-rpg', 'sandbag_facing', 'pickets_wire']) {
    assert.ok(!html.replace(/<[^>]*>/g, ' ').includes(slug), 'no internal id reaches the list: ' + slug);
  }
  // A single position does not clutter the line with a count.
  assert.doesNotMatch(scenariosOverlay([mk('c', 'One', { count: 1 })], null), /×1/, 'no ×1 noise');
});

test('the group roll-up shows what went into it, and lets one back out', () => {
  // The panel took a bare COUNT, so it could not have listed the set even if it wanted to: a user
  // who added the wrong position saw a bill built partly from it, with no way to see what went in
  // and no way to take one back out. "Clear" and re-add every other position was the only recourse
  // — while the compare table has had per-item removal all along.
  const items = [
    { inputs: defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced', soil: 'rock', threat: 'at-rpg' }) },
    { inputs: defaultInputs({ positionType: 'two_man', standard: 'hasty', soil: 'sand', threat: 'none', count: 4 }) },
  ];
  const html = missionOverlay(aggregateMission(items, {}), items, 'imperial');

  // Every position in the set is named, by the same helpers every other surface uses.
  assert.match(html, /Bunker \/ OP-CP · Reinforced · Rock · RPG \(shaped charge\)/, 'first entry stated in full');
  assert.match(html, /Two-man fighting position · Hasty · Sand · None · ×4/, 'second entry, including its order size');
  for (const slug of ['bunker_op_cp', 'two_man', 'at-rpg']) {
    assert.ok(!html.replace(/<[^>]*>/g, ' ').includes(slug), 'no internal id in the set list: ' + slug);
  }

  // Each is individually removable, indexed so the handler can splice the right one.
  const removes = [...html.matchAll(/data-action="mission-remove" data-idx="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(removes, [0, 1], 'one remove per entry, in order');
  assert.match(html, /aria-label="Remove position 1 from the group job"/, 'and each says which it removes');

  // An empty set offers nothing to remove or clear — only something to add.
  const empty = missionOverlay(aggregateMission([], {}), [], 'imperial');
  assert.doesNotMatch(empty, /mission-remove/, 'nothing to remove from an empty set');
  assert.doesNotMatch(empty, /mission-clear/, 'nor to clear');
  assert.match(empty, /mission-add/, 'but adding is still offered');

  // The count in the heading is the ORDER size, not the number of entries — two entries covering
  // 1 and 4 positions is a five-position job.
  assert.match(html, /Group job list — 5 position\(s\)/, 'the heading counts positions, not entries');
});

test('the group roll-up reconciles with its parts, and says whose crew it used', () => {
  // A roll-up is only worth anything if it adds up. And aggregateMission takes the LARGEST team
  // among the entries and applies it to all of them, so a two-man hole planned for a crew of 2,
  // combined with a bunker planned for 12, is costed as if twelve people worked the two-man hole.
  // The figure was shown and the assumption behind it was not.
  const items = [
    { inputs: defaultInputs({ positionType: 'bunker_op_cp', standard: 'reinforced', soil: 'rock', count: 3, teamSize: 12 }) },
    { inputs: defaultInputs({ positionType: 'two_man', standard: 'hasty', soil: 'sand', count: 4, teamSize: 2 }) },
    { inputs: defaultInputs({ positionType: 'mortar_pit', count: 1, teamSize: 6 }) },
  ];
  const m = aggregateMission(items, {});

  // Totals ARE the sum of the parts — positions, labour and every bill line.
  assert.equal(m.totalPositions, items.reduce((a, i) => a + i.inputs.count, 0), 'positions add up');
  const sumMh = items.reduce((a, i) => a + compute(i.inputs).labor.manHoursTotal, 0);
  assert.ok(Math.abs(m.totalManHours - sumMh) < 0.01, `man-hours add up: ${m.totalManHours} vs ${sumMh}`);
  for (const line of m.lines) {
    const parts = items.reduce((a, i) => a + (compute(i.inputs).bom.find((b) => b.id === line.id)?.qtyTotal ?? 0), 0);
    assert.ok(Math.abs(line.qtyTotal - parts) < 0.01, `${line.label}: ${line.qtyTotal} vs ${parts}`);
  }
  // Removing an entry moves the total by exactly that entry's own contribution — the property the
  // new Remove button depends on.
  for (let k = 0; k < items.length; k++) {
    const without = aggregateMission(items.filter((_, i) => i !== k), {});
    const own = compute(items[k]!.inputs).labor.manHoursTotal;
    assert.ok(Math.abs((m.totalManHours - without.totalManHours) - own) < 0.01, 'removing entry ' + (k + 1) + ' is exact');
  }

  // The crew it used is the largest, and the panel says so when the entries disagree.
  assert.equal(m.teamSize, 12, 'the largest crew is the one applied');
  const html = missionOverlay(m, items, 'imperial');
  assert.match(html, /Elapsed uses the largest crew among the entries \(12\)/, 'names the crew it used');
  assert.match(html, /crews of 2, 6, 12/, 'and what the entries were actually planned for');

  // A set that agrees has nothing to disclose, and must not be given a note anyway.
  const agreed = [items[1]!, { inputs: defaultInputs({ positionType: 'one_man', teamSize: 2 }) }];
  assert.doesNotMatch(missionOverlay(aggregateMission(agreed, {}), agreed, 'imperial'),
    /largest crew/, 'no note when every entry used the same crew');
});

test('the placeholder disclosure stops once the rates are actually verified', () => {
  // This app exists to be filled in: importDoctrine writes both value AND status into the live
  // leaves, so a user who confirms these rates against the pub and re-imports them as DOCTRINE has
  // genuinely verified them. Saying "ILLUSTRATIVE placeholders" anyway tells their crew the numbers
  // are untrustworthy after they did the work to make them trustworthy — and discourages the one
  // action the whole provenance regime exists for.
  const leaves = Object.values(laborDoctrine) as { status: string }[];
  const original = leaves.map((l) => l.status);
  try {
    // As shipped: every rate is a placeholder, so the full disclaimer stands.
    assert.equal(ratesNote(), RATES_ARE_PLACEHOLDERS, 'unverified rates carry the full disclaimer');
    assert.ok(compute(defaultInputs({})).labor.assumptions.includes(RATES_ARE_PLACEHOLDERS), 'and it reaches the assumptions');

    // Verify ONE of them: the claim must soften, not vanish — the others are still placeholders.
    leaves[0]!.status = 'DOCTRINE';
    const partial = ratesNote();
    assert.ok(partial && /Some man-hour rates are still ILLUSTRATIVE/.test(partial), 'partial verification says "some": ' + partial);
    assert.ok(compute(defaultInputs({})).labor.assumptions.some((a) => a === partial), 'and that is what the assumptions carry');

    // Verify them all: the claim goes, because it would now be false.
    for (const l of leaves) l.status = 'DOCTRINE';
    assert.equal(ratesNote(), null, 'fully verified rates carry no placeholder claim');
    const verified = compute(defaultInputs({}));
    assert.ok(!verified.labor.assumptions.some((a) => /ILLUSTRATIVE/.test(a)), 'nothing calls them illustrative any more');
    // The other assumptions survive — this removes a claim, it does not gut the list.
    assert.ok(verified.labor.assumptions.length >= 4, 'the rest of the assumptions stand');

    // And the schedule verdict follows: still an estimate, no longer "resting on placeholders".
    const sched = scheduleStages(computeStages(verified), { teamSize: 4, availableHours: 999, securityPostureFrac: 1, positions: 1 });
    const html = scheduleOverlay(sched, 4, 999, 1, ctxOf(verified));
    assert.match(html, /verdict above is an estimate/i, 'the verdict is still qualified as an estimate');
    assert.doesNotMatch(html, /ILLUSTRATIVE/, 'but no longer claims the rates are placeholders');
  } finally {
    leaves.forEach((l, i) => { l.status = original[i]!; });
  }
  // Restored, so no other test sees a mutated doctrine table.
  assert.equal(ratesNote(), RATES_ARE_PLACEHOLDERS, 'doctrine restored after the test');
});

test('every placeholder marker in the app clears when its data is verified', () => {
  // The "NOT FOR FIELD USE" banner and the labour assumptions both already clear themselves when
  // the leaves are filled in — doctrine/types.ts: "clears only when zero placeholders remain".
  // The control hints added later copied the (PH) marker without copying that rule, so they would
  // have gone on marking figures a user had verified.
  const leaves = [
    ...(Object.values(laborDoctrine) as { status: string }[]),
    ...(Object.values(standards) as { laborMul: { status: string } }[]).map((s) => s.laborMul),
    ...(Object.values(soils) as { digFactor: { status: string } }[]).map((s) => s.digFactor),
  ];
  const original = leaves.map((l) => l.status);
  const hintOf = (field: string): string => {
    const html = controlsHtml(defaultInputs({ positionType: 'bunker_op_cp', soil: 'rock' }));
    return html.split('id="f-' + field + '"')[1]?.split('</label>')[0]?.replace(/<[^>]+>/g, '') ?? '';
  };
  try {
    // As shipped, every labour-derived figure is marked.
    assert.match(hintOf('standard'), /\(PH\)/, 'the standard ladder is marked while unverified');
    assert.match(hintOf('soil'), /\(PH\)/, 'and so is the soil comparison');

    // Verify the rates but NOT the multipliers: still placeholder-derived, still marked.
    for (const l of Object.values(laborDoctrine) as { status: string }[]) l.status = 'DOCTRINE';
    assert.match(hintOf('standard'), /\(PH\)/, 'a verified rate with an unverified multiplier is still marked');
    assert.match(hintOf('soil'), /\(PH\)/, 'likewise for the dig factor');

    // Verify everything the figures rest on: the marker goes, and the figures stay.
    for (const l of leaves) l.status = 'DOCTRINE';
    const std = hintOf('standard');
    const soil = hintOf('soil');
    assert.doesNotMatch(std, /\(PH\)/, 'fully verified figures carry no marker');
    assert.doesNotMatch(soil, /\(PH\)/, 'likewise the soil hint');
    assert.match(std, /hasty \d+ · deliberate \d+ · reinforced \d+/, 'and the ladder itself survives');
    assert.match(soil, /dig ×3/, 'and the dig factor still shown');
  } finally {
    leaves.forEach((l, i) => { l.status = original[i]!; });
  }
  assert.match(hintOf('standard'), /\(PH\)/, 'doctrine restored after the test');
});

test('a removed group-list entry can be put back', () => {
  // The Remove button is destructive and the toolbar's Undo does not cover it: createHistory holds
  // Inputs only, so pressing Undo after a mis-click restores an earlier DESIGN and leaves the entry
  // gone — changing something the user did not ask about while failing to fix what they did. Same
  // single-level undo TIMBER-1 gives an opening it just removed.
  const items = [
    { inputs: defaultInputs({ positionType: 'bunker_op_cp', soil: 'rock' }) },
    { inputs: defaultInputs({ positionType: 'two_man', soil: 'sand' }) },
  ];
  // Not offered when there is nothing to put back — a dead control is worse than none.
  assert.doesNotMatch(missionOverlay(aggregateMission(items, {}), items, 'imperial'),
    /mission-undo/, 'no undo offered before anything is removed');
  // Offered once there is, and NAMED for the action: "Undo clear" after discarding a whole list
  // reads very differently from "Undo remove", and a user needs to be sure what comes back.
  const afterRemove = missionOverlay(aggregateMission([items[0]!], {}), [items[0]!], 'imperial', 'remove');
  assert.match(afterRemove, /data-action="mission-undo"/, 'offered after a removal');
  assert.match(afterRemove, /Undo remove/, 'and labelled for that action');
  const afterClear = missionOverlay(aggregateMission([], {}), [], 'imperial', 'clear');
  assert.match(afterClear, /Undo clear/, 'a cleared list can be brought back, and says so');

  // Restoring at the original index is what makes it an undo rather than a re-add: the engine's
  // aggregation is order-independent for totals, but the LIST a user reads is not.
  const removedAt = 0;
  const remaining = items.filter((_, i) => i !== removedAt);
  const restored = remaining.slice();
  restored.splice(Math.min(removedAt, restored.length), 0, items[removedAt]!);
  assert.deepEqual(restored.map((x) => x.inputs.positionType), items.map((x) => x.inputs.positionType),
    'the entry returns to where it was, not to the end');

  // And the roll-up is identical to before the removal — the undo must be exact, not approximate.
  const before = aggregateMission(items, {});
  const back = aggregateMission(restored, {});
  assert.equal(back.totalPositions, before.totalPositions, 'positions restored');
  assert.ok(Math.abs(back.totalManHours - before.totalManHours) < 1e-9, 'man-hours restored exactly');
  assert.deepEqual(back.lines.map((l) => [l.id, l.qtyTotal]), before.lines.map((l) => [l.id, l.qtyTotal]),
    'every bill line restored exactly');

  // The compare table had the SAME gap, longer — removing a column throws away a configuration
  // that took several edits to build. Fixed with the same flag rather than left as a known
  // asymmetry next to the one just closed.
  const r = compute(defaultInputs({ positionType: 'two_man' }));
  assert.doesNotMatch(compareOverlay([r]), /compare-undo/, 'compare offers no undo before a removal');
  assert.match(compareOverlay([r], 'remove'), /data-action="compare-undo"/, 'and offers one after');
  assert.match(compareOverlay([r], 'remove'), /Undo remove/, 'labelled the same way as the group list');
  assert.match(compareOverlay([], 'clear'), /Undo clear/, 'and a cleared comparison is recoverable too');
});

test('the help describes the panels as they are now, not as they were', () => {
  // Prose detaching from behaviour is this codebase's most-repeated defect, and the help is the
  // largest block of prose in it — written once and then left behind by every panel that changed.
  // The compare description named six of its rows while the table now has fourteen.
  const help = helpHtml().replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ');
  const r = compute(defaultInputs({ positionType: 'two_man', count: 3 }));
  const compareRows = [...compareOverlay([r]).matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]!.toLowerCase());
  assert.ok(compareRows.length >= 10, 'the compare table has a real spread of rows, got ' + compareRows.length);

  // Each row the help names must exist, and each row that exists must be findable from the help —
  // the second direction is what catches a panel growing past its own description.
  const claimed = ['position', 'standard', 'threat', 'soil', 'revetment', 'dig method', 'depth', 'cover', 'setback', 'sandbags', 'man-hours', 'elapsed', 'build steps'];
  const helpSection = help.slice(help.indexOf('Compare setups'), help.indexOf('Combine positions'));
  for (const name of claimed) {
    assert.ok(helpSection.toLowerCase().includes(name), 'the help names the "' + name + '" row');
    assert.ok(compareRows.some((row) => row.includes(name) || name.includes(row)),
      'and the table actually renders a "' + name + '" row');
  }
  for (const row of compareRows) {
    assert.ok(claimed.some((c) => row.includes(c) || c.includes(row)),
      'the table renders a "' + row + '" row the help never mentions');
  }

  // The two other panels this work changed are described as they now behave.
  assert.match(help, /how far down the sequence you get/i, 'the schedule help mentions the stand-to cutoff');
  assert.match(help, /hand your hours and crew straight to the time planner/i, 'and the handoff to the planner');
  assert.match(help, /remove any one entry without clearing the lot/i, 'the group-list help mentions per-entry removal');
});

test('the time planner searches every revetment and presents each decision once', () => {
  // It swept a hand-written ['none','sandbag_facing','pickets_wire'] — three of the five doctrine
  // defines — so corrugated metal and timber/plywood could never be offered, on the one panel whose
  // whole job is telling a user what they can build. And every facing costs the same time and
  // scores the same protection here (they differ only in materials), so enumerating them presented
  // ONE decision as four rows.
  const base = defaultInputs({ positionType: 'two_man', soil: 'sand' });
  const plan = planForTime({ availableHours: 40, teamSize: 4, base });

  // The search space is the doctrine tables, not a hand-written list on either axis.
  const searched = new Set(plan.feasible.map((o) => o.revetment));
  for (const rv of Object.keys(revetments)) {
    assert.ok(searched.has(rv), 'the planner must consider ' + rv);
  }
  const searchedStandards = new Set<string>(plan.feasible.map((o) => o.standard));
  for (const st of Object.keys(standards)) {
    assert.ok(searchedStandards.has(st), 'the planner must consider ' + st);
  }
  assert.equal(plan.feasible.length, Object.keys(standards).length * 2 * Object.keys(revetments).length,
    'the sweep is exactly standards x roof x revetments — a shrunk axis would silently hide options');

  const rows = [...planOverlay(plan, 40, 4).matchAll(/data-action="plan-apply" data-idx="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(rows.length < plan.feasible.length, `rows (${rows.length}) collapse options (${plan.feasible.length})`);
  // Each Use still points at a real option — collapsing must not break the index it applies.
  for (const idx of rows) assert.ok(plan.feasible[idx], 'row ' + idx + ' applies a real option');
  assert.deepEqual(rows, [...rows].sort((a, b) => a - b), 'rows stay in ranked order');

  // A facing is never merged with "none": they score differently, so that would hide a real choice.
  const html = planOverlay(plan, 40, 4);
  // Tags stripped first, and the separator matched as " / " — a raw /-test hits the closing tag of
  // the doctrine-issue <span> that can sit in the same cell.
  const cells = [...html.matchAll(/<td>(.*?)<\/td>/gs)].map((m) => m[1]!.replace(/<[^>]*>/g, '').trim());
  for (const cell of cells) {
    if (/\bNone\b/.test(cell) && cell.includes(' / ')) assert.fail('a row merged "None" with a facing: ' + cell);
  }
  // The rows that DO merge name every facing they cover, so a user can pick what they have.
  assert.match(html, /Corrugated metal \/ Pickets &amp; wire \/ Sandbag facing \/ Timber &amp; plywood/,
    'a merged row lists all four interchangeable facings');

  // The claim the merge rests on: those facings really are interchangeable in this model.
  const hours = Object.keys(revetments)
    .filter((rv) => rv !== 'none')
    .map((rv) => compute(defaultInputs({ positionType: 'two_man', revetment: rv })).labor.elapsedHours);
  assert.equal(new Set(hours).size, 1, 'every facing costs the same elapsed time — got ' + hours.join(', '));
});

test('the schedule form explains its own jargon, in the state where it is used', () => {
  // "% on the tools" silently drives every figure on the panel — the clock divides by team ×
  // posture, so 100 vs 75 moves every "Done by". It was explained only in the EMPTY state, which
  // disappears the moment a schedule exists: the guidance vanished exactly when the controls became
  // usable, and the panel is never empty once you have opened it on a design.
  const r = compute(defaultInputs({ positionType: 'two_man' }));
  const sched = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 24, securityPostureFrac: 0.75, positions: 1 });

  const populated = scheduleOverlay(sched, 4, 24, 0.75, ctxOf(r));
  assert.match(populated, /% on the tools is how much of the team is digging/, 'explained beside the control');
  assert.match(populated, /rest pull security/, 'and says where the others are');

  // Still explained before the first run, so the empty state did not lose anything.
  const empty = scheduleOverlay(null, 4, 24, 0.75, ctxOf(r));
  assert.match(empty, /on the tools/, 'the empty state still explains it too');

  // The posture the note describes is the one the clock actually uses.
  const half = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 24, securityPostureFrac: 0.5, positions: 1 });
  const full = scheduleStages(computeStages(r), { teamSize: 4, availableHours: 24, securityPostureFrac: 1, positions: 1 });
  assert.equal(half.effectiveDiggers, 2, 'half the team on the tools is two diggers of four');
  assert.equal(full.effectiveDiggers, 4, 'all of them is four');
  assert.ok(half.totalElapsedHours > full.totalElapsedHours, 'and fewer diggers really does take longer');
});

test('the planner says what it holds fixed, where the results are', () => {
  // The empty state said the sweep was "for the current position + threat"; the RESULTS state did
  // not. A user reading a table of standards and roofs had nothing telling them the position, soil
  // and threat were their own and unchanged — the fact that makes every row interpretable, present
  // only before there were any rows to interpret.
  for (const [positionType, soil, threat] of [
    ['bunker_op_cp', 'rock', 'at-rpg'],
    ['two_man', 'loam', 'none'],
  ] as const) {
    const base = defaultInputs({ positionType, soil, threat });
    const html = planOverlay(planForTime({ availableHours: 40, teamSize: 4, base }), 40, 4);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
    const at = `${positionType}/${soil}/${threat}`;

    // Named concretely, so it can be checked at a glance against the form behind the panel.
    assert.ok(text.includes(positionLabel(positionType)), at + ': names the position');
    assert.ok(text.includes(soilLabel(soil)), at + ': names the soil');
    assert.ok(text.includes(threatLabel(threat)), at + ': names the threat');
    assert.match(text, /varies only the standard, the roof and the revetment/, at + ': and what it does vary');

    // The claim must be TRUE: every option really does keep those three.
    const plan = planForTime({ availableHours: 40, teamSize: 4, base });
    for (const o of plan.feasible) {
      assert.equal(o.inputs.positionType, positionType, at + ': an option changed the position');
      assert.equal(o.inputs.soil, soil, at + ': an option changed the soil');
      assert.equal(o.inputs.threat, threat, at + ': an option changed the threat');
    }
  }
  // Nothing to scope when there is nothing to show.
  assert.doesNotMatch(planOverlay(null, 8, 2), /Every option below/, 'no scope note before the first run');
});

test('performance budget: walking the build stays interactive', () => {
  // The scrubber is the control the whole "watch it go up in order" idea rests on, and every drag
  // event rebuilds the staged scene AND re-renders the caption — which recomputes the stage plan.
  // TIMBER-1 guards its own regen with a budget; this path had none, so work added to either could
  // make the brief's central interaction janky with nothing failing.
  //
  // The budget is deliberately loose (a 60fps frame is 16.7 ms and this measures ~0.03 ms): it is
  // here to catch someone putting something catastrophic on the drag path, not to police noise on
  // a shared CI box.
  const worst = ['vehicle_turret_defilade', 'bunker_op_cp', 'two_man'].map((positionType) =>
    compute(defaultInputs({ positionType, revetment: 'pickets_wire', sump: true, overheadCover: true, camouflage: true })));

  for (const r of worst) {
    const t0 = performance.now();
    const REPS = 200;
    for (let i = 0; i < REPS; i++) {
      const stage = i % STAGE_ORDER.length;
      buildScene3D(r, { stage, cutaway: false });
      stageCaption(stage, r);
    }
    const per = (performance.now() - t0) / REPS;
    assert.ok(per < 8, `${r.inputs.positionType}: ${per.toFixed(3)} ms per scrubber step (budget 8 ms, frame is 16.7 ms)`);
  }

  // And the cutaway toggle, which rebuilds the same scene with a different flag.
  const r = worst[0]!;
  const t1 = performance.now();
  for (let i = 0; i < 100; i++) buildScene3D(r, { stage: undefined, cutaway: i % 2 === 0 });
  assert.ok((performance.now() - t1) / 100 < 8, 'cutaway toggle stays inside the same budget');
});

test('planner marks the options that fit its budget but miss the schedule stand-to', () => {
  // The two clocks differ by exactly 1/posture: this tool divides the work by the WHOLE team, the
  // build schedule by the diggers actually on the tools. So an option can fit the budget here and
  // still miss stand-to there — the hand-off used to send the user from a failed verdict straight
  // to a table that could not see the constraint they had just failed.
  const HOURS = 6, TEAM = 8, POSTURE = 0.75, COUNT = 4;
  const base = defaultInputs({ positionType: 'two_man', count: COUNT, soil: 'clay', threat: 'ind-mtr-81', teamSize: TEAM });
  const plan = planForTime({ availableHours: HOURS, teamSize: TEAM, base });
  assert.ok(plan.feasible.length > 0, 'scenario must offer options for the check to mean anything');

  // The bar is stated as a number, not left as a caveat to apply by hand.
  const html = planOverlay(plan, HOURS, TEAM, POSTURE);
  assert.match(html, /at or under <strong>4\.5 hr<\/strong>/, 'states hours x posture as the real bar');
  assert.match(html, /holds 25% of the team on security/);

  // And the substantive property: a row is flagged exactly when the schedule would call it short.
  for (const o of plan.feasible) {
    const sched = scheduleStages(computeStages(compute(o.inputs)),
      { teamSize: TEAM, availableHours: HOURS, securityPostureFrac: POSTURE, positions: COUNT });
    const flagged = o.elapsedHours > HOURS * POSTURE + 1e-9;
    assert.notEqual(flagged, sched.feasible,
      `${o.standard}/${o.revetment}: flagged=${flagged} but schedule feasible=${sched.feasible}`);
  }

  // Opened directly (no schedule in play) it must NOT attribute a posture to the user.
  const plain = planOverlay(plan, HOURS, TEAM);
  assert.doesNotMatch(plain, /on security, so a setup must come in/);
  assert.doesNotMatch(plain, /misses stand-to/);
});

test('every tool in the suite is reachable from every other one', () => {
  // The suite is SAP-1 + TIMBER-1 + a hub, and its navigation ran one way: TIMBER-1's header has
  // always linked back, this page linked nowhere. The manifest's start_url resolves here, so an
  // installed PWA opened in the half of the toolkit with no exit — the tool that frames a bunker's
  // overhead timber was unreachable without hand-editing the URL. Asserted on the rendered shell
  // rather than the source file so it covers what a user is actually served.
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];
  const html = renderApp(state, compute(defaultInputs({})), true, false);
  for (const href of ['./woodframe.html', './hub.html']) {
    assert.ok(html.includes('href="' + href + '"'), 'SAP-1 must link to ' + href);
  }
  // Real anchors, not JS-dispatched buttons: middle-click, open-in-new-tab and the "link" role
  // are the platform's, and a data-action handler reproduces none of them.
  assert.match(html, /<a class="menu-item" role="menuitem" href="\.\/woodframe\.html"/);

  // And the reverse direction still exists (TIMBER-1's own header link).
  const timber = readFileSync(new URL('../src/ui/woodframe.html', import.meta.url), 'utf8');
  assert.match(timber, /href="\.\/hub\.html"/, 'TIMBER-1 keeps its way back to the suite');
});

test('the hub honours the light-discipline theme and offers only real tools', () => {
  const hub = readFileSync(new URL('../src/ui/hub.html', import.meta.url), 'utf8');

  // Night is amber-on-near-black light discipline, not decoration, so a hub that always painted
  // cream white-flashed a user mid-move between the two tools. Synchronous and in <head>: a
  // deferred script paints the day palette first, which is the whole failure being fixed.
  const headEnd = hub.indexOf('</head>');
  const bootstrap = hub.indexOf("localStorage.getItem('sap1.theme')");
  assert.ok(bootstrap > -1 && bootstrap < headEnd, 'theme is read in <head>, before first paint');
  assert.doesNotMatch(hub.slice(0, headEnd), /<script[^>]+(defer|async|type="module")/,
    'the theme bootstrap must not be deferred');

  // Values match tokens.css rather than a palette invented for this page.
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');
  const night = tokens.slice(tokens.indexOf("[data-theme='night']"));
  for (const v of ['#0a0605', '#140c0a', '#ff9d73', '#c76a45', '#3a1e16']) {
    assert.ok(night.includes(v), `${v} must still be the tokens.css night value`);
    assert.ok(hub.includes(v), `hub night palette must use ${v} from tokens.css`);
  }
  assert.match(hub, /:root\[data-theme='night'\]/);

  // The choose-a-tool screen offers exactly the tools that exist. The retired ghost card named
  // three that do not and closed with build instructions meant for whoever adds one.
  // Comments stripped first: the note recording WHY that card went away necessarily quotes it, and
  // matching the source rather than the rendered markup would fail on the explanation itself.
  const rendered = hub.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(rendered, /Next tool goes here|demolition calcs/);
  const cards = rendered.match(/<a class="card"/g) ?? [];
  assert.equal(cards.length, 2, 'one card per shipping tool');
});

test('TIMBER-1 follows the light-discipline theme, and paper does not', () => {
  const html = readFileSync(new URL('../src/ui/woodframe.html', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');

  // Pre-paint, and before the scene module reads it. The bootstrap is a synchronous inline script
  // in <head>; the scene is type="module" at the end of <body> and therefore deferred, so
  // NIGHT_3D cannot observe an unset attribute. Assert that ORDER, not just that both exist.
  const boot = html.indexOf("localStorage.getItem('sap1.theme')");
  const mod = html.indexOf('type="module"');
  const headEnd = html.indexOf('</head>');
  assert.ok(boot > -1 && boot < headEnd, 'theme bootstrap runs in <head>');
  assert.ok(boot < mod, 'bootstrap precedes the scene module that reads data-theme');

  // Night values are SAP-1's, not a palette invented for this page.
  const night = tokens.slice(tokens.indexOf("[data-theme='night']"));
  for (const v of ['#0a0605', '#140c0a', '#ff9d73', '#c76a45', '#3a1e16', '#ffb37a']) {
    assert.ok(night.includes(v), `${v} must still come from tokens.css`);
    assert.ok(html.includes(v), `TIMBER-1 night palette must use ${v}`);
  }

  // Anchor on the at-rule itself, brace included: the palette comment above it mentions "@media
  // print" in prose, and a bare indexOf finds THAT — which put the screen slice before the rules
  // it was meant to scan and made the literal check below pass against an empty string.
  const printAt = html.indexOf('@media print {');
  assert.ok(printAt > html.indexOf('* { box-sizing'), 'print block located after the screen rules');

  // Screen CSS is fully tokenised — a literal left behind is a rule that silently stays daylit.
  const body = html.slice(html.indexOf('* { box-sizing'), printAt);
  assert.ok(body.includes('.step.on'), 'the screen slice really contains the rules');
  assert.deepEqual(body.match(/(?<!&)#[0-9a-fA-F]{3,6}\b/g) ?? [], [],
    'every screen colour goes through a variable');

  // Paper emits no light, so the print sheet must NOT follow the screen theme. The lookbehind
  // keeps HTML entities out of it — the rail's Back/Next arrows are &#9664;/&#9654;, which a bare
  // hex pattern reads as two colours that were never there.
  const HEX = /(?<!&)#[0-9a-fA-F]{3,6}\b/g;
  // Bounded at the next at-rule, not end-of-file: the responsive block that follows is screen CSS
  // and correctly tokenised, so an unbounded slice reads its var(--rule) as a themed print rule.
  const printEnd = html.indexOf('@media (max-width: 900px)');
  assert.ok(printEnd > printAt, 'print block is bounded by the responsive block');
  const print = html.slice(printAt, printEnd);
  assert.deepEqual([...new Set(print.match(HEX) ?? [])].sort(), ['#000', '#333', '#999'],
    'print keeps literal black-on-white');
  assert.doesNotMatch(print, /var\(--/, 'no themed variable reaches the printed checklist');
});

test('the build-stage slider offers only steps this design performs', () => {
  // The caption already refused to number a skipped stage ("named, not numbered — it has no place
  // in a build order it is not part of"), but the slider went on giving those stages equal travel.
  // Over a 360-design sweep, 79% had at least one position that built nothing and answered "not
  // part of this design" — up to three of seven — on the control for walking the build.
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];
  let sawSkips = false;

  for (const over of [
    { sump: false, camouflage: false, overheadCover: false, revetment: 'none' as const },
    { sump: true, camouflage: true, overheadCover: true, revetment: 'pickets_wire' as const },
    { sump: false, camouflage: true, overheadCover: false, revetment: 'none' as const },
  ]) {
    const result = compute(defaultInputs(over));
    const plan = computeStages(result).steps;
    if (plan.length < STAGE_ORDER.length) sawSkips = true;

    const html = renderApp(state, result, true, false);
    const max = html.match(/id="three-stage"[^>]*max="(\d+)"/)?.[1];
    assert.equal(Number(max), plan.length - 1, 'one slider position per step this design performs');

    // Every tick names a step in the plan, in order — no doctrinal stage the design skips.
    // Decoded first: labels are correctly escaped in the markup ("Post security &amp; stake
    // sectors"), so comparing raw engine labels against rendered ones fails on the escaping and
    // says nothing about the ordering this is actually checking.
    const ticks = [...html.matchAll(/<option value="\d+" label="([^"]*)"><\/option>/g)]
      .map((m) => m[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    assert.deepEqual(ticks, plan.map((s) => s.label));

    // And every position resolves to a numbered step rather than "not part of this design".
    for (let pos = 0; pos < plan.length; pos++) {
      const doctrinal = STAGE_ORDER.findIndex((s) => s.id === plan[pos]!.id);
      const cap = stageCaption(doctrinal, result);
      assert.match(cap, new RegExp('Step ' + (pos + 1) + ' of ' + plan.length),
        `position ${pos} must be a real numbered step`);
      assert.doesNotMatch(cap, /Not part of this design/);
    }
  }
  assert.ok(sawSkips, 'the sample must include a design that skips stages, or this proves nothing');
});

test('the build-order control says when the design must not be built', () => {
  // Every other surface carrying the design's blocking problems escalates them — the checks panel
  // heads itself "Fix before building", the schedule verdict refuses to call a broken design ready,
  // the compare table says "do not build", the printed sheet leads with them. The scrubber did not,
  // and it is the control that WALKS a crew through building the thing. On sand with no revetment
  // the app says the walls will slough, and the sequence beside it stepped through six numbered
  // stages, none of them revetment, because the design skips it.
  const state = { layoutMode: 'desktop' } as unknown as Parameters<typeof renderApp>[0];

  const broken = compute(defaultInputs({ soil: 'sand', revetment: 'none', standard: 'deliberate' }));
  const errs = broken.validation.filter((v) => v.severity === 'error');
  assert.ok(errs.length > 0, 'this design must actually be blocked, or the test proves nothing');

  const html = renderApp(state, broken, true, false);
  assert.match(html, /class="scrubber-blocked"/, 'the build-order control states the blocking problem');
  // Same sentence the checks panel uses — one string, not a second phrasing for the same fact.
  assert.ok(html.includes(problemsHeading(errs.length)));

  // NOT inside the caption: that paragraph is aria-live, so anything in it is re-announced on every
  // frame of a slider drag. The warning must sit before it, outside the region.
  const warnAt = html.indexOf('scrubber-blocked');
  const liveAt = html.indexOf('id="three-stage-caption"');
  assert.ok(warnAt < liveAt, 'warning sits outside the live region');

  // A design with nothing blocking must stay quiet.
  const clean = compute(defaultInputs({ soil: 'clay', revetment: 'pickets_wire', standard: 'deliberate' }));
  assert.equal(clean.validation.filter((v) => v.severity === 'error').length, 0);
  assert.doesNotMatch(renderApp(state, clean, true, false), /scrubber-blocked/);

  // And the no-WebGL fallback carries it too — same design, same problem, no slider to hang it on.
  assert.match(renderApp(state, broken, false, false), /class="scrubber-blocked"/);
});

test('"Fix before building" has exactly one home', () => {
  // It existed verbatim in six places across both tools — the shape that has produced defects here
  // before (a second place deciding the same thing). TIMBER-1's copy carried the note "One string,
  // both surfaces"; this asserts that across the suite rather than within one tool.
  const roots = ['engine', 'layout', 'render', 'state', 'timber', 'doctrine', 'ui'];
  const owners: string[] = [];
  const walk = (dir: URL): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) walk(child);
      else if (/\.(ts|html)$/.test(entry.name)) {
        // The quote is what distinguishes a STRING from a comment explaining the string.
        if (/'Fix before building|>Fix before building/.test(readFileSync(child, 'utf8'))) {
          owners.push(entry.name);
        }
      }
    }
  };
  for (const r of roots) walk(new URL(`../src/${r}/`, import.meta.url));
  assert.deepEqual(owners, ['labels.ts'], 'one definition, everything else calls problemsHeading()');
});

test('a materials row and the panel it opens name the same thing', () => {
  // Tapping a BOM quantity opens its derivation, so the two labels are read one after the other by
  // the same person. They were written independently in engine/materials.ts and engine/explain.ts,
  // and had drifted twice:
  //
  //   • sandbags_parapet — explain.ts resolves the name by parapetMode (an EARTH parapet's mass is
  //     spoil, so its only bags are the firing-rest course at the aperture) while materials.ts said
  //     "Sandbags — parapet" for both. On a two-man position — parapetMode 'earth', the common case
  //     — the list told a crew 33 bags were the parapet, and the panel behind that number computed
  //     a firing rest from frontage × bag width × rest height. materials.ts already branched on the
  //     same mode one argument later to pick the row's PLACEHOLDER leaves: provenance, not name.
  //   • pickets — the row was labelled with the revetment SYSTEM ("Pickets & wire"), counted in
  //     'ea', while the wire in that name is billed separately two rows down in feet.
  const BOM_TRACE: Record<string, string> = {
    excavation_loose: 'excavLoose', sandbags_parapet: 'sandbagsParapet', berm_fill: 'bermFill',
    sandbags_cover: 'sandbagsCover', cover_soil_fill: 'coverSoilFill', sandbags_revet: 'sandbagsRevet',
    revet_panels: 'revetPanels', pickets: 'pickets', revet_wire: 'revetWire', stringers: 'stringers',
    gravel_sump: 'gravelSump', camo_net: 'camoNet',
  };
  let pairs = 0;
  const parapetLabels = new Set<string>();

  for (const positionType of ['two_man', 'mg_crew', 'bunker_op_cp', 'vehicle_turret_defilade']) {
    for (const revetment of ['none', 'pickets_wire', 'corrugated_metal', 'timber_plywood'] as const) {
      for (const overheadCover of [false, true]) {
        const r = compute(defaultInputs({ positionType, revetment, overheadCover, sump: true, camouflage: true }));
        for (const line of r.bom) {
          const key = BOM_TRACE[line.id];
          if (!key) continue;
          const d = r.derivations.find((x) => x.key === key);
          if (!d) continue;
          pairs++;
          assert.equal(line.label, d.label,
            `${line.id} on ${positionType}/${revetment}: the row and the panel it opens must agree`);
          if (line.id === 'sandbags_parapet') parapetLabels.add(line.label);
        }
      }
    }
  }
  assert.ok(pairs > 100, 'sweep must actually cover pairs');
  // Both parapet modes must appear, or the branch that caused the drift is untested.
  assert.deepEqual([...parapetLabels].sort(), ['Sandbags — front firing rest', 'Sandbags — parapet']);

  // The mode rule itself has one home, so a third surface cannot invent a third answer.
  assert.equal(parapetBagsLabel('sandbag'), 'Sandbags — parapet');
  assert.equal(parapetBagsLabel('earth'), 'Sandbags — front firing rest');
  assert.equal(parapetBagsLabel('berm'), 'Sandbags — front firing rest');
});

test('every derivation gives a row for each term its formula names', () => {
  // The tap-to-explain panel exists to show the work, so a formula naming something the operand
  // list does not provide defeats the whole feature. Three had drifted:
  //   • excavLoose said "(bay + sumps) × swellFactor" and listed only their SUM, under a third
  //     name (excavBank) — so it declined to give either term, and left the fighting-bay volume,
  //     which the engine computes and labels, reachable from nowhere in the app.
  //   • parapetRing subtracted holeL × holeW and listed neither: half the inputs to the number.
  //   • manHoursPerPosition named base/labor/spoil/perVol/dig/machine over operands called
  //     baseMH/laborMul/excavBank/perVolMH/digFactor/machineFactor — every term present, none
  //     findable by the name the formula used.
  let checked = 0;
  for (const positionType of ['two_man', 'mg_crew', 'vehicle_turret_defilade', 'bunker_op_cp']) {
    for (const revetment of ['none', 'pickets_wire', 'corrugated_metal'] as const) {
      for (const machineAssist of [false, true]) {
        const r = compute(defaultInputs({ positionType, revetment, machineAssist, sump: true, overheadCover: true, camouflage: true }));
        for (const d of r.derivations) {
          // A formula may carry a trailing plain-English note after an em dash (stringers explains
          // which axis it spans); only the arithmetic before it names operands.
          // Strip trailing prose notes before parsing: a formula may end with an em-dash aside
          // (stringers says which axis it spans) or a parenthetical gloss ("(ramp width = the
          // narrow side of the cut)"). A parenthetical that CONTAINS an operator is arithmetic —
          // "(bay + sumps) × swellFactor" — so only operator-free ones are prose.
          const arithmetic = d.formula
            .split('—')[0]!
            .replace(/\([^()]*\)/g, (par) => (/[×÷+−/]/.test(par) ? par : ' '));
          // A formula with no operator is a STATEMENT, not arithmetic — the engineered-roof case
          // says why there is no thickness to compute, and has nothing to list. Only formulas that
          // actually combine terms owe an operand per term.
          if (!/[×÷+−/]/.test(arithmetic)) continue;
          const names = arithmetic.match(/[a-zA-Z][a-zA-Z0-9]{2,}/g) ?? [];
          for (const term of names) {
            // Functions and the geometric constant are not operands.
            if (['ceil', 'floor', 'round', 'max', 'min', 'sqrt', 'abs'].includes(term)) continue;
            assert.ok(d.operands.some((o) => o.name === term),
              `${d.key} on ${positionType}/${revetment}: formula says "${term}" with no operand row`);
            checked++;
          }
        }
      }
    }
  }
  assert.ok(checked > 200, `sweep must actually cover terms (saw ${checked})`);
});

test('TIMBER-1 gives every touch target the tap-size the toolkit declares', () => {
  // The mobile block raised Back/Next/Start/Finished from 30px to 44px, explicitly naming "the 44px
  // a thumb needs" — and in the same sentence excused the rail steps as "already ~40px from their
  // two lines of content". Measured at 390px they are exactly 40 on every width: 4px under the
  // standard that sentence names, on ELEVEN controls that are not a lesser thing than the chips —
  // they ARE the build order, and tapping one is how you choose a step rather than walk to it.
  // The design fields, opening cells and crew box were at 30/28/28, so every touch target in the
  // tool except the chips was short.
  const html = readFileSync(new URL('../src/ui/woodframe.html', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../src/ui/tokens.css', import.meta.url), 'utf8');

  // The standard is the toolkit's own, not a number invented here.
  const tap = tokens.match(/--tap-min:\s*(\d+)px/)?.[1];
  assert.equal(tap, '44', 'the toolkit tap-size token moved — revisit the floors below');

  const mobile = html.slice(html.indexOf('@media (max-width: 900px)'));
  assert.ok(mobile.length > 0, 'mobile block exists');

  // Every control a thumb uses gets the floor, inside the mobile block.
  for (const sel of ['.step', 'button.chip', '.crewField input']) {
    const rule = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*\\{[^}]*min-height:\\s*44px');
    assert.match(mobile, rule, `${sel} must carry the 44px floor on a phone`);
  }
  // And no rule in that block sets a SHORTER floor than the standard.
  for (const m of mobile.matchAll(/min-height:\s*(\d+)px/g)) {
    const px = Number(m[1]);
    // #viewport's 340px is a canvas minimum, not a tap target.
    if (px < 44 && px !== 340) assert.fail(`mobile block sets min-height ${px}px, under the ${tap}px standard`);
  }

  // Deliberately NOT asserting the old excuse is absent from the prose: the comment that replaced
  // it quotes "already ~40px" to record why that reasoning was wrong, which is the note worth
  // keeping. Asserting on comment text has produced a false failure three times in this file now —
  // the rendered/behavioural assertions above are the ones that mean anything.
});

test('TIMBER-1 design problems name an opening the user can find', () => {
  // designProblems says "Opening 1 (South (front)) runs past the end of its 20 ft wall." — a
  // 1-based index into input.openings. Every control in the editor already carried an aria-label
  // of "Opening N …", so a screen-reader user was told which one was at fault while a sighted user
  // saw a table with no numbers in it at all and had to infer the warning meant the top row.
  const b = defaultBuilding();
  const bad = { ...b, lengthFt: 20, openings: [
    { wall: 'S' as const, offsetFt: 2, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 },
    { wall: 'S' as const, offsetFt: 19, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }, // runs past
  ] };
  const problems = designProblems(bad);
  const runsPast = problems.find((p) => /runs past the end/.test(p));
  assert.ok(runsPast, 'the overhanging opening is reported');
  // It must accuse the SECOND opening, 1-based — an off-by-one here sends a crew to the wrong row.
  assert.match(runsPast!, /^Opening 2\b/, `numbering is 1-based into openings: ${runsPast}`);

  // And the editor renders that same index as a visible row header, not only as an aria-label.
  const scene = readFileSync(new URL('../src/ui/woodframe-scene.ts', import.meta.url), 'utf8');
  assert.match(scene, /<th scope="row" class="openNum">\$\{i \+ 1\}<\/th>/,
    'each row shows its opening number');
  assert.match(scene, /<th scope="col">.*Opening number.*#<\/th>/, 'the column is headed and named for AT');
  // The empty-state colspan has to cover the new column or the "no openings" row under-spans.
  assert.match(scene, /colspan="7"[^>]*>No openings/, 'empty state spans every column');
});

test('TIMBER-1 keeps keyboard focus while walking the build order', () => {
  // renderRail() replaces #railSteps wholesale and the panel render disables Back/Next at the ends
  // of the order, so both took focus out from under a keyboard user: activating a rail step, and —
  // on the NORMAL path — arriving at the last step, where Next disables itself. Focus fell to
  // <body>, dropping the user at the top of the document at the moment they finished the sequence.
  // SAP-1 restores focus across its own re-render; this asserts TIMBER-1 now does too.
  //
  // Asserted structurally: woodframe-scene.ts grabs DOM at module scope, so it cannot be imported
  // and driven here. The behaviour itself was verified in the browser against all three cases.
  const scene = readFileSync(new URL('../src/ui/woodframe-scene.ts', import.meta.url), 'utf8');

  const setStageAt = scene.indexOf('function setStage(');
  const restoreAt = scene.indexOf('restoreStageFocus(wasActive', setStageAt);
  const railAt = scene.indexOf('renderRail();', setStageAt);
  const captureAt = scene.indexOf('const wasActive = document.activeElement', setStageAt);
  assert.ok(captureAt > -1 && captureAt < railAt,
    'the active element is captured BEFORE the rail is torn down');
  assert.ok(restoreAt > railAt, 'focus is restored after the re-render, not before');

  // Only when the rebuild actually took focus — a design edit must not yank the caret to the rail.
  assert.match(scene, /if \(!droveRail && !droveNav\) return;/, 'restoring is scoped to the controls that drove it');
  assert.match(scene, /document\.activeElement !== document\.body/, 'and only when focus was actually lost');

  // preventScroll, because setStage already scrolls the step into view; a second scroll fights it.
  const restoreFn = scene.slice(scene.indexOf('function restoreStageFocus'));
  for (const m of restoreFn.slice(0, restoreFn.indexOf('\n}')).matchAll(/\.focus\(([^)]*)\)/g)) {
    assert.match(m[1]!, /preventScroll: true/, 'every focus() in the restore avoids double-scrolling');
  }
});

test('TIMBER-1 announces the step it moved to', () => {
  // SAP-1's stage caption is aria-live, so scrubbing speaks. TIMBER-1's stage title, instruction
  // and cut-list note all change as plain textContent, and the viewport's aria-label is rewritten —
  // none of which a screen reader announces. Pressing Next changed the entire right pane in
  // silence, which is the tool's primary control doing its primary job invisibly.
  const html = readFileSync(new URL('../src/ui/woodframe.html', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/ui/woodframe-scene.ts', import.meta.url), 'utf8');

  // A dedicated terse region, not aria-live on the panel: SAP-1's index.html records why (making
  // the panel live re-reads every word of the cut list on each step).
  assert.match(html, /id="srStatus"[^>]*class="srOnly"/, 'the region is visually hidden');
  assert.match(html, /id="srStatus"[^>]*role="status"/);
  assert.match(html, /id="srStatus"[^>]*aria-live="polite"/);
  // Static in the markup: a role=status only announces CHANGES, so an element inserted together
  // with its first message stays silent.
  assert.ok(html.indexOf('id="srStatus"') < html.indexOf('woodframe-scene.ts'), 'present before the script runs');

  // Announced on step change, and NOT on the boot paint that draws the opening state.
  assert.match(scene, /announceStage\(\);/);
  assert.match(scene, /if \(!announced\) \{ announced = true; return; \}/, 'the first paint stays quiet');

  // The two reasons a step cuts nothing must not read the same (types.ts STAGES.framed). A design
  // that skips piers and a trade this tool never models are different facts.
  assert.match(scene, /def && !def\.framed/, 'the announcement branches on framed');
  const unframed = scene.match(/'Finish work this tool does not model\.'/);
  const noneCut = scene.match(/'Nothing is cut at this step in this design\.'/);
  assert.ok(unframed && noneCut, 'both cases have their own wording');
  assert.notEqual(unframed![0], noneCut![0]);

  // And the distinction is real in the data the announcement reads.
  const framedFlags = new Set(STAGES.map((s) => s.framed));
  assert.deepEqual([...framedFlags].sort(), [false, true], 'STAGES still carries both kinds');
});

test('a rail step reads as a step, not as run-together spans', () => {
  // The button had no explicit name, so it was computed from its spans and came out
  // "1Layout & foundation12 pcs · 1.1 MH · 0.1 hr" — the number welded to the name, the name to the
  // metadata, and nothing anywhere saying where in the order it sits. The compact "pcs · MH · hr"
  // shorthand is right on screen and against you when read aloud.
  const scene = readFileSync(new URL('../src/ui/woodframe-scene.ts', import.meta.url), 'utf8');

  assert.match(scene, /aria-label="\$\{esc\(stageSentence\(r\.id\)\)\}"/, 'each step names itself');

  // ONE sentence, two surfaces. The button's accessible name and the live announcement must not
  // drift into two descriptions of the same step — that is the shape that has produced defects
  // across this codebase (the BOM label, "Fix before building", the stage boot default).
  assert.match(scene, /function stageSentence\(id: StageId\): string/);
  assert.match(scene, /el\.textContent = stageSentence\(currentStage\);/, 'the live region reuses it');
  const uses = [...scene.matchAll(/stageSentence\(/g)].length;
  assert.ok(uses >= 3, `stageSentence should be defined once and used by both surfaces (saw ${uses})`);

  // It states the position in the order, which the run-together name never did.
  assert.match(scene, /Step \$\{id\} of \$\{LAST_STAGE\}/);

  // The visible text keeps its shorthand — this is an accessible-name fix, not a redesign of the
  // rail, which has to stay scannable in a 252px column.
  assert.match(scene, /<span class="step-meta">\$\{esc\(r\.meta\)\}<\/span>/, 'the visible meta is untouched');
});

test('TIMBER-1 offers a way past the design panel to the build order', () => {
  // Measured in the browser: with the design panel open — the normal state while designing — the
  // first rail step is 41 tab stops away, and a keyboard user pays that every time they adjust a
  // dimension and go back to the sequence. SAP-1 has carried a skip link since its trust sprint;
  // this is the same affordance aimed at the rail, which is this tool's spine.
  const html = readFileSync(new URL('../src/ui/woodframe.html', import.meta.url), 'utf8');

  // First focusable thing on the page, before the header — a skip link that is not first is not one.
  const linkAt = html.indexOf('class="skipLink"');
  assert.ok(linkAt > -1, 'the skip link exists');
  assert.ok(linkAt < html.indexOf('<header>'), 'it precedes the header');
  assert.match(html, /<a class="skipLink" href="#rail">/, 'it targets the rail');

  // Off-canvas until focused, then on-screen. A skip link that never becomes visible helps only
  // screen-reader users and leaves sighted keyboard users tabbing into nothing.
  assert.match(html, /\.skipLink\s*\{[^}]*left:\s*-999px/, 'hidden until focused');
  assert.match(html, /\.skipLink:focus\s*\{[^}]*left:\s*8px/, 'and revealed on focus');

  // <nav> is not focusable by default: without this the browser scrolls to the rail but leaves
  // focus in the header, so the next Tab resumes from the top and the skip achieved nothing.
  assert.match(html, /<nav id="rail" tabindex="-1"/, 'the target can actually take focus');
});

test('losing your place is not reported as losing your design', () => {
  // Stage persistence added a localStorage write inside setStage(), and routed its failure to the
  // same notice saveBuilding() uses: "This browser is not saving your design ... print the build
  // plan before you close this tab." So merely WALKING the sequence — pressing Next, which designs
  // nothing — raised a data-loss warning, and because setStage() also runs at boot it fired on load
  // in private mode before the user had touched anything.
  //
  // The two failures are not the same size. Losing the design loses work; losing the step loses
  // your place. Only the first is worth that sentence.
  const scene = readFileSync(new URL('../src/ui/woodframe-scene.ts', import.meta.url), 'utf8');

  const stageWrite = scene.match(/localStorage\.setItem\(STAGE_KEY[^\n]*\n?[^\n]*/)?.[0] ?? '';
  assert.ok(stageWrite.length > 0, 'the stage write is still there');
  assert.doesNotMatch(stageWrite, /noteStorageUnavailable/, 'a failed step write must not cry wolf');

  // The design write still does, because that one IS the user's work.
  const designWrite = scene.slice(scene.indexOf('function saveBuilding'), scene.indexOf('function saveBuilding') + 260);
  assert.match(designWrite, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(designWrite, /noteStorageUnavailable\(\)/, 'a failed design save must still say so');

  // And the crew size sits with the design in the same regard — it is an input the user typed.
  assert.match(scene, /localStorage\.setItem\(CREW_KEY[^)]*\)[^\n]*noteStorageUnavailable/);
});
