// Diorama art direction as data (§ engine). Two complete looks — a warm late-morning day and
// a moonlit blue-slate night — derived from the art-direction pass: night is a HUE-SHIFTED
// second palette, never just the day rig dimmed (a dark brown scene is neither legible nor
// beautiful). Every engine module reads colors/light numbers from here so the two themes stay
// coherent systems instead of scattered hex literals.
//
// Legibility contract (night especially): sandbags stay the LIGHTEST earthwork so the taught
// geometry survives the dark; hazard red (engineeredCover) and the enemy arrow stay saturated
// in both themes — red is reserved for hazards/orientation, matching the 2D token system.

import type { BoxRole } from '../../render3d/scene3d';

export type Theme3D = 'day' | 'night';

export interface LightRig {
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  sunColor: number;
  sunIntensity: number;
  /** Unit-ish direction the key light shines FROM (scaled by scene size at rig time). */
  sunFrom: [number, number, number];
  ambientIntensity: number;
  rimColor: number;
  rimIntensity: number;
  rimFrom: [number, number, number];
  exposure: number;
  /** Shadow map edge softness input; opacity is shaped by ambient/hemi floor. */
  shadowMapSize: number;
  /**
   * Shadow DARKNESS (three's LightShadow.intensity, 1 = pitch). Diorama shadows are paint,
   * not voids — full-strength shadows crush excavated interiors to black through the toon
   * bands. ~0.5 keeps grounded contact while the pit floor stays readable.
   */
  shadowStrength: number;
}

export interface SkyLook {
  zenith: string;
  mid: string;
  horizon: string;
  /** Flat toon sun/moon disc + single halo ring. */
  disc: string;
  halo: string;
  /** Star count (0 for day). */
  stars: number;
  starColor: string;
}

export interface Palette {
  role: Record<BoxRole, number>;
  grass: { base: string; dark: string; light: string; dry: string };
  wornRing: string;
  spoilFleck: string;
  strata: { base: string; lines: [string, string] };
  rock: number;
  tuft: [number, number];
  sky: SkyLook;
  fog: number;
  figure: { torso: number; legs: number; skin: number; blaze: number };
  /** Per-bag value jitter half-range (multiplier deviation, e.g. 0.06 ⇒ ±6%). */
  bagJitter: number;
  /** Terrain scatter density multipliers — rocky soils grow rocks, sand loses grass. */
  scatterMul: { tuft: number; rock: number };
  light: LightRig;
}

const DAY: Palette = {
  role: {
    ground: 0x86a05c,
    parapet: 0xc9b183,
    bayWall: 0x8a6a48,
    bayFloor: 0x6f573c,
    cover: 0xb39c72,
    engineeredCover: 0xff5a4d, // hazard accent — untouched in both themes
    stringer: 0x6b5138,
    platform: 0x6b5138,
    firingStep: 0x6b5138,
    sump: 0x241b12,
    camoNet: 0x55694a,
    rampBerm: 0xbfa87c,
  },
  grass: { base: '#86A05C', dark: '#6E8A4C', light: '#9AB36E', dry: '#A39A66' },
  wornRing: '#9A7B50',
  spoilFleck: '#C9B183',
  // Lifted from the original #4A3626 family: the block sides face away from the key light and
  // live off hemisphere/ambient alone — authored too dark they crushed to featureless black
  // (audit: "no strata banding visible on any base side").
  strata: { base: '#6B4E35', lines: ['#7E5F42', '#523A28'] },
  rock: 0x8d857a,
  tuft: [0x6e8a4c, 0x9ab36e],
  sky: { zenith: '#9FC8E8', mid: '#C6E0F0', horizon: '#EFE9D6', disc: '#FFF7E0', halo: '#FFE9B8', stars: 0, starColor: '#ffffff' },
  fog: 0xe3decb,
  figure: { torso: 0x6b7250, legs: 0x4e5442, skin: 0xd9a87c, blaze: 0xe8722d },
  bagJitter: 0.06,
  scatterMul: { tuft: 1, rock: 1 },
  light: {
    hemiSky: 0xdcebfa,
    hemiGround: 0x8a7350,
    hemiIntensity: 0.45,
    sunColor: 0xfff2dc,
    sunIntensity: 1.15,
    // From front-high-right of the enemy side, so the frontal parapet throws its shadow back
    // INTO the fighting bay and the bay's interior wall catches light — the shadow teaches.
    sunFrom: [0.38, 0.8, -0.55],
    // Floor high enough that pit floors/strata sides never crush to black — re-raised after
    // the thin-crust rework: deep excavation shells (the vehicle cuts especially) get NO
    // direct key at their far walls, so ambient is the only thing telling their story.
    ambientIntensity: 0.26,
    rimColor: 0xcfe0f0,
    rimIntensity: 0.25,
    rimFrom: [-0.7, 0.35, 0.65],
    exposure: 1.0,
    shadowMapSize: 2048,
    shadowStrength: 0.5,
  },
};

