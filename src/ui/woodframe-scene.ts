// TIMBER-1 render layer (see woodframe.html) — draws and cross-links every projection of the
// engine's FrameModel: the 3D scene, the stage scrubber/panel (per-stage cut list + man-hours),
// the tap-to-inspect Member Card, and the per-wall plate Layout Strips (design doc §2, §4, §5,
// §11.4). The scene invents NO geometry: every mesh carries the id of the Member it projects.
// Standalone by design (npm run build:woodframe); never imported by the app.
//
// The Model toolbar swaps FM 5-426 lessons live: foundation type (piers / continuous wall /
// full basement with framed stair opening), cross vs solid bridging, let-in bracing, and the
// attic scuttle — every option regenerates the same single Member[] and every pane follows.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { lumberPiece, plywoodSheet, onPropAssetsReady, disposeObject, toonGradient } from './three-viewer';
import type { LumberSize } from './three-viewer';
import { generateFrame, type BuildingInput, type FoundationType, type BridgingType } from '../timber/frame';
import { bomSummary } from '../timber/bom';
import { layoutStrip } from '../timber/elevation';
import { STAGES, type Member, type StageId } from '../timber/types';

// The demo building. Dimensions are fixed; the Model toolbar toggles the teaching options.
const BUILDING: BuildingInput = {
  lengthFt: 20,
  widthFt: 16,
  wallHeightFt: 8,
  studSpacingIn: 16,
  joistSpacingIn: 16,
  rafterSpacingIn: 16,
  risePer12: 4,
  overhangFt: 1,
  crawlFt: 1.5,
  openings: [
    { wall: 'S', offsetFt: 4, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }, // window
    { wall: 'S', offsetFt: 13, widthFt: 3, heightFt: 6.7, sillHeightFt: 0 }, // door
    { wall: 'N', offsetFt: 8.5, widthFt: 3, heightFt: 3.5, sillHeightFt: 3 }, // window
  ],
  foundation: 'piers',
  bridging: 'cross',
  letInBracing: true,
  atticAccess: true,
};

let MODEL = generateFrame(BUILDING);
let BOM = bomSummary(MODEL.members);

const PLAIN: Record<string, string> = {
  post: 'post', sill: 'sill', girder: 'girder (built-up)', joist: 'joist', rimJoist: 'rim joist',
  bridging: 'bridging', subfloor: 'subfloor panel', solePlate: 'sole plate', stud: 'stud',
  cripple: 'cripple', jackStud: 'jack stud (trimmer)', kingStud: 'king stud',
  header: 'header', topPlate: 'top plate', capPlate: 'cap plate (double top)',
  rafter: 'rafter', ridge: 'ridge board', collarTie: 'collar tie', roofPanel: 'roof sheathing panel',
  brace: 'let-in brace', foundationWall: 'foundation wall (concrete)', footing: 'footing (concrete)',
  slab: 'basement slab (concrete)', trimmerJoist: 'trimmer joist (doubled)',
  headerJoist: 'header joist (doubled)', tailJoist: 'tail joist',
  stringer: 'stair stringer', tread: 'stair tread',
};

// One plain-language line per role — what the piece DOES, for a Marine meeting the term for
// the first time (design doc §11.1 plain-language mode).
const WHAT: Record<string, string> = {
  post: 'Short column that carries the sills down to its footer — the building bears on these.',
  footing: 'Concrete that spreads the load onto the soil so nothing sinks.',
  foundationWall: 'Continuous concrete wall under the sills — replaces posts; the sill bolts to it.',
  slab: 'Concrete floor poured inside the basement walls.',
  sill: 'Flat starter plate: on the foundation it seats the floor; in a window bay it is the rough sill the cripples stand on.',
  girder: 'Built-up beam down the center that cuts the joist span in half.',
  joist: 'Repeating beam that carries the deck load to the sills and girder.',
  rimJoist: 'Closes off the joist ends and keeps them standing straight.',
  bridging: 'Bracing between joists — spreads load to neighbors and stops twisting.',
  subfloor: 'Deck panels that tie the joists into one stiff floor.',
  solePlate: 'Bottom plate of a wall; the studs nail down through it into the floor.',
  stud: 'Vertical wall member on the layout grid; carries the plates above it.',
  cripple: 'Short stud above a header or below a window sill — keeps the layout grid going.',
  jackStud: 'Shortened stud under each header end — carries the header load down.',
  kingStud: 'Full-height stud beside the opening; the jack nails to it.',
  header: 'Doubled beam over an opening; picks up the load of the studs that were cut.',
  topPlate: 'Upper plate that ties the studs; doubled by the cap plate.',
  capPlate: 'Second top plate; it laps the corners so the walls lock together.',
  brace: '1x4 let into the stud faces at an angle — keeps the wall square against racking.',
  rafter: 'Sloped roof beam from the wall plate to the ridge.',
  ridge: 'Board at the peak the rafter pairs bear against.',
  collarTie: 'Horizontal tie across a rafter pair — resists spreading.',
  roofPanel: 'Roof deck panel nailed over the rafters.',
  trimmerJoist: 'Doubled joist along the side of an opening; carries the headers.',
  headerJoist: 'Doubled joist across the end of an opening; carries the cut-off tail joists.',
  tailJoist: 'Shortened joist that runs from the opening header back to its bearing.',
  stringer: 'Sloped stair beam; the treads bear on it. Card shows the riser/tread layout math.',
  tread: 'The board you step on.',
};

