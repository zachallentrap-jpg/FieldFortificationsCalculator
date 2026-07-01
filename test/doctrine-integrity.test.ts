import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/doctrine/index'; // triggers registration
import { all, getByPath, counts } from '../src/doctrine/registry';

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

test('counts() is internally consistent with all placeholders remaining', () => {
  const c = counts();
  assert.equal(c.total, all().length);
  assert.equal(c.doctrine, 0);
  assert.equal(c.placeholder, c.total);
  assert.equal(c.safetyCriticalRemaining, c.safetyCritical);
  assert.ok(c.safetyCritical > 0);
});
