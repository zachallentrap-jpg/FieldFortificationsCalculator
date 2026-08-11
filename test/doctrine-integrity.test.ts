import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index'; // triggers registration
import { all, getByPath, counts } from '../src/doctrine/registry';
import { shielding, shieldMaterials, spanSizes, threats } from '../src/doctrine/protection';
import { excavationSplit } from '../src/doctrine/stages';

test('doctrine registered non-empty', () => {
  const entries = all();
  assert.ok(entries.length > 0, 'registry should have entries');
});

test('every registered value is a PLACEHOLDER on a fresh build (§2.5)', () => {
  for (const e of all()) {
    assert.equal(e.status, 'PLACEHOLDER', 'unfilled doctrine must be PLACEHOLDER: ' + e.path);
  }
});

test('no DOCTRINE entry carries a TODO source', () => {
  for (const e of all()) {
    if (e.status === 'DOCTRINE') {
      assert.ok(!/todo/i.test(e.source), 'DOCTRINE entry must not have TODO source: ' + e.path);
    }
  }
});

test('every safetyCritical value has a non-empty source (§3)', () => {
  let scCount = 0;
  for (const e of all()) {
    if (e.safetyCritical) {
      scCount++;
      assert.ok(e.source.trim().length > 0, 'safetyCritical needs a source: ' + e.path);
    }
  }
  assert.ok(scCount > 0, 'expected some safety-critical values (shielding/standoff/roof)');
});

test('numeric ranges are sane (finite, non-negative, bounded)', () => {
  for (const e of all()) {
    const p = getByPath(e.path);
    assert.ok(p, 'path resolves: ' + e.path);
    if (typeof p.value === 'number') {
      assert.ok(Number.isFinite(p.value), 'finite: ' + e.path);
      assert.ok(p.value >= 0, 'non-negative: ' + e.path);
      assert.ok(p.value < 1000, 'bounded: ' + e.path);
    }
  }
});

// The two tables the engine reads by ORDER and by SUM rather than value by value. The importer
// re-checks both on every fill (doctrine/io); these hold the shipped table to the same contract.
test('stringer span limits ascend — the size lookup is first-fit', () => {
  for (let i = 1; i < spanSizes.length; i++) {
    assert.ok(
      spanSizes[i]!.maxSpan.value > spanSizes[i - 1]!.maxSpan.value,
      'out of order at ' + spanSizes[i]!.sizeLabel + ' — a wide span would match an undersized row first',
    );
  }
});

test('excavation stage shares sum to 1 — the stage clock partitions one total', () => {
  const sum = Object.values(excavationSplit).reduce((acc, s) => acc + s.value, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'shares sum to ' + sum);
});

// The engine reads a protection magnitude of zero as ABSENT and fails the roof safe on it
// (engine/protection.ts), so a zero anywhere in these two tables would quietly take overhead
// cover away from a threat the shipped doctrine claims to size a roof for.
test('every shielding thickness and munition standoff is strictly positive', () => {
  for (const [id, row] of Object.entries(shielding)) {
    for (const mat of shieldMaterials) {
      assert.ok(row[mat].value > 0, 'shielding ' + id + '.' + mat + ' is ' + row[mat].value);
    }
  }
  for (const [id, t] of Object.entries(threats)) {
    assert.ok(t.standoffMin.value > 0, 'standoff ' + id + ' is ' + t.standoffMin.value);
  }
});

test('counts() is internally consistent with all placeholders remaining', () => {
  const c = counts();
  assert.equal(c.total, all().length);
  assert.equal(c.doctrine, 0);
  assert.equal(c.placeholder, c.total);
  assert.equal(c.safetyCriticalRemaining, c.safetyCritical);
  assert.ok(c.safetyCritical > 0);
});
