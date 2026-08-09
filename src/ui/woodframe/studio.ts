// TIMBER-2 — the workbench (plan §4.1, §5.3).
//
// One scene, driven entirely by a `StructureModel`. Every mesh carries the id of the Member it
// projects, so selection, the cut list, the layout strips and the 3D view are the same data
// seen four ways — the invariant (I-3) that keeps the drawing and the bill from disagreeing.
//
// Two implementation notes that are load-bearing rather than incidental:
//
//   Stage scrubbing toggles VISIBILITY, never rebuild. A full dispose/rebuild on every scrub
//   step is what makes a stage slider feel broken on a tablet; visibility is a flag flip.
//
//   Cutaway is a renderer clip plane driven by `cutPlaneEq`, and the raycaster filters hits
//   with `passesCut` from that SAME equation, so clicking through a cut selects what you see.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { lumberPiece, cutLumberPiece, plywoodSheet, roofingSheet, screenSheet, disposeObject, toonGradient } from '../three-viewer';
import type { LumberSize } from '../three-viewer';
import type { Member } from '../../timber/types';
import type { StructureModel } from '../../timber/families/index';
import { bomSummary } from '../../timber/bom';
import { fastenerTakeoff, sheetTakeoff } from '../../timber/fasteners';
import { FEATURES } from './mode';
import { COVER_DEPTH_NOTE } from '../../timber/doctrine';
import { plainName, whatItDoes } from './labels';
import {
  planeForState, initialCutawayState, toggleAxis, setDepth, passesCut, CUT_AXES, axisById,
  type CutawayState, type Aabb,
} from './cutaway';
import { cameraRigsFor, memberAabb, type CameraRig } from './camera';
import { roofingTiling } from './tiling';
import { seatCutsFor, seatProfile, type SeatCut } from '../../timber/birdsMouth';
import { stringerEndProfile, stairStringerProfile, ridgeHeadProfile, levelFootProfile } from '../../timber/stringerCuts';
import { riserLidOf, seatOpeningsFor, seatOpeningPath } from '../../timber/riserSeats';
import { fmtFtIn } from '../../timber/units';

export interface StudioHandles {
  setModel(model: StructureModel): void;
  dispose(): void;
  /** For tests and the boot file — the live state, read-only. */
  debug(): { stage: number; cut: CutawayState; selected: string | null; meshCount: number };
}

const CONCRETE = 0xa9a69f;
// Every tint MULTIPLIES the material's own color, so these read as a wash over the real
// material rather than as flat paint — the plywood still shows its grain and the corrugated
// roofing still shows its ribs, they just go red. That matters: the point of highlighting is to
// say WHICH piece, not to hide what the piece is made of. Red is chosen over the old orange
// because tan lumber under an orange wash is still tan lumber.
const SELECT_TINT = 0xd2402a;
const HOVER_TINT = 0xffa06a;
const STAGE_TINT = 0xffe9b0;

function propFor(nominal: string): LumberSize {
  if (nominal === '2x4' || nominal === '2x6' || nominal === '4x4') return nominal;
  if (nominal.startsWith('1x') || nominal.startsWith('2x2')) return '2x4';
  return nominal.startsWith('2x') ? '2x6' : '4x4';
}

/**
 * Carpenter-readable feet-inches: 92.625" → 7'-8 5/8". Re-exported rather than defined here so
 * the trainer, which runs under `node --test`, can format a length without importing the DOM.
 */
export { fmtFtIn };

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface StudioDom {
  viewport: HTMLElement;
  views: HTMLElement;
  stages: HTMLElement;
  stageName: HTMLElement;
  cutAxes: HTMLElement;
  cutDepthRow: HTMLElement;
  memberCard: HTMLElement;
  stagePanel: HTMLElement;
}

