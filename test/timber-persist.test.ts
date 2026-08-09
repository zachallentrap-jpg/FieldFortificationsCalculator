// TIMBER-1 design persistence (src/ui/woodframe-scene.ts round-trips the BuildingInput through
// localStorage so a refresh doesn't discard minutes of layout work). Restored data is a TRUST
// BOUNDARY — sanitizeBuilding() is what stands between stored/corrupt JSON and generators that
// assume finite, in-range numbers — so it is validated here, in the engine, with no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateFrame, defaultBuilding, sanitizeBuilding, designProblems } from '../src/timber/frame';
import { STAGES } from '../src/timber/types';

test('a real design round-trips through JSON unchanged', () => {
  const design = {
    ...defaultBuilding(),
    lengthFt: 32, widthFt: 24, wallHeightFt: 9, studSpacingIn: 24 as const, risePer12: 6,
    openings: [{ wall: 'E' as const, offsetFt: 5, widthFt: 4, heightFt: 6.7, sillHeightFt: 0 }],
  };
  assert.deepEqual(sanitizeBuilding(JSON.parse(JSON.stringify(design))), design);
});

test('garbage in never reaches the generators — every hostile shape falls back to a valid design', () => {
  const hostile: unknown[] = [
    null, undefined, 42, 'a string', [], { openings: 'not an array' },
    { lengthFt: NaN, widthFt: Infinity, wallHeightFt: -0 },
    { lengthFt: 1e9, widthFt: -500, risePer12: 999, crawlFt: -12, overhangFt: 1e6 },
    { studSpacingIn: 13, joistSpacingIn: 'sixteen', rafterSpacingIn: null },
    { openings: [null, 7, 'x', { wall: 'Q', offsetFt: NaN, widthFt: -3, heightFt: Infinity, sillHeightFt: 'low' }] },
    { openings: Array.from({ length: 5000 }, () => ({ wall: 'S', offsetFt: 1, widthFt: 1, heightFt: 1, sillHeightFt: 0 })) },
    JSON.parse('{"__proto__":{"polluted":true},"lengthFt":20}'),
  ];
  const stageIds = new Set<number>(STAGES.map((s) => s.id));
  for (const raw of hostile) {
    const b = sanitizeBuilding(raw);
    const label = JSON.stringify(raw)?.slice(0, 60) ?? String(raw);

    // Every scalar is finite and inside the range the Design panel itself enforces.
    for (const [k, lo, hi] of [
      ['lengthFt', 8, 60], ['widthFt', 8, 40], ['wallHeightFt', 7, 12],
      ['risePer12', 0, 12], ['overhangFt', 0, 3], ['crawlFt', 0, 4],
    ] as const) {
      const v = b[k];
      assert.ok(Number.isFinite(v) && v >= lo && v <= hi, `${label}: ${k}=${v} outside [${lo},${hi}]`);
    }
    for (const k of ['studSpacingIn', 'joistSpacingIn', 'rafterSpacingIn'] as const) {
      assert.ok(b[k] === 16 || b[k] === 24, `${label}: ${k}=${b[k]}`);
    }
    assert.ok(b.openings.length <= 40, `${label}: opening count capped`);
    for (const o of b.openings) {
      assert.ok(['N', 'S', 'E', 'W'].includes(o.wall), `${label}: wall ${o.wall}`);
      for (const v of [o.offsetFt, o.widthFt, o.heightFt, o.sillHeightFt]) {
        assert.ok(Number.isFinite(v) && v >= 0, `${label}: opening value ${v}`);
      }
    }
    assert.ok(!({} as Record<string, unknown>)['polluted'], 'prototype was not polluted');

    // The real proof: the sanitized design drives the generators without producing a single
    // non-finite coordinate or a non-positive cut.
    for (const m of generateFrame(b).members) {
      for (const v of [...m.position, ...m.rotation, m.cutLength]) {
        assert.ok(Number.isFinite(v), `${label}: ${m.id} non-finite`);
      }
      assert.ok(m.cutLength > 0, `${label}: ${m.id} cutLength ${m.cutLength}`);
      assert.ok(stageIds.has(m.stage), `${label}: ${m.id} bad stage`);
    }
  }
});

test('a partial design keeps the fields it does carry and defaults the rest', () => {
  const b = sanitizeBuilding({ lengthFt: 40, studSpacingIn: 24 });
  const d = defaultBuilding();
  assert.equal(b.lengthFt, 40, 'a valid supplied field is kept');
  assert.equal(b.studSpacingIn, 24);
  assert.equal(b.widthFt, d.widthFt, 'an absent field falls back to the default');
  assert.deepEqual(b.openings, d.openings);
});

test('design problems are engine data, and the wall run they check is the real one', () => {
  // These lived only in the on-screen panel — collapsed by default and display:none in print —
  // so a plan could be carried to the site with an opening running off the end of a wall and
  // nothing on the paper saying so. Now engine-side, so every surface can carry them.
  const clean = defaultBuilding();
  assert.deepEqual(designProblems(clean), [], 'the starting design is sound');

  // An opening past the end of its wall.
  const overrun = { ...clean, openings: [{ wall: 'S' as const, offsetFt: 19, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }] };
  assert.equal(designProblems(overrun).length, 1);
  assert.match(designProblems(overrun)[0]!, /runs past the end/);

  // A door too tall to leave a header.
  const noHeader = { ...clean, wallHeightFt: 7, openings: [{ wall: 'S' as const, offsetFt: 2, widthFt: 3, heightFt: 6.9, sillHeightFt: 0 }] };
  assert.match(designProblems(noHeader)[0]!, /no room for a header/);

  // E/W walls fit BETWEEN the N/S walls, losing a sill thickness (walls.ts runFt = widthFt - t).
  // Checking against the raw width let an opening overrun by up to that thickness unflagged.
  const t = 1.5 / 12;
  const w = clean.widthFt;
  const exact = { ...clean, openings: [{ wall: 'E' as const, offsetFt: w - t - 3, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }] };
  assert.deepEqual(designProblems(exact), [], 'an opening that exactly fills the true run is fine');
  const justOver = { ...clean, openings: [{ wall: 'E' as const, offsetFt: w - 3, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }] };
  assert.equal(designProblems(justOver).length, 1, 'but one sized to the RAW width overruns it');
});
