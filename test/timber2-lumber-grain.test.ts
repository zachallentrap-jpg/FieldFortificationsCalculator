// The contract between the lumber PROPS and the lumber TEXTURE.
//
// `lumberTexture()` draws its grain as vertical canvas lines — constant canvas-X, spanning
// canvas-Y — because of how the GLB props are unwrapped. That is not a free choice, it is a
// consequence, and this test pins the fact it depends on so the two cannot drift apart in
// silence.
//
// THE FACT: on a lumber prop's broad face, **V runs the full length of the piece** and U is a
// sliver a few percent wide. Grain drawn as constant canvas-Y would therefore be a line of
// constant V — crossing the board and repeating along it. Nine such lines on an eight-foot
// board is a band every eleven inches, which is exactly how board-and-batten siding came to
// render as horizontal clapboard: the geometry was vertical (its own test says so) and the
// material was lying about which way the wood ran.
//
// If the props are ever re-exported with a different unwrap, this test fails and says to
// re-check `lumberTexture` — rather than the siding quietly going back to looking like lap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROPS = ['lumber_2x4', 'lumber_2x6', 'lumber_4x4'] as const;

interface Glb { json: any; bin: Buffer }

function parseGlb(name: string): Glb {
  const buf = readFileSync(fileURLToPath(new URL(`../src/assets/models/${name}.glb`, import.meta.url)));
  let off = 12;
  let json: any = null;
  let bin: Buffer | null = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
  }
  assert.ok(json && bin, `${name}: not a readable GLB`);
  return { json, bin: bin! };
}

/** Float accessor rows. Only what this test needs — POSITION and TEXCOORD_0 are both float. */
function readAccessor(g: Glb, index: number): number[][] {
  const a = g.json.accessors[index];
  const bv = g.json.bufferViews[a.bufferView];
  const n = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]!;
  assert.equal(a.componentType, 5126, 'expected float components');
  const start = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const dv = new DataView(g.bin.buffer, g.bin.byteOffset + start, a.count * n * 4);
  const out: number[][] = [];
  for (let k = 0; k < a.count; k++) {
    const row: number[] = [];
    for (let c = 0; c < n; c++) row.push(dv.getFloat32((k * n + c) * 4, true));
    out.push(row);
  }
  return out;
}

test('every lumber prop unwraps V along the length — what the grain texture is drawn against', () => {
  for (const name of PROPS) {
    const g = parseGlb(name);
    const prim = g.json.meshes[0].primitives[0];
    assert.ok(prim.attributes.TEXCOORD_0 !== undefined, `${name}: prop has no UVs to map grain onto`);
    const pos = readAccessor(g, prim.attributes.POSITION);
    const uv = readAccessor(g, prim.attributes.TEXCOORD_0);
    assert.equal(pos.length, uv.length, `${name}: UV count must match vertex count`);

    // The broad face is the one at max local Z; local X is the length axis on these props.
    const zMax = Math.max(...pos.map((p) => p[2]!));
    const face = pos.map((p, i) => ({ p, uv: uv[i]! })).filter((r) => Math.abs(r.p[2]! - zMax) < 1e-4);
    assert.ok(face.length >= 4, `${name}: could not isolate a broad face`);

    const xs = face.map((r) => r.p[0]!);
    const vs = face.map((r) => r.uv[1]!);
    const us = face.map((r) => r.uv[0]!);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanV = Math.max(...vs) - Math.min(...vs);
    const spanU = Math.max(...us) - Math.min(...us);

    assert.ok(spanX > 0.5, `${name}: the sampled face does not span the length (${spanX.toFixed(2)})`);
    assert.ok(spanV > 0.9, `${name}: V must run the length; it spans only ${spanV.toFixed(3)}`);
    assert.ok(
      spanU < 0.2,
      `${name}: U is meant to be the narrow axis (spans ${spanU.toFixed(3)}). If the props were `
      + 're-unwrapped, lumberTexture() must be re-checked — its grain runs vertically in canvas '
      + 'space precisely because this atlas puts V along the length.',
    );
  }
});
