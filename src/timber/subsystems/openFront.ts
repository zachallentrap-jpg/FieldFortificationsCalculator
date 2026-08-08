// TIMBER-2 — the open front: a wall replaced by posts and a beam.
//
// `BuildingSpec.openFront` names one wall as the whole opening — a storage shed you back a
// vehicle into. Everything around it worked: `spec.ts` documented it as "posts + header",
// `normalizeSpec` dropped that wall's openings with a warning ("the whole wall is the opening"),
// `isLegacyBuilding` excluded it from the frozen path, and the storage-shed card offers it in so
// many words: *"Covered storage with a wide door bay — or leave the whole front open."*
//
// Nothing read it. A spec with `openFront` generated a model BYTE-IDENTICAL to one without —
// same member count, same studs on that wall — so the wall the card promises to leave open was
// framed shut like any other.
//
// C-10 IS NOT IN THE WAY HERE. `generateWalls` is frozen and frames four walls; this module does
// not touch it. The building family drops what the open wall does not have and adds what it
// does, which is the same composition the shed/flat roofs already use. The compat goldens cannot
// move, because `isLegacyBuilding` has always refused a spec with an open front.

import type { Member, WallId } from '../types';
import { DRESSED } from '../types';
import type { BuildingSpec } from '../spec';
import { makeEmitter } from '../emit';
import { LUMBER, LAYOUT, TOLERANCE, IN_PER_FT, citeOf } from '../doctrine';
import { headerForSpan } from '../normalize';
import type { WallsContract } from './wallSystem';

/**
 * Roles the open wall does not have. Its PLATES stay — they are what the rafters bear on, and
 * the posts and beam below carry them — but nothing that fills the wall between them survives.
 */
const CLOSED_WALL_ROLES: ReadonlySet<string> = new Set([
  'stud', 'solePlate', 'brace', 'kingStud', 'jackStud', 'header', 'cripple',
]);

/** Strip the framing the frozen generator put in a wall that is meant to be an opening. */
export function removeClosedWall(members: Member[], openFront: WallId): Member[] {
  return members.filter((m) => !(m.wall === openFront && CLOSED_WALL_ROLES.has(m.role)));
}

export interface OpenFrontInput {
  spec: BuildingSpec;
  walls: WallsContract;
  stageWalls: number;
}

/**
 * Posts on the open wall's line and a beam across them, tight under the plates.
 *
 * Bay width follows `LAYOUT.postSpacingMaxFt` — the same rule the foundation posts use — and the
 * beam over each bay is sized by the header table for that span, so an open front cannot quietly
 * carry a longer span on the same stick than a doorway would.
 */
export function generateOpenFront(input: OpenFrontInput): Member[] {
  const emit = makeEmitter('OF');
  const { spec, walls, stageWalls } = input;
  const wall = spec.openFront;
  if (!wall) return emit.members;
  const surface = walls.surfaces.find((s) => s.wall === wall);
  if (!surface) return emit.members;

  const postNominal = LUMBER.postNominal.value as string;
  const postD = DRESSED[postNominal]!.d / IN_PER_FT;
  const plateT = DRESSED[LUMBER.plateNominal.value as string]!.w / IN_PER_FT;
  const runFt = surface.runFt;

  // Bays: as few posts as the spacing rule allows, evenly spread so no bay is longer than the
  // rest. An 8-ft rule over a 20-ft front gives three bays of 6 ft 8 in, not two of 8 and one
  // of 4 — even bays are what a beam schedule assumes.
  const bays = Math.max(1, Math.ceil(runFt / (LAYOUT.postSpacingMaxFt.value as number)));
  const bayFt = runFt / bays;
  const beamNominal = headerForSpan(bayFt);
  const beamD = DRESSED[beamNominal]!.d / IN_PER_FT;

  const plateBottom = walls.plateTopY - 2 * plateT; // under the top plate AND the cap plate
  const beamTop = plateBottom;
  const beamBottom = beamTop - beamD;
  const postLen = Math.max(TOLERANCE.minSliverFt, beamBottom);

  const at = (u: number): [number, number] => [
    surface.origin[0] + surface.along[0] * u,
    surface.origin[1] + surface.along[1] * u,
  ];
  const yaw = Math.atan2(-surface.along[1], surface.along[0]);

  for (let i = 0; i <= bays; i++) {
    // The end posts are held half a post inside the corners so they stand ON the plan line
    // rather than outside it, the same edge-flush rule the stud layout uses.
    const u = Math.min(Math.max(i * bayFt, postD / 2), runFt - postD / 2);
    const c = at(u);
    emit('post', postNominal, {
      cutLengthFt: postLen,
      position: [c[0], postLen / 2, c[1]],
      rotation: [0, yaw, Math.PI / 2],
      stage: stageWalls,
      wall,
      nailing: 'framing anchor top and bottom (PH)',
      doctrineRef: `${citeOf(LUMBER.postNominal)} — open front: ${bays} bay(s) at ${bayFt.toFixed(2)} ft`,
    });
  }

  // One beam per bay, bearing on the posts and carrying the plates over the opening.
  //
  // A BEAM STOPS ON THE POST IT SHARES. `bayFt + postD`, centred on the bay, reached half a post
  // past BOTH of its ends — so at every interior post the two beams meeting there each covered
  // the whole post and shared a 3½ x 9¼ x 1½-in block of wood with each other (5 pairs on a 48-ft
  // front), and the two end beams stood 1¾ in past the building line, into the corner wall's
  // siding. A splice over a post lands on its CENTRELINE, which gives each beam half the post to
  // bear on and the other beam the other half.
  //
  // The two ends are the exception and go the other way: the corner posts are already held half a
  // post inside the corner so they stand ON the plan line, so the beam that reaches them runs to
  // that line and bears on the whole post.
  for (let i = 0; i < bays; i++) {
    const u0 = i === 0 ? 0 : i * bayFt;
    const u1 = i === bays - 1 ? runFt : (i + 1) * bayFt;
    const mid = at((u0 + u1) / 2);
    emit('header', beamNominal, {
      cutLengthFt: u1 - u0,
      position: [mid[0], beamBottom + beamD / 2, mid[1]],
      rotation: [0, yaw, 0],
      stage: stageWalls,
      wall,
      nailing: '16d @ 16" both plies; framing anchor to each post (PH)',
      doctrineRef: `${citeOf(LUMBER.headerNominal)} — beam over a ${bayFt.toFixed(2)} ft open bay`,
    });
  }
  return emit.members;
}
