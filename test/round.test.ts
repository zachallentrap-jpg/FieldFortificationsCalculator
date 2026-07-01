import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ceilInt, round1, round2, clamp, finite } from '../src/engine/round';

test('ceilInt: exact integers stay put; drift does not over-ceil', () => {
  assert.equal(ceilInt(2), 2);
  assert.equal(ceilInt(2.0000000001), 2); // fp drift on an "exact" integer
  assert.equal(ceilInt(2.4), 3);
  assert.equal(ceilInt(0), 0);
});

test('ceilInt: non-finite and negatives → 0', () => {
  assert.equal(ceilInt(Infinity), 0);
  assert.equal(ceilInt(-Infinity), 0);
  assert.equal(ceilInt(NaN), 0);
  assert.equal(ceilInt(-3), 0);
});

test('round1 / round2', () => {
  assert.equal(round1(2.34), 2.3);
  assert.equal(round1(2.36), 2.4);
  assert.equal(round1(Infinity), 0);
  assert.equal(round2(1.23456), 1.23);
});

test('clamp respects bounds and guards non-finite', () => {
  assert.equal(clamp(5, 1, 10), 5);
  assert.equal(clamp(-5, 1, 10), 1);
  assert.equal(clamp(50, 1, 10), 10);
  assert.equal(clamp(NaN, 3, 10), 3);
});

test('finite coerces junk to fallback', () => {
  assert.equal(finite(4.2), 4.2);
  assert.equal(finite(NaN), 0);
  assert.equal(finite('x' as unknown), 0);
  assert.equal(finite(undefined, 7), 7);
});
