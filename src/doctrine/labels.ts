// Human labels for the ids a user picked. Every doctrine table already carries a label for every
// row, but three surfaces were printing the raw key instead: the job sheet a crew carries to the
// site said "at-rpg", "sand" and "deliberate" where the screen said "RPG (shaped charge)", "Sand"
// and "Deliberate", and the CSV did the same for the position as well. Only the position was
// resolved on the sheet, so the same table mixed labels and internal slugs row by row.
//
// Lives in doctrine rather than in a render module because render/ , layout/ and the exporters all
// need it and none of them should depend on another. The lookup that existed (tools.ts's private
// threatLabel) is now this one, so a fourth copy cannot drift from the other three.

import { positions } from './positions';
import { soils } from './soils';
import { standards } from './standards';
import { threats } from './protection';

// Falls back to the raw id rather than throwing or blanking: an unknown id means doctrine was
// edited or imported out from under a saved setup, and showing the key beats showing nothing.
const labelOf = (table: Record<string, { label: string }>, id: string): string => table[id]?.label ?? id;

export const positionLabel = (id: string): string => labelOf(positions, id);
export const soilLabel = (id: string): string => labelOf(soils, id);
export const standardLabel = (id: string): string => labelOf(standards, id);
// 'none' is a real, selectable choice rather than a doctrine row, so it is named here.
export const threatLabel = (id: string): string => (id === 'none' ? 'None' : labelOf(threats, id));

// Cover materials are the FOURTH instance of the defect this module exists for, and the one that
// survived the first three: the job sheet a crew carries and the specs panel both printed
// `result.cover.material` raw, so the overhead-cover row read `1'-2" sandbagged_soil` on a document
// that names everything else in plain words.
//
// These names live here rather than coming from a doctrine table because the shielding and
// radiation leaves are P()-wrapped MAGNITUDES keyed by material, not rows carrying labels of their
// own. Naming a material is translation, not doctrine: no thickness, no protection and no
// verification status is implied by any of these strings.
const COVER_MATERIAL: Record<string, string> = {
  soil: 'soil',
  sandbagged_soil: 'sandbagged soil',
  sand: 'sand',
  clay: 'clay',
  gravel: 'gravel',
  concrete: 'concrete',
  steel: 'steel',
  timber: 'timber',
  snow_ice: 'snow / ice',
};

// '' means no earth roof is built at all (engine/protection.ts), and must stay empty so callers
// do not print a dangling unit. An id added to doctrine later de-slugs to words rather than
// reaching a field document as a raw key.
export const coverMaterialLabel = (id: string): string =>
  id ? (COVER_MATERIAL[id] ?? id.replace(/_/g, ' ')) : '';

// How a BLOCKING design problem is headed, everywhere. This sentence existed verbatim in six
// places — the validation panel, the schedule verdict, the screen-reader status line, the printed
// job sheet, TIMBER-1's own panel, and a comment in the CSV writer explaining what the screen says
// — which is exactly the "a second place deciding the same thing" shape that has produced defects
// in this codebase before. TIMBER-1's copy carried the note "One string, both surfaces"; this is
// that note applied across both tools rather than within one.
//
// Naming, not doctrine: the count comes from the caller's own validation result, and nothing about
// severity or magnitude is decided here.
export const problemsHeading = (count: number): string =>
  'Fix before building — ' + count + ' problem' + (count === 1 ? '' : 's');

// What the sandbag line under a parapet actually IS, which depends on how the parapet is built.
// An EARTH parapet's mass is spoil, so its only bags are the firing-rest course at the aperture; a
// SANDBAG parapet (bunker) bills the full ring. engine/explain.ts resolved the two correctly and
// engine/materials.ts hardcoded "Sandbags — parapet" for both — so on the far more common earth
// case a crew read "Sandbags — parapet 33 ea" for a position whose parapet is dirt, and tapping
// that number opened a panel titled "front firing rest" computing something else entirely
// (frontage × bag width × rest height, not parapet volume).
//
// materials.ts already branched on this same mode one argument later, to pick which doctrine leaves
// decide the line's PLACEHOLDER flag. It branched the provenance and not the name.
export const parapetBagsLabel = (parapetMode: string): string =>
  parapetMode === 'sandbag' ? 'Sandbags — parapet' : 'Sandbags — front firing rest';
