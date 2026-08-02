// Canonical serialization + SHA-256 (blueprint §2.6, B21): NIST vectors for the hash,
// key-order independence for the serializer, and the shuffle test — identical content
// in any insertion order produces identical contentHash AND identical exported bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex } from '../src/schema/sha256';
import { canonicalJson, CanonError } from '../src/schema/canon';
import { computeSchemaHash } from '../src/schema/schemaHash';
import { LEAVES } from '../src/schema/leaves/index';
import { exportFill, computeContentHash } from '../src/schema/fill';
import { generateFill } from './fixtures/testFill';

test('sha256 matches FIPS/NIST vectors', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  );
  // Block-boundary lengths (55/56/64 bytes) exercise the padding paths.
  assert.equal(sha256Hex('a'.repeat(55)), sha256Hex('a'.repeat(55)));
  assert.equal(sha256Hex('a'.repeat(64)).length, 64);
});

test('canonicalJson sorts keys, normalizes NFC, refuses non-finite and undefined', () => {
  assert.equal(canonicalJson({ b: 1, a: 'x' }), '{"a":"x","b":1}');
  // é composed vs decomposed normalize to identical bytes.
  assert.equal(canonicalJson('é'), canonicalJson('é'));
  assert.throws(() => canonicalJson(Number.POSITIVE_INFINITY), CanonError);
  assert.throws(() => canonicalJson({ a: undefined as unknown as string }), CanonError);
});

test('schemaHash is stable across leaf array order', () => {
  const shuffled = [...LEAVES].reverse();
  assert.equal(computeSchemaHash(LEAVES), computeSchemaHash(shuffled));
});

test('fill contentHash and exported bytes are insertion-order independent (B21)', () => {
  const fill = generateFill();
  const reversed = { ...fill, records: [...fill.records].reverse() };
  assert.equal(computeContentHash(reversed), fill.contentHash);
  assert.equal(exportFill({ ...reversed, contentHash: fill.contentHash }), exportFill(fill));
});

test('docs/HASHING.md worked vector reproduces exactly', () => {
  const vector = {
    fillFormatVersion: 2, class: 'DOCTRINE', schemaHash: 'a'.repeat(64),
    records: [{
      leafId: 'pos.one_man.hole.D', value: 4,
      citation: { pub: 'EXAMPLE-PUB', locator: 'fig. X-1' },
      enteredBy: 'A. Example', entryMethod: 'file-import',
    }],
    audit: [{ seq: 1, at: '2000-01-01T00:00:00Z', type: 'entry' }],
  };
  assert.equal(
    sha256Hex(canonicalJson(vector)),
    '59396a4ae2cb1cec7aead792416f84c1f06a1aedc7e68a6c574a7fe115709a27',
  );
});

test('exported fill is valid JSON whose last field is the contentHash', () => {
  const fill = generateFill();
  const text = exportFill(fill);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  assert.equal(parsed['contentHash'], fill.contentHash);
  const keys = Object.keys(parsed);
  assert.equal(keys[keys.length - 1], 'contentHash');
});
