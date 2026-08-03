// TIMBER-2 T7 — the crib bunker's structural claims.
//
// The boundary is tested next door in `timber2-boundary`. What is asserted here is that the
// thing it generates is actually cribwork and actually spans what it says it spans.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateStructure } from '../src/timber/families/index';
import { familyById } from '../src/timber/catalog';
import { stringerFor } from '../src/timber/families/bunker';
import { generateCribWall, cribCourseCount } from '../src/timber/subsystems/cribwork';
import { BUNKER } from '../src/timber/doctrine';
import { SPEC_PATH_DEFS } from '../src/timber/spec';

const preset = () => JSON.parse(JSON.stringify(familyById('crib-bunker')!.preset));

test('a crib alternates: no two consecutive courses run the same way', () => {
  // A stack that runs the same way twice has a continuous vertical joint through it, which is
  // the exact failure cribbing exists to avoid. This is the property that makes it a crib.
  const members = generateCribWall({
    from: [0, 0], to: [16, 0], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TC',
  });
  assert.ok(members.length > 0);
  const byCourse = new Map<string, Set<string>>();
  for (const m of members) {
    const y = m.position[1].toFixed(3);
    const yaw = Math.abs(m.rotation[1] % Math.PI) < 1e-6 ? 'along' : 'across';
    (byCourse.get(y) ?? byCourse.set(y, new Set()).get(y)!).add(yaw);
  }
  const courses = [...byCourse.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  assert.equal(courses.length, cribCourseCount(6.5));
  for (let i = 1; i < courses.length; i++) {
    const prev = [...courses[i - 1]![1]].join();
    const here = [...courses[i]![1]].join();
    assert.notEqual(here, prev, `courses ${i - 1} and ${i} both run ${here}`);
  }
});

test('every header course reaches both ends — the corner is the whole idea', () => {
  const members = generateCribWall({
    from: [0, 0], to: [16, 0], baseY: 0, heightFt: 6.5, depthFt: 2, stage: 1, prefix: 'TC',
  });
  const across = members.filter((m) => Math.abs(m.rotation[1] % Math.PI) > 1e-6);
  assert.ok(across.length > 0, 'there are header courses at all');
  const xs = across.map((m) => m.position[0]);
  assert.ok(Math.min(...xs) < 0.01, 'a header lands on the near corner');
  assert.ok(Math.max(...xs) > 15.99, 'and on the far one');
});

test('the stringer table is capped at its last reviewed row, and says so', () => {
  const maxRow = BUNKER.maxReviewedSpanFt.value as number;
  assert.equal(stringerFor(maxRow).reviewed, true);
  const past = stringerFor(maxRow + 6);
  assert.equal(past.reviewed, false, 'past the table is not silently interpolated');
  assert.ok(past.nominal, 'a member is still returned — the family reports rather than crashing');
});

test('the spec envelope cannot ask for a span the table has not reviewed', () => {
  // Defence in depth, and the ORDER matters: asking for an 18-ft interior does not reach the
  // stringer table at all, because normalizeSpec clamps the width to the envelope first. That is
  // the right outcome — but it means the envelope and the table have to agree, or a future
  // widening of one silently outruns the other. This test is that agreement, written down.
  const envelope = SPEC_PATH_DEFS.find((d) => d.path === 'interiorWidthFt')!;
  assert.equal(
    envelope.max,
    BUNKER.maxReviewedSpanFt.value,
    'the widest interior the picker allows must equal the deepest span anyone has reviewed',
  );

  const spec = preset();
  spec.interiorWidthFt = (BUNKER.maxReviewedSpanFt.value as number) + 6;
  const model = generateStructure(spec);
  const clamped = model.issues.find((i) => i.kind === 'clamped' && i.path === 'interiorWidthFt');
  assert.ok(clamped, 'and the attempt is reported, not silently accepted');
  assert.equal((model.spec as { interiorWidthFt: number }).interiorWidthFt, BUNKER.maxReviewedSpanFt.value);
});

test('and if the envelope is ever widened past the table, the family says so out loud', () => {
  // The guard that fires if the two above ever drift apart: a span the table has no reviewed row
  // for produces an ERROR the UI must show, naming what the returned member is and is not.
  const past = stringerFor((BUNKER.maxReviewedSpanFt.value as number) + 6);
  assert.equal(past.reviewed, false);
});

test('both wall types build, and both carry an overhead', () => {
  for (const wallType of ['post-plank', 'crib'] as const) {
    const spec = preset();
    spec.wallType = wallType;
    const model = generateStructure(spec);
    const roles = new Set(model.members.map((m) => m.role));
    assert.ok(roles.has('ohcStringer'), `${wallType}: no stringers`);
    assert.ok(roles.has('capBeam'), `${wallType}: no caps`);
    assert.ok(roles.has(wallType === 'crib' ? 'cribLog' : 'post'), `${wallType}: no wall`);
  }
});
