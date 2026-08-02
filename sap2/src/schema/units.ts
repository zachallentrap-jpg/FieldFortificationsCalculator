// One canonical unit per leaf; storage and engine are always canonical (§2.3).
// Pub tables printing other units (inches, meters) are handled at entry time by the
// Fill Station's conversion mode — batch metadata, never a second stored unit (F4b).

export const CANONICAL_UNITS = [
  'ft',        // lengths, thicknesses, depths
  'ft2',       // areas
  'ft3',       // volumes
  'ea',        // counts (sandbags, stringers, sumps, crew)
  'man_hours', // labor content
  'machine_hours', // blade/excavator time
  'hours',     // elapsed durations
  'ratio',     // dimensionless shares/factors (0..1 splits, swell, drape)
  'ft3_per_man_hour',     // hand dig rates (divisors)
  'ft3_per_machine_hour', // machine dig rates (divisors)
  'lb',        // weights
  'text',      // owner-authored check / body-unit phrases (B35) — validated, never computed on
  'flag',      // doctrinal booleans (e.g. soil forces revetment) — stored as true/false
] as const;
export type CanonicalUnit = (typeof CANONICAL_UNITS)[number];

export type NumericUnit = Exclude<CanonicalUnit, 'text' | 'flag'>;

// Compile-time dimension algebra for the trace ops (§4.3): product/div derive result
// units, so `area × depth` types as ft3 and a ft×ft3 product is a compile error.
// 'ratio' is the multiplicative identity.
export type UnitMul = {
  ft:   { ft: 'ft2'; ft2: 'ft3'; ratio: 'ft' };
  ft2:  { ft: 'ft3'; ratio: 'ft2' };
  ft3:  { ratio: 'ft3' };
  ratio: { ft: 'ft'; ft2: 'ft2'; ft3: 'ft3'; ratio: 'ratio'; man_hours: 'man_hours'; hours: 'hours'; ea: 'ea'; lb: 'lb' };
  ea:   { ratio: 'ea'; lb: 'lb' };            // count × per-item-weight → weight
  man_hours: { ratio: 'man_hours' };
  machine_hours: { ratio: 'machine_hours' };
  hours: { ratio: 'hours' };
  lb:   { ratio: 'lb' };
  ft3_per_man_hour: Record<string, never>;    // divisors divide; they never multiply
  ft3_per_machine_hour: Record<string, never>;
};

export type UnitDiv = {
  ft3:  { ft3_per_man_hour: 'man_hours'; ft3_per_machine_hour: 'machine_hours'; ft: 'ft2'; ft2: 'ft'; ratio: 'ft3'; ft3: 'ratio' };
  ft2:  { ft: 'ft'; ratio: 'ft2'; ft2: 'ratio' };
  ft:   { ratio: 'ft'; ft: 'ratio' };
  man_hours: { ratio: 'man_hours'; hours: 'ratio'; man_hours: 'ratio'; ea: 'man_hours' }; // man-hours ÷ crew count → per-man share stays man_hours
  machine_hours: { ratio: 'machine_hours'; machine_hours: 'ratio' };
  hours: { ratio: 'hours'; hours: 'ratio' };
  ea:   { ratio: 'ea'; ea: 'ratio' };
  lb:   { ratio: 'lb'; lb: 'ratio'; ea: 'lb' };
  ratio: { ratio: 'ratio' };
  ft3_per_man_hour: Record<string, never>;
  ft3_per_machine_hour: Record<string, never>;
};

export type Mul<A extends NumericUnit, B extends NumericUnit> =
  A extends keyof UnitMul ? B extends keyof UnitMul[A] ? UnitMul[A][B] & NumericUnit : never : never;
export type Div<A extends NumericUnit, B extends NumericUnit> =
  A extends keyof UnitDiv ? B extends keyof UnitDiv[A] ? UnitDiv[A][B] & NumericUnit : never : never;