// Carpenter-readable feet-inches: 92.625" → 7′-8 5/8″.
function fmtFtIn(inches: number): string {
  const eighths = Math.round(inches * 8);
  const ft = Math.floor(eighths / (12 * 8));
  let rem = eighths - ft * 12 * 8;
  const inch = Math.floor(rem / 8);
  rem -= inch * 8;
  const frac = rem === 0 ? '' : rem % 4 === 0 ? ' 1/2' : rem % 2 === 0 ? ` ${rem / 2}/4` : ` ${rem}/8`;
  return `${ft}'-${inch}${frac}"`;
}

// ── Renderer / scene ──────────────────────────────────────────────────────────
const viewport = document.getElementById('viewport')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ec);
const persp = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
let camera: THREE.Camera = persp;
let controls = new OrbitControls(persp, renderer.domElement);

function fitViewport(): void {
  const w = Math.max(1, viewport.clientWidth);
  const h = Math.max(320, window.innerHeight - viewport.getBoundingClientRect().top - 8);
  renderer.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  const halfW = orthoHalf;
  ortho.left = -halfW; ortho.right = halfW;
  ortho.top = halfW * (h / w); ortho.bottom = -halfW * (h / w);
  ortho.updateProjectionMatrix();
}
let orthoHalf = Math.max(BUILDING.lengthFt, BUILDING.widthFt) * 0.75;
window.addEventListener('resize', fitViewport);

scene.add(new THREE.HemisphereLight(0xffffff, 0x4a3a22, 1.1), new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(12, 20, 8);
scene.add(sun);

// Ground sits a hair under the engine's grade line (footer tops peek through); the basement
// option cuts the lawn back around the excavation and lines the cut with earth faces so the
// hole reads as dug ground, not void.
let ground: THREE.Group | null = null;
function buildGround(): void {
  if (ground) { disposeObject(ground); scene.remove(ground); }
  ground = new THREE.Group();
  const grass = (): THREE.MeshToonMaterial => new THREE.MeshToonMaterial({ color: 0x9dbd80, gradientMap: toonGradient() });
  const earth = (): THREE.MeshToonMaterial => new THREE.MeshToonMaterial({ color: 0x8a6b46, gradientMap: toonGradient() });
  const gy = MODEL.levels.gradeY - 0.035;
  const HX = BUILDING.lengthFt * 1.5;
  const HZ = BUILDING.widthFt * 1.7;
  const strip = (cx: number, cz: number, sx: number, sz: number): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.05, sz), grass());
    m.position.set(cx, gy, cz);
    ground!.add(m);
  };
  if ((BUILDING.foundation ?? 'piers') === 'basement') {
    const hx = BUILDING.lengthFt / 2 + 0.8;
    const hz = BUILDING.widthFt / 2 + 0.8;
    strip(0, -(hz + HZ) / 2, 2 * HX, HZ - hz);
    strip(0, (hz + HZ) / 2, 2 * HX, HZ - hz);
    strip(-(hx + HX) / 2, 0, HX - hx, 2 * hz);
    strip((hx + HX) / 2, 0, HX - hx, 2 * hz);
    // Excavation faces: earth curtains lining the hole from grade down past the footings.
    const digBottom = (MODEL.levels.slabTop ?? MODEL.levels.gradeY - 8) - 1.2;
    const digH = gy - digBottom;
    const face = (cx: number, cz: number, sx: number, sz: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, digH, sz), earth());
      m.position.set(cx, gy - digH / 2 + 0.025, cz);
      ground!.add(m);
    };
    face(0, -hz - 0.06, 2 * hx + 0.24, 0.12);
    face(0, hz + 0.06, 2 * hx + 0.24, 0.12);
    face(-hx - 0.06, 0, 0.12, 2 * hz);
    face(hx + 0.06, 0, 0.12, 2 * hz);
  } else {
    strip(0, 0, 2 * HX, 2 * HZ);
  }
  scene.add(ground);
}

