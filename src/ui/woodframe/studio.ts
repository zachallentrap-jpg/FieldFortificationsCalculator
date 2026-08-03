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
import { lumberPiece, plywoodSheet, roofingSheet, screenSheet, disposeObject, toonGradient } from '../three-viewer';
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
import { fmtFtIn } from '../../timber/units';

export interface StudioHandles {
  setModel(model: StructureModel): void;
  dispose(): void;
  /** For tests and the boot file — the live state, read-only. */
  debug(): { stage: number; cut: CutawayState; selected: string | null; meshCount: number };
}

const CONCRETE = 0xa9a69f;
const SELECT_TINT = 0xff8844;
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
    ? { sky: 0x1c1c1e, ground: 0x2c2c2e, bounce: 0x14161a, ambient: 0.30 }
    : { sky: 0xf2f2f5, ground: 0xdedee2, bounce: 0x4a3a22, ambient: 0.26 });

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
  darkAppearance.addEventListener('change', () => {
    const s = sceneColors();
    scene.background = new THREE.Color(s.sky);
    hemi.groundColor.setHex(s.bounce);
    ambient.intensity = s.ambient;
    if (ground) (ground.material as THREE.MeshToonMaterial).color.setHex(s.ground);
    // The render loop is continuous, so the next frame picks this up on its own.
  });
  // Warm fill from inside, so a cut face is lit rather than a black hole.
  const sectionFill = new THREE.PointLight(0xffe9c8, 0.0, 120);
  scene.add(sectionFill);

  const persp = new THREE.PerspectiveCamera(40, 1, 0.1, 800);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
  let camera: THREE.Camera = persp;
  let controls = new OrbitControls(persp, renderer.domElement);
  controls.enableDamping = true;

  const group = new THREE.Group();
  scene.add(group);
  let ground: THREE.Mesh | null = null;
  const byId = new Map<string, THREE.Group>();
  const clipPlanes: THREE.Plane[] = [];

  let rigs: CameraRig[] = [];
  let activeRig = 'iso-se';

  // ── Scene construction ─────────────────────────────────────────────────────

  function buildMemberMesh(m: Member): THREE.Group {
    let p: THREE.Group;
    if (m.nominal.includes('conc') || m.role === 'slab' || m.role === 'footing' || m.role === 'foundationWall') {
      p = new THREE.Group();
      const geo = new THREE.BoxGeometry(
        Math.max(0.05, m.cutLength / 12),
        Math.max(0.05, m.actual.d / 12),
        Math.max(0.05, m.actual.w / 12),
      );
      p.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: CONCRETE, gradientMap: toonGradient() })));
      group.add(p);
    } else if (m.role === 'roofingCourse') {
      // Roll goods vs. corrugated metal — two different materials, told apart by the nominal the
      // engine already wrote. `repeatAlong` keeps the granule/rib scale constant on any run
      // length: a course is as long as the eave, so one stretched tile would be nonsense.
      const corrugated = m.nominal.startsWith('corrugated');
      const tileFt = corrugated ? 26 / 12 : 3;
      p = roofingSheet(group, corrugated ? 'corrugated' : 'roll', Math.round(m.cutLength / 12 / tileFt), corrugated ? 1 : Math.round(m.actual.d / 36));
      p.scale.set(m.cutLength / 12, m.actual.d / 12, Math.max(0.02, m.actual.w / 12));
    } else if (m.role === 'soilGhost') {
      // MASSING, not material. Translucent and unlit so it can never be mistaken for something
      // that was built, and its member card carries the boundary sentence as its doctrine ref.
      p = new THREE.Group();
      p.add(new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(0.05, m.cutLength / 12), Math.max(0.05, m.actual.w / 12), Math.max(0.05, m.actual.d / 12)),
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

  function tint(wrapper: THREE.Group, hex: number | null): void {
    wrapper.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) {
        const mat = o.material;
        if (hex === null) {
          const base = (o.userData.baseColor as number | undefined);
          if (base !== undefined) mat.color.setHex(base);
        } else {
          if (o.userData.baseColor === undefined) o.userData.baseColor = mat.color.getHex();
          mat.color.setHex(hex);
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

  function rebuild(): void {
    disposeObject(group);
    group.clear();
    byId.clear();
    for (const m of model.members) {
      const mesh = buildMemberMesh(m);
      byId.set(m.id, mesh);
    }
    if (ground) {
      disposeObject(ground);
      scene.remove(ground);
    }
    const box = memberAabb(model.members);
    const gy = model.levels.gradeY ?? 0;
    ground = new THREE.Mesh(
      new THREE.BoxGeometry((box.max[0] - box.min[0]) * 3 + 20, 0.05, (box.max[2] - box.min[2]) * 3 + 20),
      new THREE.MeshToonMaterial({ color: sceneColors().ground, gradientMap: toonGradient() }),
    );
    ground.position.set((box.min[0] + box.max[0]) / 2, gy - 0.03, (box.min[2] + box.max[2]) / 2);
    scene.add(ground);
    applyClipping();
    applyStage();
    applySelection();
  }

  function applyStage(): void {
    const maxStage = model.stagePlan.length;
    const showAll = stage >= maxStage;
    for (const m of model.members) {
      const mesh = byId.get(m.id);
      if (!mesh) continue;
      mesh.visible = m.stage <= stage;
      // "All" is a DISTINCT state from selecting the last stage: no current-stage tint.
      const isCurrent = !showAll && m.stage === stage;
      if (m.id !== selected) tint(mesh, isCurrent ? STAGE_TINT : null);
    }
  }

  function applySelection(): void {
    for (const [id, mesh] of byId) {
      if (id === selected) tint(mesh, SELECT_TINT);
      else if (!(stage < model.stagePlan.length && (mesh.userData.stage as number) === stage)) tint(mesh, null);
    }
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
      controls = new OrbitControls(camera as THREE.PerspectiveCamera, renderer.domElement);
      controls.enableDamping = true;
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

  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const eq = planeForState(cut, bounds());
    const hits = raycaster.intersectObjects(group.children, true);
    let id: string | null = null;
    for (const h of hits) {
      // Clicking through a cut must select what you SEE — same plane equation as the renderer.
      if (!passesCut([h.point.x, h.point.y, h.point.z], eq)) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.memberId) o = o.parent;
      if (o?.userData.memberId) {
        id = o.userData.memberId as string;
        break;
      }
    }
    selected = id;
    applyStage();
    applySelection();
    renderMemberCard();
  });

  window.addEventListener('resize', () => {
    fitViewport();
    useRig(activeRig);
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
    renderer.render(scene, camera);
  };
  loop();

  return {
    setModel(next) {
      model = next;
      if (selected && !model.members.some((m) => m.id === selected)) selected = null;
      rebuild();
      renderViews();
      useRig(activeRig);
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
