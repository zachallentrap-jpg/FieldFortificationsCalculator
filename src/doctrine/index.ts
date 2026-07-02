// Frozen doctrine index (§6, §19). Aggregates every doctrine table, registers every
// Provenance leaf with the registry (feeding the banner + placeholderReport), then
// freezes the STRUCTURE of each table so callers cannot add/remove keys. The Provenance
// LEAF objects are intentionally left unfrozen so a validated doctrine import (io.ts) can
// update value/status/source in place (see DECISIONS D8). Nothing downstream mutates
// doctrine except io.ts.

import { registerTree, isProvenance } from './registry';
import { positions, vehicleRamp } from './positions';
import { soils } from './soils';
import { standards } from './standards';
import { sandbag, revetments, camo, sump, excavation, machine, lumber } from './materials';
import {
  shielding,
  radiationHalving,
  parapet,
  berm,
  overhead,
  spanSizes,
  retainingWall,
  threats,
} from './protection';
import { labor } from './labor';

export const materials = { sandbag, revetments, camo, sump, excavation, machine, lumber };
export const protection = {
  shielding,
  radiationHalving,
  parapet,
  berm,
  overhead,
  spanSizes,
  retainingWall,
  threats,
};
export const vehicle = { ramp: vehicleRamp };

// Register every Provenance leaf under a stable dotted path.
registerTree('positions', positions);
registerTree('vehicle', vehicle);
registerTree('soils', soils);
registerTree('standards', standards);
registerTree('materials', materials);
registerTree('protection', protection);
registerTree('labor', labor);

// Freeze structure but stop at Provenance leaves (keep them mutable for import).
function freezeStructure(obj: unknown): void {
  if (isProvenance(obj)) return; // leaf stays mutable
  if (Array.isArray(obj)) {
    for (const v of obj) freezeStructure(v);
    Object.freeze(obj);
    return;
  }
  if (typeof obj === 'object' && obj !== null) {
    for (const v of Object.values(obj)) freezeStructure(v);
    Object.freeze(obj);
  }
}

for (const table of [positions, soils, standards, materials, protection, labor, vehicle]) {
  freezeStructure(table);
}

export { positions, soils, standards, labor };
export * from './protection';
export * from './units';
export { counts, all, getByPath } from './registry';
