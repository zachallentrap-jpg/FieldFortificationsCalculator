// Materials (§8). ILLUSTRATIVE PLACEHOLDER values for sandbags, revetment systems, camo,
// sump, excavation swell, and machine assist. Quantitative fields are P()-wrapped; kinds,
// labels, and the buildsFace flag are qualitative structure. Not authoritative.

import { P } from './types';
import type { Provenance } from './types';

// ── Sandbag (filled) — dimensions in feet ──────────────────────────────────────
export interface Sandbag {
  L: Provenance<number>;
  W: Provenance<number>;
  H: Provenance<number>;
  wasteFactor: Provenance<number>; // ×count for burst/misfilled bags
  frontWallHeight: Provenance<number>; // height of the front firing-rest sandbag course
  basicLoad: Provenance<number>; // sandbags a soldier carries as a starting set
}
export const sandbag: Sandbag = {
  L: P(1.25, { unit: 'ft', note: 'filled bag length (illustrative)' }),
  W: P(0.75, { unit: 'ft', note: 'filled bag width (illustrative)' }),
  H: P(0.33, { unit: 'ft', note: 'filled bag thickness (illustrative)' }),
  wasteFactor: P(1.15, { note: 'sandbag waste factor (illustrative)' }),
  // An earth-parapet rifle/crew position bags ONLY the firing rest: ONE course spanning the
  // full frontage, laid 2 bags deep (front-to-back), ~10 in tall — ATP 3-21.8 §5-238 "front
  // retaining wall...at least 10 inches high (2 filled sandbags in-depth)". The dirt U-mound is
  // built up around and behind it; this is the only concentrated sandbag on the parapet.
  frontWallHeight: P(0.83, { unit: 'ft', note: '~10 in front retaining-wall course height (illustrative)' }),
  // Each soldier carries ~5-7 sandbags as a starting set (ATP 3-21.8 note after §5-260,
  // "five to seven sandbags") — a design needing far more implies on-site fill / resupply.
  basicLoad: P(7, { note: 'sandbags carried per soldier (illustrative)' }),
};

// ── Revetment systems ──────────────────────────────────────────────────────────
export type RevetKind = 'none' | 'bag' | 'picket' | 'panel';
export interface RevetRow {
  label: string;
  kind: RevetKind;
  buildsFace: boolean; // does it revet the excavation face (adds face labor/material)?
  spacing?: Provenance<number>; // ft between pickets (picket systems only)
  wirePerPicket?: Provenance<number>; // ft of tie wire per picket
  note: string;
}
export const revetments: Record<string, RevetRow> = {
  none: { label: 'None', kind: 'none', buildsFace: false, note: 'No revetment.' },
  sandbag_facing: {
    label: 'Sandbag facing',
    kind: 'bag',
    buildsFace: true,
    note: 'Faced with sandbags.',
  },
  pickets_wire: {
    label: 'Pickets & wire',
    kind: 'picket',
    buildsFace: true,
    spacing: P(2.0, { unit: 'ft', note: 'picket spacing (illustrative)' }),
    wirePerPicket: P(6.0, { unit: 'ft', note: 'tie wire per picket (illustrative)' }),
    note: 'U-pickets with wire/brush facing.',
  },
  corrugated_metal: {
    label: 'Corrugated metal',
    kind: 'panel',
    buildsFace: true,
    note: 'Corrugated sheet facing.',
  },
  timber_plywood: {
    label: 'Timber & plywood',
    kind: 'panel',
    buildsFace: true,
    note: 'Timber frame with plywood facing.',
  },
};

// ── Camouflage ───────────────────────────────────────────────────────────────
export const camo = {
  drapeFactor: P(1.25, { note: 'camo net area factor over footprint (illustrative)' }),
};

// ── Grenade sump — dimensions in feet ──────────────────────────────────────────
export const sump = {
  L: P(1.0, { unit: 'ft', note: 'sump length (illustrative)' }),
  W: P(1.0, { unit: 'ft', note: 'sump width (illustrative)' }),
  D: P(1.0, { unit: 'ft', note: 'sump depth (illustrative)' }),
  gravelFt3: P(1.0, { unit: 'ft³', note: 'gravel per sump (illustrative)' }),
  rollInSlope: P(0.1, { note: 'floor roll-in slope toward sump (illustrative)' }),
};

// ── Excavation swell (bank → loose) ─────────────────────────────────────────────
export const excavation = {
  swellFactor: P(1.25, { note: 'bank-to-loose swell factor (illustrative)' }),
};

// ── Machine assist ──────────────────────────────────────────────────────────────
export const machine = {
  excavationFactor: P(0.4, { note: 'labor factor when machine-excavated (illustrative)' }),
};

// ── Lumber labels (qualitative — BOM line labels) ───────────────────────────────
export const lumber = {
  stringerLabel: 'Overhead stringer',
  sheathingLabel: 'Roof sheathing',
  timberLabel: 'Revetment timber',
  plywoodLabel: 'Revetment plywood',
  picketLabel: 'U-picket',
};
