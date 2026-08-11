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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generateStructure } from '../src/timber/families/index';
import { normalizeSpec } from '../src/timber/normalize';
import { familyById } from '../src/timber/catalog';

const SCENE = fileURLToPath(new URL('../src/ui/woodframe-scene.ts', import.meta.url));

/** A gp-frame at a pitch whose bird's mouth is over the limit, with an opening off its wall. */
function troubledSpec(): Record<string, unknown> {
  const spec = JSON.parse(JSON.stringify(familyById('gp-frame' as never)!.preset));
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

test('the workbench issues strip is fed from the generated model, not from normalize alone', () => {
  // Read as source because the boot file owns the DOM and cannot be imported outside a browser.
  // What is asserted is the wiring itself: every place the strip is filled reads the model that
  // the viewport is showing, so a span or seat-depth warning cannot reach the packet and miss the
  // screen. The two call sites are the workbench opening and every regenerate after it.
  const src = readFileSync(SCENE, 'utf8');
  const calls = [...src.matchAll(/(?<!function )renderIssues\(([^;]*?)\);/gs)].map((m) => m[1]!.trim());
  assert.ok(calls.length >= 2, `expected the open and regenerate call sites, found ${calls.length}`);
  for (const arg of calls) {
    assert.match(arg, /model!?\.issues/, `renderIssues is fed something other than the model’s issues: ${arg}`);
    assert.doesNotMatch(arg, /normalizeSpec/, `renderIssues is fed normalize’s issues, so the frame’s findings never show: ${arg}`);
  }
});
