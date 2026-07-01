// Labor (§8). ILLUSTRATIVE PLACEHOLDER man-hour rates and feature adders. Not
// authoritative — dig productivity varies enormously with soil, tools, fatigue, weather.

import { P } from './types';

export const labor = {
  baseMH: P(4.0, { unit: 'man-hours', note: 'base per-position labor (illustrative)' }),
  perVolMH: P(0.08, { unit: 'man-hours/ft³', note: 'excavation labor per bank ft³ (illustrative)' }),
  overheadAdd: P(3.0, { unit: 'man-hours', note: 'overhead-cover build adder (illustrative)' }),
  revetAdd: P(2.0, { unit: 'man-hours', note: 'revetment build adder (illustrative)' }),
  sumpAdd: P(0.5, { unit: 'man-hours', note: 'grenade-sump adder (illustrative)' }),
  camoAdd: P(0.75, { unit: 'man-hours', note: 'camouflage adder (illustrative)' }),
};