const NIGHT: Palette = {
  // Night values sit a full step LIGHTER than a naive "dark theme": the moon rig + ACES land
  // these roughly where the day palette's shadows live, and the audit's night set showed the
  // original values crushing the whole terrain layer to illegible black. Sandbags stay the
  // lightest earthwork by a wide margin — that's the legibility contract.
  role: {
    ground: 0x54645a,
    parapet: 0x9a9284, // lightest earthwork — legibility floor
    bayWall: 0x6e6456,
    bayFloor: 0x564c3e,
    cover: 0x8a8272,
    engineeredCover: 0xff6a55, // hazard accent, slightly lifted for the dark
    stringer: 0x52493c,
    platform: 0x52493c,
    firingStep: 0x52493c,
    sump: 0x241c12,
    camoNet: 0x46554a,
    rampBerm: 0x8a8272,
  },
  grass: { base: '#54645A', dark: '#46544C', light: '#66786A', dry: '#5E5B4A' },
  wornRing: '#75665A',
  spoilFleck: '#9A9284',
  strata: { base: '#4A3A2C', lines: ['#5A4836', '#382B20'] },
  rock: 0x6a6a70,
  tuft: [0x46544c, 0x66786a],
  sky: { zenith: '#0B1322', mid: '#16233A', horizon: '#2E405A', disc: '#E8F0F8', halo: '#B9CCE0', stars: 40, starColor: '#cdd8e8' },
  fog: 0x1c2838,
  figure: { torso: 0x4e5442, legs: 0x33372c, skin: 0x9a7f63, blaze: 0xd96a35 },
  bagJitter: 0.05,
  scatterMul: { tuft: 1, rock: 1 },
  light: {
    // Night runs a HIGHER proportional floor than day — the palette colors already carry the
    // darkness (hue-shifted blue-slate values), so the rig's job is legibility, not gloom.
    // With sRGB-tagged maps these values land the sandbags clearly readable against the dirt.
    hemiSky: 0x33415a,
    hemiGround: 0x1f1a14,
    hemiIntensity: 0.9,
    sunColor: 0xcfe0f2, // the moon
    sunIntensity: 0.85,
    sunFrom: [-0.45, 0.95, 0.35], // high and steep — long murky shadows would eat legibility
    ambientIntensity: 0.62,
    rimColor: 0xffb37a, // UI amber, as if a red-lens light is near the position
    rimIntensity: 0.2,
    rimFrom: [0.7, 0.25, 0.6],
    exposure: 0.95,
    shadowMapSize: 2048,
    shadowStrength: 0.55,
  },
};

export function palette(theme: Theme3D): Palette {
  return theme === 'night' ? NIGHT : DAY;
}

// ── Soil looks (§ honest materials) ─────────────────────────────────────────
// The soil input already drives dig labor and wall slope — the terrain must LOOK like the
// soil picked, or the model contradicts its own numbers. Each look overrides only the
// earth-derived fields (grass/ring/strata/excavated tints/scatter); sandbags, lights, sky,
// figure never vary with soil. Loam is the baseline — no entry, base palette as-is.
interface SoilLook {
  grass: Palette['grass'];
  wornRing: string;
  spoilFleck: string;
  strata: Palette['strata'];
  bayWall: number;
  bayFloor: number;
  rampBerm: number;
  ground: number; // low-tier flat-ground fallback tint
  scatterMul: { tuft: number; rock: number };
}