// ── Views (design doc §3.1): perspective isos, orthographic plan/elevations ──
const CENTER = new THREE.Vector3(0, BUILDING.wallHeightFt * 0.45, 0);
const R = Math.max(BUILDING.lengthFt, BUILDING.widthFt) * 1.35;

function setCamera(next: THREE.Camera, pos: THREE.Vector3, up?: THREE.Vector3): void {
  camera = next;
  controls.dispose();
  controls = new OrbitControls(camera as THREE.PerspectiveCamera, renderer.domElement);
  camera.position.copy(pos);
  camera.up.copy(up ?? new THREE.Vector3(0, 1, 0));
  controls.target.copy(CENTER);
  controls.update();
}

const VIEWS: [string, () => void][] = [
  ['Iso NE', () => setCamera(persp, new THREE.Vector3(R, R * 0.62, -R).add(CENTER))],
  ['Iso NW', () => setCamera(persp, new THREE.Vector3(-R, R * 0.62, -R).add(CENTER))],
  ['Iso SE', () => setCamera(persp, new THREE.Vector3(R, R * 0.62, R).add(CENTER))],
  ['Iso SW', () => setCamera(persp, new THREE.Vector3(-R, R * 0.62, R).add(CENTER))],
  ['Plan', () => setCamera(ortho, new THREE.Vector3(0, R * 1.6, 0).add(CENTER), new THREE.Vector3(0, 0, -1))],
  ['Front', () => setCamera(ortho, new THREE.Vector3(0, 0, R * 1.6).add(CENTER))],
  ['Left', () => setCamera(ortho, new THREE.Vector3(-R * 1.6, 0, 0).add(CENTER))],
];

// ── FrameModel → meshes ───────────────────────────────────────────────────────
function propFor(nominal: string): LumberSize {
  if (nominal in { '2x4': 1, '2x6': 1, '4x4': 1 }) return nominal as LumberSize;
  if (nominal.startsWith('1x')) return '2x4'; // thin stock; exact dims still applied
  return nominal.startsWith('2x') ? '2x6' : '4x4'; // nearest prop; exact dims still applied
}

const group = new THREE.Group();
scene.add(group);
let currentStage: StageId = 11;
let selectedId: string | null = null;

// Concrete members (foundation walls, footings, slab) are plain toon boxes — not lumber.
function concretePiece(m: Member): THREE.Group {
  const wrapper = new THREE.Group();
  const geo = new THREE.BoxGeometry(
    Math.max(0.05, m.cutLength / 12),
    Math.max(0.05, m.actual.d / 12),
    Math.max(0.05, m.actual.w / 12),
  );
  wrapper.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: 0xa9a69f, gradientMap: toonGradient() })));
  group.add(wrapper);
  return wrapper;
}

function buildMember(m: Member): THREE.Group {
  let p: THREE.Group;
  if (m.nominal.includes('conc')) {
    p = concretePiece(m);
  } else if (m.nominal.includes('panel')) {
    p = plywoodSheet(group);
    p.scale.set(m.cutLength / 12, m.actual.d / 12, m.actual.w / 12);
  } else {
    p = lumberPiece(group, propFor(m.nominal), m.cutLength / 12, m.actual.d / 12, m.actual.w / 12);
  }
  p.rotation.order = 'YXZ';
  p.rotation.set(...m.rotation);
  p.position.set(m.position[0] - BUILDING.lengthFt / 2, m.position[1], m.position[2] - BUILDING.widthFt / 2);
  p.userData.memberId = m.id;
  return p;
}

function tint(wrapper: THREE.Group, hex: number): void {
  wrapper.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) o.material.color.setHex(hex);
  });
}

function rebuild(): void {
  disposeObject(group);
  group.clear();
  for (const m of MODEL.members) {
    if (m.stage > currentStage) continue;
    const p = buildMember(m);
    if (m.id === selectedId) tint(p, 0xff8844); // selection highlight
    else if (m.stage === currentStage && currentStage < 11) tint(p, 0xffe9b0); // current-stage highlight
  }
}

// ── Selection → Member Card (design doc §4.1) ────────────────────────────────
const raycaster = new THREE.Raycaster();
renderer.domElement.addEventListener('click', (ev) => {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(group.children, true);
  let id: string | null = null;
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o && !o.userData.memberId) o = o.parent;
    if (o?.userData.memberId) { id = o.userData.memberId as string; break; }
  }
  selectedId = id;
  renderMemberCard();
  rebuild();
});

