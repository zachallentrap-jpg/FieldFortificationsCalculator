// Post-processing pipeline (§ engine) — the "toy diorama" finishing pass: a subtle tilt-shift
// blur (miniature photography cue), a gentle grade (slight desaturation + contrast + vignette),
// and ACES tone mapping. Everything here is COSMETIC and tiered: the scene must read identically
// in composition on a machine that can only afford tier 'low' (plain renderer.render), it just
// loses the finish. That is why the tilt-shift numbers stay timid — max a few CSS pixels of blur
// — and why both tilt passes switch off entirely on short canvases, where the blur band would
// land on dimension labels and smear them.
//
// three@0.185 notes that shaped this file:
// - EffectComposer does NOT enable MSAA on its auto-created target, so we hand it a custom
//   WebGLRenderTarget with `samples` set — without it every composer tier would lose the
//   antialiasing the direct-render path gets for free from the canvas.
// - OutputPass reads renderer.toneMapping / toneMappingExposure every frame, so setting ACES
//   once on the renderer serves both the composer tiers and the composer-less 'low' tier; theme
//   exposure changes are just renderer.toneMappingExposure writes (setTheme), no rebuild.
// - Material clipping planes (the cutaway) are applied inside RenderPass's normal scene render;
//   the composer never touches renderer.localClippingEnabled. Screenshots keep working because
//   the final enabled pass draws to the default framebuffer (renderToScreen) and we never fiddle
//   with renderer.autoClear.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';
import type { Palette } from './palette';

export type Tier = 'high' | 'medium' | 'low';

// Focus band center as a fraction from the canvas bottom. 0.55 keeps the earthwork (which the
// camera frames slightly below center) tack sharp while the far ground plane and sky soften.
const TILT_FOCUS = 0.55;
// Blur step at pixelRatio 1 — the shader treats h/v as a per-sample UV offset, so this works out
// to ~2-3 CSS px of max blur at the frame edges. Deliberately below the "obviously blurred"
// threshold; the miniature cue should be felt, not seen.
const TILT_STRENGTH = 1 / 420;
// Below this CSS height the focus band is too thin to spare the labels — turn tilt-shift off.
const TILT_MIN_HEIGHT = 480;