const SOIL_DAY: Record<string, SoilLook> = {
  sand: {
    grass: { base: '#B0A470', dark: '#988D5E', light: '#C4B87F', dry: '#CDBB85' },
    wornRing: '#C2A468',
    spoilFleck: '#E2CE9A',
    strata: { base: '#C9AE7A', lines: ['#D9C18E', '#B29767'] },
    bayWall: 0xc2a878, bayFloor: 0xa8905f, rampBerm: 0xd6c190, ground: 0xb0a470,
    scatterMul: { tuft: 0.4, rock: 0.6 },
  },
  sandy_loam: {
    grass: { base: '#95A363', dark: '#7C8B51', light: '#AAB675', dry: '#B3A76E' },
    wornRing: '#AC8D5C',
    spoilFleck: '#D3BC88',
    strata: { base: '#8A6B45', lines: ['#9C7E55', '#715636'] },
    bayWall: 0x9e8054, bayFloor: 0x846a45, rampBerm: 0xc4ab7c, ground: 0x95a363,
    scatterMul: { tuft: 0.75, rock: 0.8 },
  },
  silt: {
    grass: { base: '#7F9A5E', dark: '#68824C', light: '#93AC70', dry: '#9C9670' },
    wornRing: '#8C7658',
    spoilFleck: '#B5A182',
    strata: { base: '#75604C', lines: ['#877260', '#5D4A38'] },
    bayWall: 0x7e6a52, bayFloor: 0x665442, rampBerm: 0xa6947a, ground: 0x7f9a5e,
    scatterMul: { tuft: 1, rock: 0.7 },
  },
  clay: {
    grass: { base: '#7E9C58', dark: '#688348', light: '#92AF6B', dry: '#A98E62' },
    wornRing: '#A06B48',
    spoilFleck: '#C09070',
    strata: { base: '#8A5638', lines: ['#9E6746', '#70432A'] },
    bayWall: 0x93643f, bayFloor: 0x7a5030, rampBerm: 0xb08258, ground: 0x7e9c58,
    scatterMul: { tuft: 1, rock: 0.8 },
  },
  gravel: {
    grass: { base: '#83985F', dark: '#6C7F4E', light: '#97A972', dry: '#9B9478' },
    wornRing: '#877A68',
    spoilFleck: '#A99E8C',
    strata: { base: '#7A7062', lines: ['#8D8375', '#5E5548'] },
    bayWall: 0x7e7466, bayFloor: 0x685f52, rampBerm: 0x9a9080, ground: 0x83985f,
    scatterMul: { tuft: 0.6, rock: 2.2 },
  },
  rock: {
    grass: { base: '#7C9060', dark: '#66784E', light: '#8FA272', dry: '#8E8C74' },
    wornRing: '#7D746A',
    spoilFleck: '#9C968E',
    strata: { base: '#6E6E74', lines: ['#808088', '#535358'] },
    bayWall: 0x70707a, bayFloor: 0x5c5c64, rampBerm: 0x8c8c94, ground: 0x7c9060,
    scatterMul: { tuft: 0.35, rock: 3 },
  },
  frozen: {
    grass: { base: '#9FB0A4', dark: '#87988C', light: '#C2CFC6', dry: '#D8E2DC' },
    wornRing: '#9B9284',
    spoilFleck: '#D9DFDB',
    strata: { base: '#7A7268', lines: ['#9AA0A2', '#5C564E'] },
    bayWall: 0x8a8478, bayFloor: 0x716b60, rampBerm: 0xb8bfba, ground: 0x9fb0a4,
    scatterMul: { tuft: 0.3, rock: 1.4 },
  },
};

// Night variants are derived, not hand-authored per soil: darken toward the night rig's
// blue-slate ambience while keeping each soil's hue signature. Loam stays the hand-tuned
// base NIGHT palette (no derivation), so the audited night look never drifts.
function nightHex(day: number): number {
  const r = (day >> 16) & 0xff, g = (day >> 8) & 0xff, b = day & 0xff;
  // 0.5/0.2 calibrated against the hand-tuned loam night values (day grass #86A05C should land
  // near night grass #54645A) so derived soils sit at the same audited legibility floor.
  const mix = (c: number, t: number): number => Math.round(c * 0.5 + t * 0.2);
  return (mix(r, 0x46) << 16) | (mix(g, 0x54) << 8) | mix(b, 0x5e);
}
function nightCss(day: string): string {
  return '#' + nightHex(parseInt(day.slice(1), 16)).toString(16).padStart(6, '0');
}
function nightLook(d: SoilLook): SoilLook {
  return {
    grass: { base: nightCss(d.grass.base), dark: nightCss(d.grass.dark), light: nightCss(d.grass.light), dry: nightCss(d.grass.dry) },
    wornRing: nightCss(d.wornRing),
    spoilFleck: nightCss(d.spoilFleck),
    strata: { base: nightCss(d.strata.base), lines: [nightCss(d.strata.lines[0]), nightCss(d.strata.lines[1])] },
    bayWall: nightHex(d.bayWall), bayFloor: nightHex(d.bayFloor), rampBerm: nightHex(d.rampBerm), ground: nightHex(d.ground),
    scatterMul: d.scatterMul,
  };
}

/**
 * The theme palette with the picked soil's look folded in. Unknown soil ids (and loam, the
 * baseline) return the base palette untouched — the engine can never break on a new soil row,
 * it just renders it as loam until a look is authored.
 */
export function paletteFor(theme: Theme3D, soil: string): Palette {
  const base = palette(theme);
  const day = SOIL_DAY[soil];
  if (!day) return base;
  const look = theme === 'night' ? nightLook(day) : day;
  return {
    ...base,
    role: { ...base.role, bayWall: look.bayWall, bayFloor: look.bayFloor, rampBerm: look.rampBerm, ground: look.ground },
    grass: look.grass,
    wornRing: look.wornRing,
    spoilFleck: look.spoilFleck,
    strata: look.strata,
    scatterMul: look.scatterMul,
  };
}
