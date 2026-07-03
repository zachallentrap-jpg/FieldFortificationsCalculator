// Sky dome + fog (diorama engine). The dome REPLACES scene.background: a background color is
// camera-locked and flat, while a real dome parallax-shifts as the user orbits — that motion is
// what sells "diorama sitting in a landscape" instead of "model floating on a color". The look
// is a 1024x512 equirect canvas painted per theme: cheap, fully deterministic, and re-drawable
// on a theme flip without touching any other engine module.
//
// UV-orientation trap (documented because it silently ships upside-down skies): SphereGeometry
// runs its parametric v from 0 at the TOP pole to 1 at the bottom, but pushes uv.y as (1 - v),
// and CanvasTexture flips Y on upload. Net effect: canvas row 0 lands on the TOP pole, the
// canvas bottom on the BOTTOM pole, and eye level (the equator) is the canvas 50% line. So the
// zenith→horizon gradient is painted into the TOP HALF only, and the bottom half is flooded
// with flat horizon color: the horizon band sits exactly at eye level (never overhead), and the
// below-horizon half is a haze apron — mostly hidden by terrain, visible only past the terrain
// edge, where flat distance-haze is exactly the right thing to see. A full sphere was chosen
// over a hemisphere so no orbit angle can ever peek past an open rim into the clear color.

import * as THREE from 'three';
import type { Palette } from './palette';
import { hashJitter } from './shared';

export interface SkyRig {
  dome: THREE.Mesh;
  setTheme(p: Palette): void;
  dispose(): void;
}

// Canvas fraction of the eye-level seam (the sphere's equator) — see the orientation note above.
const SEAM = 0.5;

