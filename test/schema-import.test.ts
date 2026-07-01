// §17 schema.import — valid files round-trip; malformed / newer / prototype-polluted / oversized
// files are rejected with a message; scenarios validate their nested inputs; the ScenarioStore
// round-trips over the in-memory adapter and skips corrupt rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInputs, validateScenario, safeJsonParse } from '../src/state/schema';
import { ScenarioStore, makeScenario } from '../src/state/scenarios';
import { MemoryAdapter } from '../src/state/persistence';
import { defaultInputs } from './helpers';

test('valid inputs validate and round-trip through JSON', () => {
  const inputs = defaultInputs({ positionType: 'mg_crew', sectorAzimuths: { leftDeg: -30, rightDeg: 30 } });
  const parsed = safeJsonParse(JSON.stringify(inputs));
  assert.ok(parsed.ok);
  const v = validateInputs(parsed.value);
  assert.ok(v.ok);
  assert.deepEqual(v.value, inputs);
});

test('rejects missing / newer schemaVersion', () => {
  const noVer = validateInputs({ ...defaultInputs(), schemaVersion: undefined });
  assert.equal(noVer.ok, false);
  const newer = validateInputs({ ...defaultInputs(), schemaVersion: 99 });
  assert.equal(newer.ok, false);
  if (!newer.ok) assert.match(newer.error, /newer version/);
});

test('rejects wrong field types', () => {
  assert.equal(validateInputs({ ...defaultInputs(), count: '4' }).ok, false);
  assert.equal(validateInputs({ ...defaultInputs(), standard: 'bogus' }).ok, false);
  assert.equal(validateInputs({ ...defaultInputs(), unit: 'furlongs' }).ok, false);
  assert.equal(validateInputs({ ...defaultInputs(), overheadCover: 'yes' }).ok, false);
  assert.equal(validateInputs({ ...defaultInputs(), sectorAzimuths: { leftDeg: 'x', rightDeg: 1 } }).ok, false);
});

test('safeJsonParse rejects non-JSON, oversized, and prototype-pollution payloads', () => {
  assert.equal(safeJsonParse('{not json').ok, false);
  assert.equal(safeJsonParse('x'.repeat(600 * 1024)).ok, false);
  const polluted = safeJsonParse('{"a":{"__proto__":{"admin":true}}}');
  assert.equal(polluted.ok, false);
  if (!polluted.ok) assert.match(polluted.error, /prototype pollution/);
});

test('scenario validation guards id/name and nested inputs', () => {
  assert.equal(validateScenario({ id: 'a', inputs: defaultInputs() }).ok, false, 'missing name');
  assert.equal(validateScenario({ id: 'a', name: 'x', inputs: { ...defaultInputs(), count: 'bad' } }).ok, false);
  const good = validateScenario(makeScenario('id1', 'Ridge OP', defaultInputs()));
  assert.ok(good.ok);
});

test('ScenarioStore round-trips and skips corrupt rows', async () => {
  const adapter = new MemoryAdapter();
  const store = new ScenarioStore(adapter);
  await store.save(makeScenario('a', 'Alpha', defaultInputs({ positionType: 'two_man' })));
  await store.save(makeScenario('b', 'Bravo', defaultInputs({ positionType: 'mg_crew' })));

  const loaded = await store.load('a');
  assert.equal(loaded?.name, 'Alpha');
  assert.equal(loaded?.inputs.positionType, 'two_man');

  // Inject a corrupt row directly; list must skip it, not throw.
  await adapter.set('scenario:junk', '{ broken');
  const list = await store.list();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((s) => s.name), ['Alpha', 'Bravo']);

  await store.remove('a');
  assert.equal(await store.load('a'), null);
});
