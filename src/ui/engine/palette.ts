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
  light: {
    hemiSky: 0xdcebfa,
    hemiGround: 0x8a7350,
    hemiIntensity: 0.45,
    sunColor: 0xfff2dc,
    sunIntensity: 1.15,
    // From front-high-right of the enemy side, so the frontal parapet throws its shadow back
    // INTO the fighting bay and the bay's interior wall catches light — the shadow teaches.
    sunFrom: [0.38, 0.8, -0.55],
    ambientIntensity: 0.2, // floor high enough that pit floors/strata sides never crush to black
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
    ambientIntensity: 0.55,
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
