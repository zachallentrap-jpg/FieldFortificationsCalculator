// G-9 schema integrity (first tranche): zero orphan leaves BY CONSTRUCTION
// (catalog == union of static consumer lists, both directions), unique append-only
// ids, bounds policy (B14), exclusive-consumer table validity, coherence targets
// exist, and no leaf carries anything value-shaped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAVES, LEAF_INDEX } from '../src/schema/leaves/index';
import { CONSUMERS, EXCLUSIVE_CONSUMERS } from '../src/schema/consumers';
import { isNumericLeaf } from '../src/schema/leaf';

test('catalog ids are unique and slug-shaped', () => {
  assert.equal(LEAF_INDEX.size, LEAVES.length);
  for (const l of LEAVES) {
    assert.match(l.id, /^[a-zA-Z0-9_.-]+$/, `leaf id not slug-shaped: ${l.id}`);
  }
});

test('zero orphans: every leaf consumed, every consumed id exists (set equality)', () => {
  const consumed = new Set<string>();
  for (const [consumer, ids] of Object.entries(CONSUMERS)) {
    for (const id of ids) {
      assert.ok(LEAF_INDEX.has(id), `${consumer} consumes unknown leaf: ${id}`);
      consumed.add(id);
    }
  }
  const orphans = LEAVES.filter((l) => !consumed.has(l.id)).map((l) => l.id);
  assert.deepEqual(orphans, [], `orphan leaves (no consumer): ${orphans.join(', ')}`);
});

test('bounds policy: safety-critical leaves carry sign bounds only (B14)', () => {
  for (const l of LEAVES) {
    if (!isNumericLeaf(l)) continue;
    if (l.safetyCritical) {
      assert.equal(l.bounds.kind, 'sign', `${l.id}: safety-critical leaf with non-sign bounds`);
    } else if (l.bounds.kind === 'range') {
      assert.ok(l.bounds.decisionRef.length > 0, `${l.id}: range bounds without decision ref`);
      assert.ok(
        l.bounds.min > 0 && l.bounds.max / l.bounds.min >= 5,
        `${l.id}: range bounds too tight (looseness gate: max/min >= 5)`,
      );
    }
  }
});

test('divisor leaves are numeric and never zero-permissive', () => {
  for (const l of LEAVES) {
    if (isNumericLeaf(l) && l.divisor) {
      assert.ok(
        l.bounds.kind !== 'sign' || l.bounds.sign === '>0',
        `${l.id}: divisor leaf must exclude zero`,
      );
    }
  }
});

test('exclusive-consumer table: ids exist and appear ONLY in their exclusive consumer list', () => {
  for (const [leafId, owner] of Object.entries(EXCLUSIVE_CONSUMERS)) {
    assert.ok(LEAF_INDEX.has(leafId), `exclusive table names unknown leaf ${leafId}`);
    for (const [consumer, ids] of Object.entries(CONSUMERS)) {
      if (consumer === owner) {
        assert.ok(ids.includes(leafId), `${leafId} missing from its exclusive consumer ${owner}`);
      } else {
        assert.ok(!ids.includes(leafId), `${leafId} leaked into ${consumer} (exclusive to ${owner})`);
      }
    }
  }
});

test('check coherence targets exist and reference real body units', () => {
  for (const l of LEAVES) {
    if (l.unit !== 'text' || l.kind !== 'check' || !('coherence' in l) || !l.coherence) continue;
    assert.ok(LEAF_INDEX.has(l.coherence.governingDimKey), `${l.id}: governing dim ${l.coherence.governingDimKey} missing`);
    assert.ok(LEAF_INDEX.has(`body.${l.coherence.bodyUnitId}.approxFt`), `${l.id}: body unit ${l.coherence.bodyUnitId} missing`);
    assert.ok(l.coherence.toleranceFt > 0, `${l.id}: non-positive coherence tolerance`);
  }
});

test('ship-empty at the type level: no leaf object carries a value-shaped property', () => {
  for (const l of LEAVES) {
    for (const key of Object.keys(l)) {
      assert.ok(!/^(value|default|seed|magnitude)$/i.test(key), `${l.id} carries forbidden property ${key}`);
    }
  }
});

test('catalog size is reported (an output, not a claim)', () => {
  const numeric = LEAVES.filter((l) => isNumericLeaf(l)).length;
  const text = LEAVES.filter((l) => l.unit === 'text').length;
  const flags = LEAVES.filter((l) => l.unit === 'flag').length;
  console.log(`# catalog: ${LEAVES.length} leaves (${numeric} numeric, ${text} text, ${flags} flags)`);
  assert.ok(LEAVES.length > 250, 'catalog implausibly small — table missing?');
});
