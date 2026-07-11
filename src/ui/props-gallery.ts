// Dev-only asset gallery (see props.html) — shows every prop and assembly EXACTLY as the app
// renders it, by reusing three-viewer's own builders (buildPropShowcase): same GLB templates,
// textures, tiling, jitter, and outlines. Judge prop quality here, in isolation, without hunting
// for a camera angle inside a full position model. Not imported by the app, not built.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPropShowcase, onPropAssetsReady, disposeObject, toonGradient } from './three-viewer';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ec);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
camera.position.set(0, 12, 42);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);

// Sized on load AND on every resize — the page can load in a zero-width headless viewport.
function fitViewport(): void {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight - 40);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
fitViewport();
window.addEventListener('resize', fitViewport);

// Same lighting rig as the app's viewer so materials read identically.
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a3a22, 1.1), new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(12, 20, 8);
scene.add(sun);

// A soft ground strip (the app's grass tone, muted) so assemblies sit on something.
const ground = new THREE.Mesh(
  new THREE.BoxGeometry(64, 0.05, 12),
  new THREE.MeshToonMaterial({ color: 0x9dbd80, gradientMap: toonGradient() }),
);
ground.position.y = -0.05;
scene.add(ground);

function labelSprite(text: string, x: number): THREE.Sprite {
  const lc = document.createElement('canvas');
  lc.width = 256;
  lc.height = 48;
  const ctx = lc.getContext('2d')!;
  ctx.fillStyle = '#333';
  ctx.font = '24px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 32);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(lc), transparent: true }));
  sprite.scale.set(3.4, 0.64, 1);
  sprite.position.set(x, 0.35, 6.6); // just past the ground strip's front edge, never occluded
  return sprite;
}

const group = new THREE.Group();
const labels = new THREE.Group();
scene.add(group, labels);

function rebuild(): void {
  disposeObject(group);
  group.clear();
  disposeObject(labels);
  labels.clear();
  for (const item of buildPropShowcase(group)) labels.add(labelSprite(item.label, item.x));
}
rebuild();
// Rebuild once the async GLB templates land, exactly like the app's viewers do.
onPropAssetsReady(rebuild);

// Dev inspection handle: lets tooling frame the camera on one plot for close-up review.
(window as unknown as Record<string, unknown>).__gallery = { camera, controls, scene, group };

function loop(): void {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}
loop();