export function createStudio(dom: StudioDom, initial: StructureModel): StudioHandles {
  let model = initial;
  let stage = Number.MAX_SAFE_INTEGER; // "All" until the user scrubs
  let selected: string | null = null;
  let hovered: string | null = null;
  let cut: CutawayState = initialCutawayState();

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.localClippingEnabled = true; // gates every material's clippingPlanes at once
  dom.viewport.appendChild(renderer.domElement);

  // The canvas follows the system appearance. A white sky and a bright green field sitting in a
  // dark window is the loudest possible tell that the 3D is a foreign object bolted into the
  // app rather than part of it — so the stage is neutral in both, and the timber stays the only
  // saturated thing in the frame.
  const darkAppearance = window.matchMedia('(prefers-color-scheme: dark)');
  const sceneColors = () => (darkAppearance.matches
    ? { sky: 0x1c1c1e, grid: 0x3a3a3d, gridAxis: 0x55555a, bounce: 0x14161a, ambient: 0.30 }
    : { sky: 0xf2f2f5, grid: 0xc9c9ce, gridAxis: 0xa8a8b0, bounce: 0x4a3a22, ambient: 0.26 });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneColors().sky);
  // Sum of intensities matters more than any one of them: hemi 1.1 + ambient 0.55 + sun 1.0 put
  // every surface at the top band of the toon ramp, so a roof plane, a wall, and a gable end all
  // came out the same value and the building read as one beige mass with no form. The sun now
  // carries most of the light and the fills only keep the shaded sides off black, which is what
  // makes the two roof planes, the eave, and the wall separate at a glance.
  const hemi = new THREE.HemisphereLight(0xffffff, sceneColors().bounce, 0.42);
  const ambient = new THREE.AmbientLight(0xffffff, sceneColors().ambient);
  scene.add(hemi, ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(12, 20, 8);
  scene.add(sun);
  // GROUND BOUNCE, and it is not decoration. With one sun overhead every downward-facing
  // surface sat in the bottom band of the toon ramp — which was invisible but harmless while a
  // solid ground slab meant nobody could get under the building. Now that the orbit goes all
  // the way beneath, the underside is a view people will actually use, and unlit it comes back
  // as one black mass with the framing lost inside it. This light points UP, so it reaches
  // only the faces the sun cannot and leaves every lit surface exactly as tuned above.
  const bounceUp = new THREE.DirectionalLight(0xffffff, 0.62);
  bounceUp.position.set(-9, -16, -7);
  scene.add(bounceUp);
  darkAppearance.addEventListener('change', () => {
    const s = sceneColors();
    scene.background = new THREE.Color(s.sky);
    hemi.groundColor.setHex(s.bounce);
    ambient.intensity = s.ambient;
    // The grid bakes its two colors into vertex colors, so it is remade rather than recolored.
    if (ground) {
      scene.remove(ground);
      (ground as THREE.GridHelper).dispose();
      ground = makeGrade();
      scene.add(ground);
    }
    // The render loop is continuous, so the next frame picks this up on its own.
  });
  // Warm fill from inside, so a cut face is lit rather than a black hole.
  const sectionFill = new THREE.PointLight(0xffe9c8, 0.0, 120);
  scene.add(sectionFill);

  const persp = new THREE.PerspectiveCamera(40, 1, 0.1, 800);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
  let camera: THREE.Camera = persp;
  /**
   * One place configures every OrbitControls this studio ever makes (the rig switch between
   * perspective and orthographic disposes and recreates them, so settings applied only at boot
   * silently vanished on the first Plan-view click).
   *
   * THE ORBIT IS A FULL SPHERE, on purpose. It used to stop at grade — there was a solid ground
   * slab and a floor on the camera's own height, because dropping below it filled the screen
   * with a grey underside and the building vanished. The slab is gone (see `rebuild`), so
   * "below grade" is now the most useful angle in the tool rather than a dead end: it is the
   * only way to look up at what a floor is built from, how a pier deck is carried, what a
   * bunker's overhead stringers land on, or how deep a basement actually goes.
   */
  const tuneControls = (c: OrbitControls): OrbitControls => {
    c.enableDamping = true;
    return c;
  };
  let controls = tuneControls(new OrbitControls(persp, renderer.domElement));

  const group = new THREE.Group();
  scene.add(group);
  /**
   * GRADE IS A GRID, NOT A FLOOR. This used to be a solid slab three footprints wide, and it
   * did exactly what a floor does: it hid everything under it. The pier posts a building stands
   * on, the joists and bridging over them, the underside of a deck, a bunker's overhead
   * stringers, how far a basement really drops — all of it was on the far side of an opaque
   * surface, and the orbit was clamped above that surface precisely because dropping below it
   * showed nothing but grey.
   *
   * A line grid carries everything the slab was actually for — where grade is, which way is
   * down, and a 4-ft module to read size against — while occluding nothing. Look up from
   * underneath and the whole structure is there, with the grid drawn across it like a
   * survey line rather than a lid.
   */
  const GRID_MODULE_FT = 4; // one plywood module, so the squares are a ruler and not decoration
  // Seen from above, grade is a datum and reads at full strength. Seen from BELOW it is between
  // the eye and the framing — a mesh of lines laid over the very thing you dropped down there to
  // look at — so it fades back to a hint that still says where grade is without veiling anything.
  const GRID_OPACITY = 0.55;
  const GRID_OPACITY_UNDER = 0.14;
  let ground: THREE.Object3D | null = null;
  const byId = new Map<string, THREE.Group>();
  const clipPlanes: THREE.Plane[] = [];

  let rigs: CameraRig[] = [];
  let activeRig = 'iso-se';

  // ── Scene construction ─────────────────────────────────────────────────────

  /**
   * Every rafter's bird's-mouth, recomputed with the model. Derived, never stored: the notch is a
   * consequence of where the engine put the rafter and the plate, so nothing upstream has to know
   * the viewer draws it and no golden moves when it changes.
   */
  let seats = new Map<string, SeatCut[]>();
  /**
   * The latrine lid's seat openings, and the id of the lid they belong to. Derived with the
   * model for the same reason the notch is: the holes are a consequence of where the engine put
   * the lid and its dividers, so nothing upstream has to know the viewer punches them.
   */
  let riserLidId: string | null = null;
  let riserHoles: [number, number][][] = [];

  function buildMemberMesh(m: Member): THREE.Group {
    let p: THREE.Group;
    const seat = seats.get(m.id);
    if (m.nominal.includes('conc') || m.role === 'slab' || m.role === 'footing' || m.role === 'foundationWall') {
      p = new THREE.Group();
      const geo = new THREE.BoxGeometry(
        Math.max(0.05, m.cutLength / 12),
        Math.max(0.05, m.actual.d / 12),
        Math.max(0.05, m.actual.w / 12),
      );
      p.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: CONCRETE, gradientMap: toonGradient() })));
      group.add(p);
    } else if (m.role === 'roofingCourse' || m.role === 'ridgeCap') {
      // Roll goods vs. corrugated metal — two different materials, told apart by the nominal the
      // engine already wrote. The tile counts keep the granule/rib scale constant on any piece,
      // and they are RATIOS: see `tiling.ts` for what rounding them to whole tiles did.
      const t = roofingTiling(m);
      p = roofingSheet(group, t.kind, t.along, t.across);
      p.scale.set(m.cutLength / 12, m.actual.d / 12, Math.max(0.02, m.actual.w / 12));
    } else if (m.role === 'soilGhost') {
      // MASSING, not material. Translucent and unlit so it can never be mistaken for something
      // that was built, and its member card carries the boundary sentence as its doctrine ref.
      p = new THREE.Group();
      // (len, d, w) — the same mapping every other role in this function uses. It used to read
      // (len, w, d), a private swap that cancelled a swap in the emitter, so the 3D view was right
      // and every other consumer of `actual` was wrong. Fixed in the emitter instead.
      p.add(new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.05, m.cutLength / 12), Math.max(0.05, m.actual.d / 12), Math.max(0.05, m.actual.w / 12)),
        new THREE.MeshBasicMaterial({ color: 0x8a7a5e, transparent: true, opacity: 0.22, depthWrite: false }),
      ));
      group.add(p);
    } else if (m.role === 'screenPanel') {
      // See-through, because that is what the member IS. Drawn as plywood it read as a wall.
      p = screenSheet(group, m.cutLength, m.actual.d);
      p.scale.set(m.cutLength / 12, m.actual.d / 12, Math.max(0.02, m.actual.w / 12));
    } else if (m.nominal.includes('panel')) {
      p = plywoodSheet(group);
      p.scale.set(m.cutLength / 12, m.actual.d / 12, Math.max(0.02, m.actual.w / 12));
    } else if (m.id === riserLidId && riserHoles.length) {
      // THE SEAT OPENINGS. `generateRiserBox` promised "a seat opening per seat" and cut none, so
      // a four-seat latrine was an unbroken ten-foot bench — the one feature that makes the
      // building a latrine, missing. The lid is a flat board; the holes go through it.
      const hx = m.cutLength / 24;
      const hy = m.actual.d / 24;
      p = cutLumberPiece(
        group,
        [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]],
        m.actual.w / 12,
        riserHoles,
      );
    } else if (m.role === 'stringer') {
      // A STAIR stringer is cut: a level seat under every tread, a plumb face between each pair,
      // the foot cut level on the ground and the head plumb at the landing. Drawn as a plain
      // raked box it ended in two sharp wedges — one 4 in under the earth, one the same distance
      // above the landing — and its straight top edge crossed every tread it was meant to carry.
      //
      // A RAMP's stringer carries the same role and has no steps to cut, so it falls back to the
      // end cuts alone. `stairStringerProfile` says which is which off the piece itself.
      p = cutLumberPiece(group, stairStringerProfile(m) ?? stringerEndProfile(m), m.actual.w / 12);
    } else if (m.role === 'towerBrace' && levelFootProfile(m)) {
      // A TOWER X-BRACE lands on the footing its legs stand on, and a diagonal meeting a level
      // thing is cut level. Struck corner to corner and left square, the board's low corner
      // reaches 2.21 in below the corner it was struck from, which put every bottom-bay brace's
      // foot inside the mudsill (1.93 in) or the concrete pad (1.92) on all four faces.
      p = cutLumberPiece(group, levelFootProfile(m)!, m.actual.w / 12);
    } else if (m.role === 'bentRafter' && ridgeHeadProfile(m)) {
      // A TENT BENT'S RAFTER lands on a ridge board, and a rafter meeting a ridge is cut plumb.
      // Square to the rake it is a wedge that cannot be placed: bear its low corner on the board
      // and its top corner gapes; centre it on the board's face and the low corner is inside both
      // the ridge and the opposite rafter. The cut is what makes the joint placeable at all.
      p = cutLumberPiece(group, ridgeHeadProfile(m)!, m.actual.w / 12);
    } else if (seat?.length) {
      // A NOTCHED rafter. The plain prop is a box, and a box laid at pitch across a cap plate
      // intersects it — 3 inches of rafter buried in the plate at every bearing, on every roof.
      // Cut the seat instead: the piece now lands ON the plate, and the notch reads as the
      // bird's-mouth it is from any angle you orbit to.
      p = cutLumberPiece(group, seatProfile(m, seat), m.actual.w / 12);
    } else {
      p = lumberPiece(group, propFor(m.nominal), m.cutLength / 12, m.actual.d / 12, m.actual.w / 12);
    }
    p.rotation.order = 'YXZ';
    p.rotation.set(...m.rotation);
    p.position.set(m.position[0], m.position[1], m.position[2]);
    p.userData.memberId = m.id;
    p.userData.stage = m.stage;

    // The cartoon outline is a fixed hairline in feet, which is right for framing lumber and
    // far too heavy for thin stock: on a 3/4-inch batten the black rim is a quarter of the
    // piece, and a wall of board-and-batten siding reads as a solid black slab rather than
    // boards. Drop the outline on thin members and let the material carry them.
    const thinnest = Math.min(m.actual.w, m.actual.d);
    if (thinnest < 1.6) {
      p.traverse((o) => {
        if (o.userData.isOutline) o.userData.suppressOutline = true;
      });
    }
    return p;
  }

  /**
   * Recolor every material under a wrapper, or restore each one's own original color.
   *
   * WHAT WAS BROKEN. This used to read `o.material instanceof THREE.MeshToonMaterial`, and that
   * test is false for most of the interesting members. A plywood sheet carries an ARRAY of six
   * materials (grained faces, ply-edge sides) and an array is not an instance of anything; so
   * does a roofing course; insect screen is a MeshBasicMaterial because it has to be
   * see-through. So selecting a piece of plywood, a screen panel or a run of roofing highlighted
   * NOTHING — the operator clicked a panel, read its card, and had no idea which panel on screen
   * it was. Everything with a color gets tinted now, arrays included, and the original is
   * remembered PER MATERIAL rather than per mesh (one mesh, six colors to put back).
   */
  function tint(wrapper: THREE.Group, hex: number | null): void {
    wrapper.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      // The cartoon outline is a black backface shell. Tinting it turns the piece into a
      // coloured blob with no silhouette, so it keeps its own color throughout.
      if (o.userData.isOutline === true) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        const m = mat as THREE.Material & { color?: THREE.Color };
        if (!m?.color) continue;
        const store = m.userData as { baseColor?: number };
        if (hex === null) {
          if (store.baseColor !== undefined) m.color.setHex(store.baseColor);
        } else {
          if (store.baseColor === undefined) store.baseColor = m.color.getHex();
          m.color.setHex(hex);
        }
      }
    });
  }

  /** Assign clip planes to every material — must be redone whenever meshes are rebuilt. */
  function applyClipping(): void {
    const planes = clipPlanes.length > 0 ? clipPlanes : null;
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const isOutline = o.userData.isOutline === true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.clippingPlanes = planes;
        // The cartoon outline is a slightly-oversized shell rendered BACK-side — that is the
        // entire trick. Forcing it to FrontSide turns every outline into a solid black box
        // wrapping its member, which paints a board-and-batten wall pure black.
        if (!isOutline) {
          // Under a cut the inside of a member must render, or the section reads as a hole.
          mat.side = planes ? THREE.DoubleSide : THREE.FrontSide;
        }
        mat.needsUpdate = true;
      }
      // Hide outlines under a cut (their black backfaces would ink the section), and on thin
      // stock where the hairline is a quarter of the piece.
      if (isOutline) o.visible = !planes && o.userData.suppressOutline !== true;
    });
  }

  /**
   * The grade grid, sized to whatever is standing. Square and generous — grade does not stop at
   * the eave — and snapped to whole modules so the lines stay on foot marks at any building
   * size. Non-writing depth and a low opacity are what keep it a reference rather than a
   * surface: it never hides a member, from above or from below.
   */
  function makeGrade(): THREE.Object3D {
    const box = memberAabb(model.members);
    const span = Math.max(box.max[0] - box.min[0], box.max[2] - box.min[2]);
    const size = Math.ceil((span * 2 + 20) / GRID_MODULE_FT) * GRID_MODULE_FT;
    const c = sceneColors();
    const grid = new THREE.GridHelper(size, size / GRID_MODULE_FT, c.gridAxis, c.grid);
    const mat = grid.material as THREE.LineBasicMaterial;
    mat.transparent = true;
    mat.opacity = GRID_OPACITY;
    mat.depthWrite = false;
    grid.position.set(
      (box.min[0] + box.max[0]) / 2,
      model.levels.gradeY ?? 0,
      (box.min[2] + box.max[2]) / 2,
    );
    // Behind everything built, so a member and the grid never fight over the same pixel.
    grid.renderOrder = -1;
    return grid;
  }

  function rebuild(): void {
    disposeObject(group);
    group.clear();
    byId.clear();
    seats = seatCutsFor(model.members);
    const lid = riserLidOf(model.members);
    riserLidId = lid?.id ?? null;
    riserHoles = lid ? seatOpeningsFor(model.members).map(seatOpeningPath) : [];
    for (const m of model.members) {
      const mesh = buildMemberMesh(m);
      byId.set(m.id, mesh);
    }
    if (ground) {
      // A GridHelper is LineSegments, which `disposeObject` (Mesh/Sprite only) would skip —
      // it frees its own geometry and material instead.
      scene.remove(ground);
      (ground as THREE.GridHelper).dispose();
    }
    ground = makeGrade();
    scene.add(ground);
    applyClipping();
    applyStage();
    applySelection();
  }

  /**
   * ONE PASS OWNS EVERY MEMBER'S COLOR. Stage tinting and selection tinting used to be two
   * passes that each undid part of the other's work, which is survivable with two states and
   * not with three — and hovering is the third. Precedence, highest first:
   *
   *   selected  the piece whose card is open. Unmistakable, because "which one is it" is the
   *             question the card cannot answer on its own.
   *   hovered   what the pointer is over right now, so you can see what you are about to click.
   *   stage     everything going in during the stage being scrubbed.
   *
   * Visibility is settled here too, since it depends on the same stage number.
   */
  function applyStage(): void {
    const maxStage = model.stagePlan.length;
    const showAll = stage >= maxStage;
    for (const m of model.members) {
      const mesh = byId.get(m.id);
      if (!mesh) continue;
      mesh.visible = m.stage <= stage;
      // "All" is a DISTINCT state from selecting the last stage: no current-stage tint.
      const isCurrent = !showAll && m.stage === stage;
      tint(mesh, m.id === selected ? SELECT_TINT
        : m.id === hovered ? HOVER_TINT
        : isCurrent ? STAGE_TINT
        : null);
    }
  }

  /** Kept as its own name because the call sites read better in pairs; the work is above. */
  function applySelection(): void {
    applyStage();
  }

  // ── Cutaway ────────────────────────────────────────────────────────────────

  function bounds(): Aabb {
    return memberAabb(model.members);
  }

  function applyCutaway(): void {
    const eq = planeForState(cut, bounds());
    clipPlanes.length = 0;
    if (eq) {
      clipPlanes.push(new THREE.Plane(new THREE.Vector3(eq.normal[0], eq.normal[1], eq.normal[2]), eq.constant));
      const b = bounds();
      sectionFill.position.set(
        (b.min[0] + b.max[0]) / 2,
        (b.min[1] + b.max[1]) / 2,
        (b.min[2] + b.max[2]) / 2,
      );
      sectionFill.intensity = 0.8;
    } else {
      sectionFill.intensity = 0;
    }
    applyClipping();
    renderCutControls();
  }

  function renderCutControls(): void {
    dom.cutAxes.innerHTML = CUT_AXES.map(
      (a) => `<button class="chip${cut.active === a.id ? ' on' : ''}" data-cut="${a.id}" type="button">${esc(a.label)}</button>`,
    ).join('');
    dom.cutAxes.querySelectorAll<HTMLButtonElement>('[data-cut]').forEach((el) => {
      el.addEventListener('click', () => {
        cut = toggleAxis(cut, el.dataset.cut as never);
        applyCutaway();
      });
    });
    if (!cut.active) {
      dom.cutDepthRow.innerHTML = '';
      dom.cutDepthRow.hidden = true;
      return;
    }
    const axis = axisById(cut.active);
    const pct = Math.round(cut.depth[cut.active] * 100);
    dom.cutDepthRow.hidden = false;
    dom.cutDepthRow.innerHTML = `
      <label class="cut-depth">
        <span class="cut-anchor">Depth ${esc(axis.anchor)}</span>
        <input type="range" min="0" max="100" value="${pct}" aria-label="Cut depth ${esc(axis.anchor)}" />
        <output>${pct}%</output>
      </label>`;
    const input = dom.cutDepthRow.querySelector('input')!;
    const out = dom.cutDepthRow.querySelector('output')!;
    input.addEventListener('input', () => {
      cut = setDepth(cut, Number(input.value) / 100);
      out.textContent = `${input.value}%`;
      applyCutaway();
    });
  }

  // ── Cameras ────────────────────────────────────────────────────────────────

  function aspect(): number {
    const w = Math.max(1, dom.viewport.clientWidth);
    const h = Math.max(1, viewportHeight());
    return w / h;
  }

  function viewportHeight(): number {
    // The workbench is a windowed layout now: the viewport is a flex item with a real height of
    // its own. Measure that when it exists, and only fall back to the window-relative estimate
    // on the first pass, before the layout has settled.
    const own = dom.viewport.clientHeight;
    if (own > 40) return own;
    return Math.max(320, window.innerHeight - dom.viewport.getBoundingClientRect().top - 12);
  }

  function useRig(id: string): void {
    const rig = rigs.find((r) => r.id === id) ?? rigs[0];
    if (!rig) return;
    activeRig = rig.id;
    const next = rig.kind === 'perspective' ? persp : ortho;
    if (next !== camera) {
      controls.dispose();
      camera = next;
      controls = tuneControls(new OrbitControls(camera as THREE.PerspectiveCamera, renderer.domElement));
    }
    camera.position.set(...rig.position);
    camera.up.set(...rig.up);
    controls.target.set(...rig.target);
    if (rig.kind === 'orthographic' && rig.orthoHalf) {
      const a = aspect();
      ortho.left = -rig.orthoHalf * a;
      ortho.right = rig.orthoHalf * a;
      ortho.top = rig.orthoHalf;
      ortho.bottom = -rig.orthoHalf;
      ortho.updateProjectionMatrix();
    }
    controls.update();
    for (const b of dom.views.querySelectorAll('button')) {
      b.classList.toggle('on', (b as HTMLButtonElement).dataset.view === activeRig);
    }
  }

  function renderViews(): void {
    rigs = cameraRigsFor(model.members, aspect());
    dom.views.innerHTML = rigs
      .map((r) => `<button class="chip${r.id === activeRig ? ' on' : ''}" data-view="${r.id}" type="button">${esc(r.label)}</button>`)
      .join('');
    dom.views.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((el) => {
      el.addEventListener('click', () => useRig(el.dataset.view!));
    });
  }

  function fitViewport(): void {
    const w = Math.max(1, dom.viewport.clientWidth);
    const h = viewportHeight();
    renderer.setSize(w, h);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    const rig = rigs.find((r) => r.id === activeRig);
    if (rig?.kind === 'orthographic' && rig.orthoHalf) {
      const a = w / h;
      ortho.left = -rig.orthoHalf * a;
      ortho.right = rig.orthoHalf * a;
      ortho.top = rig.orthoHalf;
      ortho.bottom = -rig.orthoHalf;
      ortho.updateProjectionMatrix();
    }
  }

  // ── Panels ─────────────────────────────────────────────────────────────────

  function renderStages(): void {
    const chips = model.stagePlan
      .map((s) => `<button class="chip${stage === s.ordinal ? ' on' : ''}" data-stage="${s.ordinal}" title="${esc(s.label)}" type="button">${s.ordinal}</button>`)
      .join('');
    const allOn = stage >= model.stagePlan.length ? ' on' : '';
    dom.stages.innerHTML = `<button class="chip${allOn}" data-stage="all" type="button">All</button>${chips}`;
    dom.stages.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach((el) => {
      el.addEventListener('click', () => {
        stage = el.dataset.stage === 'all' ? Number.MAX_SAFE_INTEGER : Number(el.dataset.stage);
        applyStage();
        applySelection();
        renderStages();
        renderStagePanel();
      });
    });
  }

  function renderStagePanel(): void {
    const showAll = stage >= model.stagePlan.length;
    const cur = showAll ? undefined : model.stagePlan.find((s) => s.ordinal === stage);
    // The active stage name is a PERSISTENT text line at every width — never tooltip-only.
    dom.stageName.textContent = cur ? `Stage ${cur.ordinal} — ${cur.label}` : 'All stages';

    const bom = bomSummary(model.members, model.stagePlan);
    const active = bom.stages.filter((s) => showAll || s.stage <= stage);
    const runBf = active.reduce((a, s) => a + s.boardFeet, 0);
    const runMh = active.reduce((a, s) => a + s.manHours, 0);
    const row = cur ? bom.stages.find((s) => s.stage === cur.ordinal) : undefined;

    const detail = cur ? `<p class="stage-detail">${esc(cur.detail)}</p>` : '';
    // Man-hours are a PLANNING output. In the learning app the same line reports size and piece
    // count — what the stage is — without a labor figure a student could hand to their command
    // as if it were an estimate. Board-feet stay: that is a property of the building.
    const labor = (mh: number): string => (FEATURES.commandOutputs ? ` · ${mh.toFixed(1)} MH (PH rates)` : '');
    const note = row
      ? `<p class="stage-note">This stage: ${row.memberCount} members · ${row.boardFeet.toFixed(0)} BF${labor(row.manHours)}.<br>Through stage ${row.stage}: ${runBf.toFixed(0)} BF${labor(runMh)}.</p>`
      : `<p class="stage-note">Whole structure: ${bom.totalMembers} members · ${bom.totalBoardFeet.toFixed(0)} BF${labor(bom.totalManHours)}.</p>`;

    const lines = (row?.lines ?? (showAll ? bom.stages.flatMap((s) => s.lines) : []))
      .map((l) => `<tr><td>${esc(l.nominal)}</td><td class="num">${fmtFtIn(l.cutLengthIn)}</td><td class="num">${l.count}</td><td>${esc(l.roles.map(plainName as never).join(', '))}</td></tr>`)
      .join('');

    // The hardware bill is scoped to whatever is on screen: pick a stage and it tells you what
    // to draw for that stage, which is how a section actually goes to supply.
    const forHardware = showAll ? model.members : model.members.filter((m) => m.stage <= stage);
    const hardware = FEATURES.hardwareTakeoff ? hardwareHtml(forHardware, showAll ? null : stage) : '';

    // Plan §2.7: the boundary sentence renders on the bunker's BOM header, on its card, and on
    // the soil ghost's label. Three surfaces, one string, taken from doctrine and never retyped.
    const boundary = model.spec.family === 'bunker'
      ? `<p class="doctrine boundary">${esc(COVER_DEPTH_NOTE)}</p>`
      : '';

    dom.stagePanel.innerHTML = `${detail}${note}${boundary}
      <h2>Cut list${cur ? ' — this stage' : ''}</h2>
      <table><thead><tr><th>Stock</th><th class="num">Cut</th><th class="num">Pcs</th><th>Use</th></tr></thead><tbody>${lines}</tbody></table>
      ${hardware}`;
  }

  /**
   * Nails and pins, by count and by pound. Derived from the same members the scene draws — each
   * one carries the nailing schedule its geometry needs — so this can never disagree with the
   * model. Any schedule the take-off could not read is printed rather than dropped: a supply
   * request that silently omits what it did not understand is worse than a short one.
   */
  function hardwareHtml(members: Member[], throughStage: number | null): string {
    const take = fastenerTakeoff(members);
    if (take.lines.length === 0) return '';
    const rows = take.lines
      .map((l) => `<tr><td>${esc(l.spec)}</td><td class="num">${l.count.toLocaleString()}</td><td class="num">${l.poundsApprox ? `${l.poundsApprox} lb` : '—'}</td></tr>`)
      .join('');
    const sheets = sheetTakeoff(members)
      .map((l) => `<tr><td>${esc(l.nominal)}</td><td class="num">${l.count}</td><td class="num">—</td></tr>`)
      .join('');
    const unread = take.unparsed.length > 0
      ? `<p class="doctrine">Not counted — ${take.unparsed.length} nailing schedule(s) this take-off could not read:
         ${take.unparsed.map((u) => `${esc(u.schedule)} (${u.members})`).join('; ')}</p>`
      : '';
    return `<h2>Hardware &amp; sheet goods${throughStage === null ? '' : ` — through stage ${throughStage}`}</h2>
      <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Weight</th></tr></thead>
      <tbody>${rows}${sheets}</tbody></table>
      <p class="doctrine">Counts are read off each member's own nailing schedule. Sheathing field nails
        assume supports at ${take.fieldSupportSpacingIn} in. Pieces-per-pound are common published
        figures, marked (PH) — page check before submitting a supply request.</p>${unread}`;
  }

  function renderMemberCard(): void {
    const m = model.members.find((x) => x.id === selected);
    if (!m) {
      dom.memberCard.innerHTML = '';
      dom.memberCard.hidden = true;
      return;
    }
    dom.memberCard.hidden = false;
    const identical = model.members.filter(
      (x) => x.role === m.role && x.nominal === m.nominal && Math.abs(x.cutLength - m.cutLength) < 0.06,
    ).length;
    const angles = m.angles
      ? Object.entries(m.angles).map(([k, v]) => `${k} ${(v as number).toFixed(1)}°`).join(' · ')
      : '';
    const what = whatItDoes(m.role);
    const stageRow = model.stagePlan.find((s) => s.ordinal === m.stage);
    const ls = /LIFE-SAFETY/.test(m.doctrineRef)
      ? '<p class="ls-badge">LIFE-SAFETY — this size comes from a safety table under review.</p>'
      : '';
    dom.memberCard.innerHTML = `
      <strong>${esc(plainName(m.role))}</strong> <span class="dim">(${esc(m.id)})</span>
      ${what ? `<p class="what">${esc(what)}</p>` : ''}
      ${ls}
      <dl>
        <dt>Size</dt><dd>${esc(m.nominal)} (actual ${m.actual.w}" × ${m.actual.d}")</dd>
        <dt>Cut length</dt><dd>${fmtFtIn(m.cutLength)}${angles ? ' · ' + esc(angles) : ''}</dd>
        <dt>Grade / nailing</dt><dd>${esc(m.grade)} · ${esc(m.nailing)}</dd>
        <dt>Stage</dt><dd>${m.stage} — ${esc(stageRow?.label ?? '')}</dd>
        <dt>Identical members</dt><dd>${identical} pcs</dd>
        <dt>Doctrine</dt><dd>${esc(m.doctrineRef)}</dd>
      </dl>`;
  }

  // ── Picking ────────────────────────────────────────────────────────────────

  // ── First-run hint ─────────────────────────────────────────────────────────
  //
  // The Learning app's whole promise is "tap any piece to find out what it is", and nothing on
  // a fresh viewport says so — a 3D scene reads as a picture until something proves it is not.
  // One pill, above the model, once ever: it ignores the pointer entirely (so it can never
  // block the tap it is asking for), disappears on the first successful pick, and never comes
  // back. Its own localStorage key rather than the versioned session store, because a hint is
  // not state worth migrating.
  const TAP_HINT_KEY = 'timber.hint.tap-piece';
  let tapHint: HTMLElement | null = null;
  if (FEATURES.flashcards && !window.localStorage.getItem(TAP_HINT_KEY)) {
    tapHint = document.createElement('div');
    tapHint.className = 'tap-hint';
    tapHint.textContent = 'Tap any piece to see what it is';
    dom.viewport.appendChild(tapHint);
  }
  function dismissTapHint(): void {
    if (!tapHint) return;
    tapHint.remove();
    tapHint = null;
    try { window.localStorage.setItem(TAP_HINT_KEY, '1'); } catch { /* private mode: shows again, harmless */ }
  }

  const raycaster = new THREE.Raycaster();

  /** The member under the pointer, or null. One implementation, so hover and click agree. */
  function memberAt(ev: { clientX: number; clientY: number }): string | null {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const eq = planeForState(cut, bounds());
    for (const h of raycaster.intersectObjects(group.children, true)) {
      // Picking through a cut must find what you SEE — same plane equation as the renderer.
      if (!passesCut([h.point.x, h.point.y, h.point.z], eq)) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.memberId) o = o.parent;
      if (!o?.userData.memberId) continue;
      // Same rule for the stage scrubber: three's raycaster tests meshes the renderer is
      // hiding, so with the build scrubbed back to stage 8 a tap on a rafter would select
      // the invisible roofing above it — and the card would name a piece that is not on
      // screen. What you see is what you pick; a hidden hit lets the ray keep going.
      if (!o.visible) continue;
      return o.userData.memberId as string;
    }
    return null;
  }

  renderer.domElement.addEventListener('click', (ev) => {
    selected = memberAt(ev);
    if (selected) dismissTapHint();
    applyStage();
    renderMemberCard();
  });

  // HOVER. A raycast per pointermove is affordable here (a few hundred boxes) but pointless
  // while the camera is being dragged, so orbiting suppresses it — otherwise every orbit
  // repaints the whole model as the pointer sweeps across it.
  let dragging = false;
  renderer.domElement.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  renderer.domElement.addEventListener('pointerleave', () => {
    if (hovered === null) return;
    hovered = null;
    applyStage();
  });
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (dragging) return;
    const id = memberAt(ev);
    renderer.domElement.style.cursor = id ? 'pointer' : '';
    if (id === hovered) return;
    hovered = id;
    applyStage();
  });

  window.addEventListener('resize', () => {
    // fitViewport alone: aspect and ortho frustum follow the new box, the POSE stays. Re-running
    // the rig here meant every phone address-bar show/hide snapped the camera home mid-orbit.
    fitViewport();
  });

  // ── Boot ───────────────────────────────────────────────────────────────────

  rebuild();
  fitViewport();
  renderViews();
  useRig('iso-se');
  // The first pass runs before the flex layout has settled, so the aspect the fit used can be
  // wrong — which shows up as a model framed for a viewport that no longer exists. Refit once
  // the browser has laid out for real.
  requestAnimationFrame(() => {
    fitViewport();
    renderViews();
    useRig(activeRig);
  });
  renderStages();
  renderStagePanel();
  renderCutControls();
  renderMemberCard();

  let raf = 0;
  const loop = (): void => {
    raf = requestAnimationFrame(loop);
    controls.update();
    if (ground) {
      const gridMat = (ground as THREE.GridHelper).material as THREE.LineBasicMaterial;
      const want = camera.position.y < ground.position.y ? GRID_OPACITY_UNDER : GRID_OPACITY;
      if (gridMat.opacity !== want) gridMat.opacity = want;
    }
    renderer.render(scene, camera);
  };
  loop();

  return {
    setModel(next) {
      // THE CAMERA IS THE USER'S, NOT THE MODEL'S. This used to end in `useRig(activeRig)`,
      // which snaps the camera back to the preset — so typing ONE DIGIT into Length threw away
      // whatever viewpoint the operator had orbited to, on every keystroke. The pose is kept
      // unless the structure's overall size or position changed enough that the old framing is
      // pointing at empty air (dimension edits at that scale genuinely need a re-frame; a
      // spacing or covering edit never does).
      const before = memberAabb(model.members);
      model = next;
      if (selected && !model.members.some((m) => m.id === selected)) selected = null;
      rebuild();
      renderViews();
      const after = memberAabb(model.members);
      const size = (b: Aabb): number => Math.hypot(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]);
      const drift = Math.hypot(
        (after.min[0] + after.max[0]) - (before.min[0] + before.max[0]),
        (after.min[1] + after.max[1]) - (before.min[1] + before.max[1]),
        (after.min[2] + after.max[2]) - (before.min[2] + before.max[2]),
      ) / 2;
      const grew = size(after) / Math.max(1e-6, size(before));
      if (grew > 1.25 || grew < 0.8 || drift > size(after) * 0.25) useRig(activeRig);
      renderStages();
      renderStagePanel();
      renderMemberCard();
      applyCutaway();
    },
    dispose() {
      cancelAnimationFrame(raf);
      disposeObject(group);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    debug: () => ({ stage, cut, selected, meshCount: byId.size }),
  };
}