// Grade runs BEFORE OutputPass, i.e. in linear HDR space. That is intentional: vignetting linear
// light darkens like a real lens instead of crushing already-tone-mapped color, and the contrast
// nudge stays gentle because ACES adds its own shoulder afterwards.
const GradeShader = {
  name: 'DioramaGradeShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    satMul: { value: 0.9 },
    contrast: { value: 1.05 },
    vigStrength: { value: 0.18 },
    vigMid: { value: 0.7 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float satMul;
    uniform float contrast;
    uniform float vigStrength;
    uniform float vigMid;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );
      float luma = dot( texel.rgb, vec3( 0.299, 0.587, 0.114 ) );
      vec3 rgb = mix( vec3( luma ), texel.rgb, satMul );
      rgb = ( rgb - 0.5 ) * contrast + 0.5;
      // 1.42 ≈ the uv-space corner distance, so the vignette only ever fully lands in the
      // extreme corners and the smoothstep ramp stays invisible mid-frame.
      float vig = 1.0 - vigStrength * smoothstep( vigMid, 1.42, length( vUv - 0.5 ) * 2.0 );
      gl_FragColor = vec4( rgb * vig, 1.0 );
    }`,
};

// Tier heuristic, run once at viewer boot (the viewer can still demote later via setTier when
// measured FPS tanks — this is only the starting guess). Every navigator/screen touch is guarded
// because tests run under a DOM shim where these globals are partial or absent.
export function detectTier(): Tier {
  let hasWebGL2 = false;
  try {
    hasWebGL2 = typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2');
  } catch {
    hasWebGL2 = false;
  }
  if (!hasWebGL2) return 'low';

  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
  const touchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0;
  // Missing `screen` (tests) must not read as "small screen" — default to a desktop-sized value.
  const minScreen =
    typeof screen !== 'undefined' && screen.width && screen.height
      ? Math.min(screen.width, screen.height)
      : Number.POSITIVE_INFINITY;
  // Few cores, or a touch device that is phone/small-tablet sized: skip the double-blur passes.
  if (cores <= 4 || (touchPoints > 0 && minScreen < 820)) return 'medium';
  return 'high';
}

export interface Pipeline {
  render(): void;
  setSize(w: number, h: number, pixelRatio: number): void;
  setTheme(p: Palette): void;
  setTier(t: Tier): void;
  readonly tier: Tier;
  dispose(): void;
}

// noUncheckedIndexedAccess: ShaderPass.uniforms is an index signature, so poke values through a
// guard rather than sprinkling non-null assertions.
function setUniform(pass: ShaderPass, name: string, value: number): void {
  const u = pass.uniforms[name];
  if (u) u.value = value;
}

export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialTier: Tier,
): Pipeline {
  // Set once; exposure per theme arrives via setTheme. The sky dome opts out of tone mapping on
  // its own material (toneMapped:false) so its authored gradient colors stay exact.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  let tier: Tier = initialTier;
  let composer: EffectComposer | null = null;
  let tiltH: ShaderPass | null = null;
  let tiltV: ShaderPass | null = null;
  let grade: ShaderPass | null = null;
  // Composer starts on a 1x1 target; real dimensions arrive via setSize. Remembered here so a
  // setTier rebuild can re-apply them without the caller resizing again.
  let lastW = 1;
  let lastH = 1;
  let lastPr = 1;
  let vigStrength = 0.18;

  function applySize(): void {
    if (!composer) return;
    composer.setPixelRatio(lastPr);
    composer.setSize(lastW, lastH);
    if (tiltH && tiltV) {
      // h/v are UV offsets sampled in device pixels — divide by pixelRatio so the blur width
      // stays constant in CSS pixels instead of doubling on retina displays.
      const strength = TILT_STRENGTH / lastPr;
      setUniform(tiltH, 'h', strength);
      setUniform(tiltV, 'v', strength);
      const on = lastH >= TILT_MIN_HEIGHT;
      tiltH.enabled = on;
      tiltV.enabled = on;
    }
  }

  function teardown(): void {
    if (!composer) return;
    // composer.dispose() only frees its own targets + internal copy pass — added passes are the
    // caller's problem (RenderPass has a no-op base dispose; the shader passes free materials).
    for (const pass of composer.passes) pass.dispose?.();
    composer.dispose();
    composer = null;
    tiltH = null;
    tiltV = null;
    grade = null;
  }

  function build(): void {
    if (tier === 'low') return; // direct renderer.render — nothing to build

    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: tier === 'high' ? 4 : 2,
    });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));

    if (tier === 'high') {
      tiltH = new ShaderPass(HorizontalTiltShiftShader);
      tiltV = new ShaderPass(VerticalTiltShiftShader);
      setUniform(tiltH, 'r', TILT_FOCUS);
      setUniform(tiltV, 'r', TILT_FOCUS);
      composer.addPass(tiltH);
      composer.addPass(tiltV);
    }

    grade = new ShaderPass(GradeShader);
    setUniform(grade, 'vigStrength', vigStrength);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    applySize();
  }

  build();

  return {
    get tier(): Tier {
      return tier;
    },
    render(): void {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    setSize(w: number, h: number, pixelRatio: number): void {
      lastW = w;
      lastH = h;
      lastPr = pixelRatio;
      applySize();
    },
    setTheme(p: Palette): void {
      renderer.toneMappingExposure = p.light.exposure;
      // Night leans on a heavier vignette to sell the darkness without losing the earthwork;
      // exposure < 1 is the palette's own "this is the dark theme" signal.
      vigStrength = p.light.exposure < 1.0 ? 0.25 : 0.18;
      if (grade) setUniform(grade, 'vigStrength', vigStrength);
    },
    setTier(t: Tier): void {
      if (t === tier) return;
      teardown();
      tier = t;
      build(); // re-applies last size; theme exposure lives on the renderer and survives
    },
    dispose(): void {
      teardown();
    },
  };
}