function renderMemberCard(): void {
  const card = document.getElementById('memberCard')!;
  const m = MODEL.members.find((x) => x.id === selectedId);
  if (!m) { card.style.display = 'none'; return; }
  const identical = MODEL.members.filter((x) => x.role === m.role && x.nominal === m.nominal && Math.abs(x.cutLength - m.cutLength) < 0.06).length;
  const angles = m.angles ? Object.entries(m.angles).map(([k, v]) => `${k} ${v.toFixed(1)}°`).join(' · ') : '';
  const what = WHAT[m.role];
  card.style.display = 'block';
  card.innerHTML = `
    <strong>${PLAIN[m.role] ?? m.role}</strong> <span style="color:#6b6250">(${m.id})</span>
    ${what ? `<div style="margin-top:3px;color:#4a4335">${what}</div>` : ''}
    <dl style="margin:4px 0 0">
      <dt>Size</dt><dd>${m.nominal} (actual ${m.actual.w}" × ${m.actual.d}")</dd>
      <dt>Cut length</dt><dd>${fmtFtIn(m.cutLength)}${angles ? ' · ' + angles : ''}</dd>
      <dt>Grade / nailing</dt><dd>${m.grade} · ${m.nailing}</dd>
      <dt>Stage</dt><dd>${m.stage} — ${STAGES.find((s) => s.id === m.stage)?.name}</dd>
      <dt>Identical members</dt><dd>${identical} pcs</dd>
      <dt>Doctrine</dt><dd>${m.doctrineRef}</dd>
    </dl>`;
}

// ── Stage scrubber + stage panel (design doc §2.2) ───────────────────────────
function renderStagePanel(): void {
  const active = BOM.stages.filter((s) => s.stage <= currentStage);
  const cur = BOM.stages.find((s) => s.stage === currentStage) ?? active[active.length - 1];
  document.getElementById('stageTitle')!.textContent = cur ? `Stage ${cur.stage}: ${cur.name}` : 'Stages';
  const runBf = active.reduce((a, s) => a + s.boardFeet, 0);
  const runMh = active.reduce((a, s) => a + s.manHours, 0);
  document.getElementById('stageNote')!.textContent = cur
    ? `This stage: ${cur.memberCount} members · ${cur.boardFeet.toFixed(0)} BF · ${cur.manHours.toFixed(1)} MH (PH rates). ` +
      `Through stage ${cur.stage}: ${runBf.toFixed(0)} BF · ${runMh.toFixed(1)} MH.`
    : '';
  const rows = (cur?.lines ?? [])
    .map((l) => `<tr><td>${l.nominal}</td><td class="num">${fmtFtIn(l.cutLengthIn)}</td><td class="num">${l.count}</td><td>${l.roles.join(', ')}</td></tr>`)
    .join('');
  document.getElementById('stageBom')!.innerHTML =
    `<h2>Cut list — this stage</h2>
     <table><tr><th>Stock</th><th class="num">Cut</th><th class="num">Pcs</th><th>Use</th></tr>${rows}</table>`;
}

function setStage(s: StageId): void {
  currentStage = s;
  for (const b of document.querySelectorAll('#stages button')) {
    b.classList.toggle('on', Number((b as HTMLButtonElement).dataset.stage) === s);
  }
  rebuild();
  renderStagePanel();
}

