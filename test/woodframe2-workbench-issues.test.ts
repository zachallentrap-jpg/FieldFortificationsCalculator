// TIMBER-2 — what the workbench says out loud (plan §4.1, mandate #2).
//
// The tool WARNS and never silently resizes, which only means anything if the warning reaches the
// person making the choice. There are two places a finding can surface: the printed command
// packet, and the issues strip above the model in the workbench. The packet is read once, at the
// end, by someone approving a build; the strip is read WHILE the pitch is being chosen.
//
// So the strip has to be fed from the model that was actually built. `normalizeSpec` reports what
// it had to repair about the SPEC — an opening slid back inside its wall, a roof this engine
// cannot frame — and knows nothing about the frame that comes out: a joist past its span table, a
// bird's mouth eating half a rafter at 12/12. `generateStructure` carries both, in that order.
//
// AND IT ONLY CARRIES THEM ONCE. The normalizer is idempotent — it reports a repair on the pass
// that makes it and has nothing to say on the next — so WHICH spec the build pass is handed
// decides whether the strip speaks at all. That is the sequence tested here, not just the wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateStructure } from '../src/woodframe/families/index';
import { normalizeSpec } from '../src/woodframe/normalize';
import { regenerateFrom } from '../src/ui/woodframe/regen';
import { familyById } from '../src/woodframe/catalog';

const SCENE = fileURLToPath(new URL('../src/ui/woodframe-scene.ts', import.meta.url));

const preset = (id: string) => JSON.parse(JSON.stringify(familyById(id as never)!.preset));

/** A gp-frame at a pitch whose bird's mouth is over the limit, with an opening off its wall. */
function troubledSpec(): Record<string, unknown> {
  const spec = preset('gp-frame');
  spec.roof = { kind: 'gable', risePer12: 12, overhangFt: 1 };
  // Past the end of the south wall: the normalizer slides it back and says so.
  spec.stories[0].openings.S = [
    { kind: 'door', offsetFt: 400, widthFt: 3, heightFt: 6, sillHeightFt: 0, fill: 'rough' },
  ];
  return spec;
}

test('the generated model carries everything the normalizer said, and then what the frame said', () => {
  // The reason the panel can read one list instead of two. If this ever stopped holding, feeding
  // the strip from the model would DROP a repair message, which is the opposite failure.
  const spec = troubledSpec();
  const fromNormalize = normalizeSpec(spec as never).issues.map((i) => i.message);
  const fromModel = generateStructure(spec as never).issues.map((i) => i.message);
  assert.ok(fromNormalize.length > 0, 'the fixture stopped tripping the normalizer');
  assert.deepEqual(fromModel.slice(0, fromNormalize.length), fromNormalize, 'the normalizer’s report was reordered or lost');
  assert.ok(
    fromModel.some((m) => m.includes('bird’s mouth')),
    `the frame’s own findings are missing: ${fromModel.join(' | ')}`,
  );
});

test('shortening the building on the panel still reports every opening it moved', () => {
  // The operator's sequence, end to end: open a clean card, drag one number, read the strip. A
  // 48-ft GP frame carries eight openings laid out along its long walls; taken to 8 ft, every one
  // of them is past the end of the wall it is on and the normalizer relocates all eight. If the
  // regenerate step repairs the spec BEFORE building from it, the build pass finds an
  // already-repaired spec, reports nothing, and the tool moves four doors and four windows
  // without a word.
  const clean = preset('gp-frame');
  assert.deepEqual(regenerateFrom(clean).messages, [], 'the standard GP frame no longer opens clean');

  const edited = preset('gp-frame');
  edited.dims.lengthFt = 8;
  const regen = regenerateFrom(edited);
  const moved = regen.messages.filter((m) => /moved to/.test(m));
  assert.equal(
    moved.length, 8,
    `eight openings were relocated and ${moved.length} were reported: ${regen.messages.join(' | ')}`,
  );
  for (const wall of ['S', 'N']) {
    assert.ok(moved.some((m) => m.includes(`wall ${wall}`)), `nothing was said about wall ${wall}`);
  }

  // The spec handed back is the REPAIRED one — what was actually built, and what the panel writes
  // to the stored build. Which is why the message above had to be produced on this pass: run the
  // repaired spec through again and the normalizer has nothing left to report.
  const built = regen.spec as unknown as { stories: { openings: { S: { offsetFt: number }[] } }[] };
  assert.ok(built.stories[0]!.openings.S.every((o) => o.offsetFt <= 5), 'the openings were not moved after all');
  assert.deepEqual(
    regenerateFrom(regen.spec).messages, [],
    'the second pass still has something to say, so the fixture no longer shows why order matters',
  );
});

test('the frame’s own findings ride the same list as the repairs', () => {
  // One strip, both kinds. A spec that needs repair AND frames a notch past its limit produces
  // the repair first and the measurement after it, from the single call the workbench makes.
  const regen = regenerateFrom(troubledSpec() as never);
  assert.ok(regen.messages.some((m) => /moved to/.test(m)), regen.messages.join(' | '));
  assert.ok(regen.messages.some((m) => m.includes('bird’s mouth')), regen.messages.join(' | '));
});

test('the workbench strip is filled from the regenerate step, and the boot file repairs nothing itself', () => {
  // Read as source because the boot file owns the DOM and cannot be imported outside a browser.
  // What is asserted is the wiring: both places the strip is filled read the step above, and the
  // boot file never runs the normalizer itself — doing that is what hands the build pass a spec
  // with nothing left to report. The two call sites are the workbench opening and every
  // regenerate after it.
  const src = readFileSync(SCENE, 'utf8');
  const calls = [...src.matchAll(/(?<!function )renderIssues\(([^;]*?)\);/gs)].map((m) => m[1]!.trim());
  assert.ok(calls.length >= 2, `expected the open and regenerate call sites, found ${calls.length}`);
  for (const arg of calls) {
    assert.match(arg, /regen\.messages/, `renderIssues is fed something other than the regenerate step: ${arg}`);
  }
  assert.doesNotMatch(
    src, /normalizeSpec\s*\(/,
    'the boot file repairs the spec itself, so the pass that builds the model has nothing left to report',
  );
});