function paintSky(p: Palette): HTMLCanvasElement {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const seamY = H * SEAM;

  // (a) 3-stop vertical gradient, compressed into the above-horizon half of the canvas so the
  // horizon stop lands at eye level. The stops are pushed DOWN toward the horizon (mid at 30%,
  // horizon color starting at 62%) because the camera looks slightly downward at a tabletop
  // diorama — with the mid stop at 55% every real viewing angle saw only the flat horizon
  // apron and the sky read as an empty studio wall instead of a painted backdrop.
  const g = ctx.createLinearGradient(0, 0, 0, seamY);
  g.addColorStop(0, p.sky.zenith);
  g.addColorStop(0.3, p.sky.mid);
  g.addColorStop(0.62, p.sky.horizon);
  g.addColorStop(1, p.sky.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, seamY);
  // Below-horizon apron: flat horizon color, overlapping one row so texture filtering can't
  // manufacture a crack at the seam.
  ctx.fillStyle = p.sky.horizon;
  ctx.fillRect(0, seamY - 1, W, H - seamY + 1);

  // (b) Horizon haze: a soft white band (~8% of canvas height) straddling the seam rather than
  // sitting only above it — peaking AT eye level hides the gradient/apron junction entirely, so
  // no separate haze mesh is needed. Night keeps a whisper of it (moonlit horizon), not a glow.
  const hazeHalf = H * 0.04;
  const peak = p.sky.stars > 0 ? 0.1 : 0.3;
  const hz = ctx.createLinearGradient(0, seamY - hazeHalf, 0, seamY + hazeHalf);
  hz.addColorStop(0, 'rgba(255,255,255,0)');
  hz.addColorStop(0.5, `rgba(255,255,255,${peak})`);
  hz.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, seamY - hazeHalf, W, hazeHalf * 2);

  // (d) Stars — drawn BEFORE the disc so the moon overdraws any unlucky overlap. Deterministic
  // positions (hashJitter, integer seeds): the same theme must paint the identical sky forever.
  // Confined to the upper 45% of the SKY band (the spec's "top of canvas" rule, rescaled for
  // the half-canvas sky) so none ever sit in the haze. Three brightness tiers, no animation —
  // twinkle would cost a per-frame repaint for a backdrop nobody stares at.
  if (p.sky.stars > 0) {
    // Near-white, near-opaque, 2-3 px: at 40-70% alpha over the dark gradient the dots came out
    // DARKER than the sky after tone mapping and read as sensor noise instead of a starfield.
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < p.sky.stars; i++) {
      const x = Math.floor(hashJitter(i * 7919 + 1) * W);
      const y = Math.floor(hashJitter(i * 104729 + 2) * seamY * 0.45);
      const tier = i % 3;
      ctx.globalAlpha = tier === 0 ? 1 : tier === 1 ? 0.9 : 0.75;
      const sz = tier === 0 ? 3 : 2;
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // (c) Sun/moon disc + single halo ring — two hard toon steps, no blur (bloom belongs to the
  // post pipeline, not the backdrop). Placed from the key-light direction as a HINT, not
  // survey-grade: BackSide rendering mirrors azimuth and the u formula ignores that on purpose —
  // the art requirement is only "visibly up in the sky, roughly toward the light".
  const [sx, sy, sz] = p.light.sunFrom;
  const len = Math.max(Math.hypot(sx, sy, sz), 1e-6);
  const u = Math.atan2(sx, sz) / (Math.PI * 2) + 0.5;
  const elev = Math.asin(Math.max(-1, Math.min(1, sy / len)));
  // Full-sphere equirect: canvas fraction f = 0.5 - elev/PI. Clamped into the upper-sky band —
  // away from the pole pinch (top) and never at the horizon seam, where the haze would cut it.
  const f = Math.min(0.32, Math.max(0.1, 0.5 - elev / Math.PI));
  const cy = f * H;
  // Equirect compresses horizontally toward the pole (a parallel's true length is 2πR·sinθ), so
  // a plain circle would render as a squashed ellipse on the dome — pre-widen by 1/sinθ.
  const stretch = 1 / Math.max(Math.sin(f * Math.PI), 0.2);
  const r = H * 0.03;
  // Triple-draw across the wrap seam so a disc near u=0/1 can't be cut by the canvas edge.
  for (const cx of [u * W - W, u * W, u * W + W]) {
    ctx.fillStyle = p.sky.halo;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.6 * stretch, r * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.sky.disc;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * stretch, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Build the sky dome. The mesh carries no texture until the first setTheme(palette) call — the
 * caller wires theme selection anyway, so buildSky stays palette-agnostic.
 */
export function buildSky(radius: number): SkyRig {
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  // NOTE deliberately NO toneMapped:false: material-level tone-mapping opt-out only works when
  // rendering to the canvas directly — on the composer tiers the whole frame (sky included)
  // passes through OutputPass's ACES anyway, so opting out here would make the sky brighten and
  // shift the moment the quality watchdog demotes high→low. One consistent (ACES-graded) sky
  // on every tier beats an exact-hex sky on one of them. fog:false — see applyFog.
  // depthWrite:false + renderOrder -1000: the dome draws first and can never occlude geometry,
  // whatever its radius relative to the far plane.
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'sky-dome';
  dome.renderOrder = -1000;
  // The camera lives INSIDE this sphere; a bounding-sphere frustum test near the clip planes
  // can reject it at some orbit angles, blanking the whole sky. Never cull it.
  dome.frustumCulled = false;

  return {
    dome,
    setTheme(p: Palette): void {
      const tex = new THREE.CanvasTexture(paintSky(p));
      // The canvas hexes are authored in sRGB; tag the texture so sampling doesn't double-apply
      // the transfer curve and darken the painted sky.
      tex.colorSpace = THREE.SRGBColorSpace;
      // The rig OWNS its texture — never registered in sharedTextures, because a theme flip
      // must free the old GPU upload immediately and the shared skip-list would pin it forever.
      material.map?.dispose();
      material.map = tex;
      // Required when map goes null→texture (USE_MAP recompile); harmless on later flips.
      material.needsUpdate = true;
    },
    dispose(): void {
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
    },
  };
}

/**
 * Barely-there depth cue: fog starts beyond the whole diorama (1.5x its radius) so no built
 * geometry is ever obscured — it only softens the ground apron as it recedes toward the dome.
 * The dome itself opts out via fog:false; fogging the backdrop would flatten the painted
 * gradient into a single fog-colored wall and erase the horizon band.
 */
export function applyFog(scene: THREE.Scene, p: Palette, sceneRadius: number): void {
  scene.fog = new THREE.Fog(p.fog, sceneRadius * 1.5, sceneRadius * 4);
}