// ── Layout strips (design doc §11.4) — SVG per wall, marks are tappable ──────
function renderStrips(): void {
  const body = document.getElementById('stripsBody')!;
  const walls: ['S' | 'N' | 'E' | 'W', string][] = [
    ['S', 'South (front)'], ['N', 'North (rear)'], ['E', 'East (right)'], ['W', 'West (left)'],
  ];
  body.innerHTML = walls
    .map(([wall, label]) => {
      const marks = layoutStrip(MODEL.members, wall, BUILDING.lengthFt, BUILDING.widthFt);
      const runIn = (wall === 'S' || wall === 'N' ? BUILDING.lengthFt : BUILDING.widthFt) * 12;
      const px = 3.2;
      const wPx = runIn * px + 40;
      const ticks: string[] = [];
      for (let i = 0; i <= runIn; i += 12) {
        ticks.push(`<line x1="${20 + i * px}" y1="34" x2="${20 + i * px}" y2="46" stroke="#b7ad97"/>` +
          `<text x="${20 + i * px}" y="58" font-size="9" text-anchor="middle" fill="#6b6250">${i / 12}'</text>`);
      }
      const markSvg = marks
        .map((mk) => {
          const x = 20 + mk.atIn * px;
          return `<g data-member="${mk.memberId}" style="cursor:pointer">
            <line x1="${x}" y1="10" x2="${x}" y2="34" stroke="#2b2419" stroke-width="1.4"/>
            <text x="${x}" y="8" font-size="10" font-weight="700" text-anchor="middle" fill="#2b2419">${mk.kind}</text>
          </g>`;
        })
        .join('');
      return `<details open><summary><strong>${label}</strong> — ${marks.length} marks</summary>
        <div class="stripScroll"><svg width="${wPx}" height="64" role="img" aria-label="Layout strip, ${label} wall">
          <rect x="20" y="34" width="${runIn * px}" height="12" fill="#e8dcc0" stroke="#b7ad97"/>
          ${ticks.join('')}${markSvg}
        </svg></div></details>`;
    })
    .join('');
  body.querySelectorAll('[data-member]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedId = (el as SVGGElement).dataset.member ?? null;
      renderMemberCard();
      rebuild();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

// ── Model options (the teaching toggles) ─────────────────────────────────────
interface OptionSpec {
  label: string;
  choices: [string, string][];
  get: () => string;
  set: (v: string) => void;
}
const OPTIONS: OptionSpec[] = [
  {
    label: 'Foundation',
    choices: [['piers', 'Piers'], ['wall', 'Wall'], ['basement', 'Basement']],
    get: () => BUILDING.foundation ?? 'piers',
    set: (v) => { BUILDING.foundation = v as FoundationType; },
  },
  {
    label: 'Bridging',
    choices: [['cross', 'Cross'], ['solid', 'Solid']],
    get: () => BUILDING.bridging ?? 'cross',
    set: (v) => { BUILDING.bridging = v as BridgingType; },
  },
  {
    label: 'Braces',
    choices: [['on', 'On'], ['off', 'Off']],
    get: () => (BUILDING.letInBracing ? 'on' : 'off'),
    set: (v) => { BUILDING.letInBracing = v === 'on'; },
  },
  {
    label: 'Attic hatch',
    choices: [['on', 'On'], ['off', 'Off']],
    get: () => (BUILDING.atticAccess ? 'on' : 'off'),
    set: (v) => { BUILDING.atticAccess = v === 'on'; },
  },
];

function renderOptionChips(): void {
  for (const spec of OPTIONS) {
    for (const b of document.querySelectorAll(`#options button[data-opt="${spec.label}"]`)) {
      b.classList.toggle('on', (b as HTMLButtonElement).dataset.value === spec.get());
    }
  }
}

function buildOptionChips(): void {
  const el = document.getElementById('options')!;
  for (const spec of OPTIONS) {
    const wrap = document.createElement('span');
    wrap.className = 'optGroup';
    const lbl = document.createElement('b');
    lbl.textContent = spec.label;
    wrap.appendChild(lbl);
    for (const [value, label] of spec.choices) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.opt = spec.label;
      b.dataset.value = value;
      b.textContent = label;
      b.addEventListener('click', () => {
        if (spec.get() === value) return;
        spec.set(value);
        regenerate();
      });
      wrap.appendChild(b);
    }
    el.appendChild(wrap);
  }
  renderOptionChips();
}

// Every pane is a projection of MODEL — regenerate it and they all follow.
function regenerate(): void {
  MODEL = generateFrame(BUILDING);
  BOM = bomSummary(MODEL.members);
  if (selectedId && !MODEL.members.some((m) => m.id === selectedId)) selectedId = null;
  buildGround();
  renderStrips();
  renderOptionChips();
  renderMemberCard();
  setStage(currentStage);
}

// ── Toolbar wiring ────────────────────────────────────────────────────────────
const viewsEl = document.getElementById('views')!;
for (const [name, go] of VIEWS) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = name;
  b.addEventListener('click', go);
  viewsEl.appendChild(b);
}
const stagesEl = document.getElementById('stages')!;
for (const s of STAGES) {
  if (!BOM.stages.some((b) => b.stage === s.id)) continue; // only stages with members
  const b = document.createElement('button');
  b.className = 'chip';
  b.dataset.stage = String(s.id);
  b.title = s.name;
  b.textContent = String(s.id);
  b.addEventListener('click', () => setStage(s.id));
  stagesEl.appendChild(b);
}
buildOptionChips();

// ── Boot ──────────────────────────────────────────────────────────────────────
fitViewport();
VIEWS[2]![1](); // Iso SE default
buildGround();
setStage(11);
renderStrips();
onPropAssetsReady(rebuild); // swap in the real lumber props when the GLBs land

(window as unknown as Record<string, unknown>).__frame = { camera: () => camera, controls: () => controls, scene, group, setStage, regenerate };

function loop(): void {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}
loop();
