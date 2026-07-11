# 3D Realism Pass 2 — Plan (audited 2026-07-04, Fable; execute in Opus)

> Visual audit of the SAP-1 3D diorama against the user's complaints: **USMC-doctrine fidelity,
> build-stage honesty, geometry defects (corner voids / "extra holes", holes reading too small,
> missing grades, harsh lines where earth should be rounded), and poor visibility — especially in
> cutaways.** Every finding below was confirmed against live renders (Playwright screenshots of
> all 7 audited position types, day theme, high tier). **Plan only — no code changed yet.**

## How the audit was produced / how to re-verify

- Dev server: launch entry **`realism2`** (port 5331) already added to `.claude/launch.json`.
- Drive the app with Playwright MCP against `http://localhost:5331/index.html?cb=<ts>` —
  **always a fresh `browser_navigate` after editing scene3d/three-viewer/terrain** (HMR on an
  already-open tab silently serves the pre-edit bundle; see project memory). The harness
  preview-tab proxy can also pin stale — trust Playwright, not the preview tab.
- Set inputs via
  `document.querySelector('[data-field="positionType"]').value = 'two_man'; el.dispatchEvent(new Event('change',{bubbles:true}))`.
  Stage scrubber: `#three-stage` + `input` event. Cutaway: click `[data-action="three-cutaway"]`.
- Frame the camera through the dev handle `window.__sap3d` (DEV only): traverse
  `__sap3d.partsGroup` meshes, accumulate world-space bbox, then
  `camera().position.set(cx + d*sin(az), d*alt, cz + d*cos(az)); controls().target.set(cx, min(0, minY*0.4), cz); controls().update()`
  with `d = max(extentX, extentZ, 10) * 1.5`, `az≈0.6`, `alt≈0.85` for overviews;
  `az≈0.2, alt≈0.5, d×1.2` for cutaway shots. Hide label sprites while shooting
  (`traverse(o => { if (o.isSprite) o.visible = false })`).
- Screenshot the canvas element directly: `page.locator('canvas[role="img"]').screenshot(...)`.
- After the pass: `npm run verify` (typecheck + 179 tests + offline gate) must stay green.

Audited: `two_man` (rect), `mg_crew` (inverted_t), `fifty_cal` (l_shape), `mortar_pit`
(circular), `vehicle_hull_defilade` (vehicle_ramp), `bunker_op_cp` (rect_roofed, cover on+off),
`atgm_javelin` (l_shape, wide rear), plus stages 0/1/2/4/5 and cutaways.

---

## Phase 1 — Cutaway & visibility (the headline complaint)

### R1. Cutaway section is a black hollow void — light it, close it, de-ink it

**Evidence.** Every cutaway shot (two_man, mg_crew, mortar, bunker+cover): everything below the
crust renders near-black; the diorama reads as a **hollow table on legs** — thin green top, dark
void, floor plug floating below. Stringers under the bunker roof read as floating black stubs.

**Root causes.**
1. No light reaches the section: the rig (`three-viewer.ts` ~900-920) is keylight-from-above +
   hemi; the clip plane (`normal (0,0,-1)`, keeps z<0) opens the model toward **+z**, and no
   light points that way.
2. Part materials are FrontSide: a clipped box is see-through from the cut side (you look
   straight through its missing near half at the unlit inside of whatever is behind). Terrain
   materials are already DoubleSide (`terrain.ts:283-285`) but the toon parts
   (`addToonMesh`, `three-viewer.ts:322`) are not.
3. The cartoon outline shells (BackSide black, 3.5% oversize) get clipped too — their black
   *interiors* face the camera through every cut, inking whole regions solid black.

**Fix (all in `three-viewer.ts`).**
- Add a dedicated **section fill light**: warm directional (`0xffe9cf`, ~0.8), no shadows,
  positioned from `(size*0.3, size*0.9, size*1.4)` (i.e. above/behind the camera's default +z
  side, pointing into the opened half). `visible = false` by default; toggled in
  `applyCutaway(on)`. Also add `+0.12` ambient while cutaway is on (restore after). Keep the
  palette-driven rig untouched otherwise so day/night still read.
- In `applyCutaway(on)` (line ~1029): while traversing materials, when `on` also set
  `m.side = THREE.DoubleSide` for every `MeshToonMaterial` (materials are rebuilt every
  `update()`, so no restore bookkeeping is needed — just don't touch `side` when `on === false`).
- Tag outline shells at creation (`addToonMesh` / `buildRing` / `lumberPiece`):
  `outline.userData.isOutline = true`; `applyCutaway` sets `visible = !on` on tagged meshes.
  (The colored mesh alone, DoubleSide, carries the silhouette fine inside a section.)
- InstancedMesh bags: the shared batcher material must get the same clippingPlanes (it already
  does — it's a Mesh in the traverse) **and** `side = DoubleSide` when on, so cut bags don't
  become hollow shells.

**Acceptance.** Bunker with cover, cutaway, low +z camera: floor, four walls, stringers, and
roof-bag underside all individually readable; no contiguous pure-black region bigger than a
stringer. Repeat on two_man and mortar_pit.

### R2. Cutaway should read as SOLID earth — deepen the block when clipped

**Evidence.** Same shots: even lit, the space between the crust (0.8 ft) and the floor plug is
honest *void* — a museum cross-section would show solid strata all the way down.

**Fix (`terrain.ts` + `three-viewer.ts`).**
- `buildTerrain(spec, palette, opts)` gains `opts.sectionDepth?: number`. When set (viewer passes
  `max hole depth + 1.5` **only while cutaway is on**), extrude the main block to that depth
  instead of `CRUST_FT` (`terrain.ts:221`). Holes already punch through the full extrusion, so
  **skip the per-hole tube shells** in this mode (they'd be buried inside the block) but **keep
  the floor plugs** (without them the holes become open shafts).
- The strata side texture already maps v in feet (`strataUv`) — a deeper block automatically
  shows more banding; no UV work.
- Viewer: include the cutaway flag in the terrain cache key (`three-viewer.ts:1150`) so toggling
  rebuilds; everything else in the key stays.

**Acceptance.** Cutaway on any rect position: the cut face is a full-height strata wall from
grass line to below the floor — zero see-through under the crust. Cutaway off: unchanged thin
crust look (existing `scene3d-terrain` tests still pass).

### R3. Interiors are too dark even without cutaway

**Evidence.** Every overview: pit floors/walls render near-black mud; the vehicle ramp treads
are indistinguishable; steps/sumps invisible (user: "make sure things are visible").

**Fix.** Tuning, not architecture — in `engine/palette.ts`: lift `role.bayWall` / `role.bayFloor`
(day AND night palettes, all soil variants) by ~20-30% value, keeping hue; nudge
`light.hemiIntensity` up one step (~+0.1) so the hemisphere reaches into holes. Do NOT touch the
toon gradient. Iterate against screenshots until interior detail (wall/floor boundary, steps,
sump trough) reads at the standard overview framing in both themes.

**Acceptance.** two_man overview: floor, walls, and firing step are three distinguishable values;
night theme still darker than day but interior geometry legible.

---

## Phase 2 — Geometry honesty (voids, grades, harsh lines)

### R4. Corner voids on bare-earth (revetment: none) excavations — the "extra holes"

**Evidence.** `two_man` + revetment none: **black triangular wedges at the pit corners** at any
angle. Root cause: `pushBayBox` (`scene3d.ts:520-576`) tapers each wall's outer face along its own
axis only (`taperOuterFace`, `three-viewer.ts:538`), while the terrain hole envelope is expanded
by the taper on ALL sides (`scene3d.ts:305-308`) — nothing fills the flared corner between two
adjacent walls.

**Fix.** When `taperAmount > 0`, `pushBayBox` additionally emits **four corner posts**: boxes of
footprint `wallT × wallT` at each corner, same height/y as the walls, carrying BOTH tapers
(add optional `taperAxis2/taperSign2` to `Box3`; `buildPartInner` applies `taperOuterFace` twice —
the second call on the already-edited geometry composes correctly because each call moves only
verts on its own sign side, scaled by height fraction). The double-flared post fills the corner
void exactly (same formula both sides, so faces meet the adjacent walls' flares flush).

**Acceptance.** Revetment none, orbit 360°: no black gaps at any corner of rect / inverted-T /
L-shape bays. Add a `scene3d.test.ts` case: earth finish emits 4 corner parts per rectangular
bay with both taper fields set.

### R5. Pit mouths read too small — parapet bags overhang the lip

**Evidence.** two_man/bunker overviews: the inner bag course (bags are deliberately 1.08-1.1×
oversized + jittered) leans past the excavation edge, shadowing the mouth — the hole reads
cramped and partially "roofed" by bags.

**Fix.** Doctrinal AND visual: real emplacement keeps the spoil/berm back from the lip so dirt
doesn't rain in and the shelf takes elbows (ATP 3-21.8 / MCRP individual-protection guidance).
In `pushRing` (`scene3d.ts:492`), move each parapet wall outward by a fixed **0.3 ft berm
setback** (front/rear: ±z shift; sides: ±x). Terrain/ground frames are keyed off the hole, so
nothing else moves. Keep the 2D plan untouched (parapetW itself unchanged — this is placement,
not thickness).

**Acceptance.** Top-down screenshot: continuous strip of grass/apron visible between hole lip
and inner bag faces on all four sides; no bag overhangs the void.

### R6. No way down — rear entrances are sheer 4-ft drops ("lack a grade")

**Evidence.** All rect-family positions: the parapet + wall entrance gap opens onto a vertical
drop to the floor.

**Fix.** New part role `entryStep` (add to `BoxRole`, `ROLE_STAGE = 2`, both palettes). For
rect-family bays with `depth > 2.5` and a rear gap: emit 2-3 earth steps inside the gap,
descending from grade to floor — each a plain box (`finish: 'earth'`, dirt texture, `noOutline`
interior treatment in the renderer's role list), width `entranceGap * 0.8`, riser
`depth / (n+1)`, tread ~1.1 ft, hugging the rear wall line. Do NOT use `firingStep`/`platform`
roles (those render plank decks).

**Acceptance.** two_man/bunker/atgm: steps visible through the rear opening, tops progressing
grade → floor; steps appear at stage 2 in the scrubber.

### R7. Vehicle position: staircase → doctrinal ramp + level pan; berms read as planks

**Evidence.** `vehicle_hull_defilade`: (a) the drawn cut is a 6-tread staircase to full depth —
the vehicle would sit on stairs; FM 5-103 deliberate defilade is a **graded access ramp into a
LEVEL pan**; (b) the flanking `rampBerm` boxes render as crisp tan planks floating on the grass
(sharp box edges + parapet-tan color) — doctrine says spoil is *flattened*, and visually they
need a graded mound profile, not a lumber look.

**Fix (`scene3d.ts` vehicle branch ~227-284 + small renderer helper).**
- Add a `shearTopY(geometry, drop)` vertex helper next to `taperOuterFace` (same
  direct-vertex-edit style — see DECISIONS D20 for why not rotated extrudes): moves only
  top-face verts linearly along the box's depth so the top becomes a continuous grade.
  Emit ONE ramp box (top sheared from grade at the entry to `-depthEx` at ramp's end, length
  ≈ 55% of run) + ONE level pan box (flat top at `-depthEx`, remaining ~45%). Descriptor-side:
  reuse the taper fields or add `shearDrop?: number` on `Box3`; renderer applies it in the
  earth-box path. Keep `RELIEF_EXAGGERATION` and the terrain-hole envelope exactly as now.
- Berms: keep the two `rampBerm` parts but (i) apply the double taper (R4 fields) on both long
  faces so the cross-section is a trapezoid mound, (ii) recolor `role.rampBerm` in both palettes
  toward fresh-spoil brown (match `wornRing` family, clearly not bag-tan), (iii) keep their
  existing low height.

**Acceptance.** Side view: one continuous grade line entry→pan, flat pan floor ≥ 40% of run;
berms read as low brown graded spoil, not planks. Update `scene3d.test.ts` vehicle expectations
(tread count → ramp+pan parts).

### R8. Mortar pit: smooth "washer" parapet contradicts sandbag doctrine; no entrance

**Evidence.** `mortar_pit`: the parapet is one smooth extruded annulus (`buildRing`,
`three-viewer.ts:503-530`) — a plastic donut next to the bag-built rect positions, contradicting
this file's own "parapet is ALWAYS sandbags" contract (`scene3d.ts:13-14`). The ring is also
fully closed — no way in/out of a pit doctrine says crews enter constantly (ammo resupply).

**Fix.**
- Pure layout: add `bagRingLayout(innerR, outerR, height)` to `render3d/propLayout.ts` returning
  per-bag `{x, z, rotY, w, h, d}` — concentric radial rows (`(outerR-innerR)/cellD` rows),
  per-course bag count `max(6, round(2πr/cellW))`, tangential orientation
  (`rotY = azimuth + π/2`), alternate courses offset half a bag (running bond), same
  jitter/settle constants as `bagWallBond`. Unit-test it in `prop-layout.test.ts`
  (determinism, radii within band, count sanity).
- `SandbagBatcher.ring(...)` (`engine/bagInstancing.ts`) consumes that layout into the existing
  color-keyed batches (the batcher is already arbitrary-matrix).
- Viewer: `case 'ring'` with `role === 'parapet'` → `bags.ring(...)`; `buildRing` stays for the
  ground ring + low tier.
- Descriptor: leave a **rear opening sector (~55°, centered on +z)** in the parapet ring — add
  `gapStartDeg/gapEndDeg` to `Ring3`, honored by both `bagRingLayout` (skip bags in the sector)
  and `buildRing` (extrude an arc shape instead of a full annulus when a gap is present).

**Acceptance.** Mortar pit overview: circular bag courses with visible bond, uniform with the
rect parapets; a clear rear opening; cutaway still shows battered (frustum) pit wall.

### R9. Scale figure stands inside the L-arm trench

**Evidence.** `atgm_javelin` top-down + `fifty_cal` overview: the figure (placed at
`halfL + parapetW + 1.3`, `scene3d.ts:410-413`) lands on/in the +x side arm that l_shape
positions dig (arm spans `halfL … halfL+armLen`). Note **atgm_javelin IS l_shape**
(`doctrine/positions.ts:163`).

**Fix.** For `l_shape`, mirror the figure to the free side: `figureX = -(halfL + parapetW + 1.3)`
(arm is always +x in this descriptor). Everything else unchanged.

**Acceptance.** All 7 positions: both boots on grass, no earthwork intersection, label clear.

### R10. Bunker roof seals the position shut — keep the rear entrance open

**Evidence.** `bunker_op_cp` + overhead cover: the sandbag roof spans `hole + 2×setback` on all
sides (`scene3d.ts:354-368`), roofing over the rear entrance gap — the position has no opening
at all.

**Fix.** Trim the cover on the rear side only: shift the slab's z-center forward and shorten `d`
so the roof's rear edge stops at the rear excavation wall line (the dead-man setback stays on
the other three sides — bearing is unchanged where stringers land). Shorten the stringers to
match. Keep the label.

**Acceptance.** Cover on: visible open corridor at the rear under open sky, aligned with the
parapet/wall gap; stringer ends still bear on undisturbed ground (≥ setback) front/left/right.

---

## Phase 3 — Build-stage fidelity & rounding polish

### R11. Stages: mark → scrape → deepen → spoil story

Current stage scrubber jumps from empty field (0) straight to the full-depth hole (1); spoil
never exists before it becomes bags (4). `buildScene3D` already receives `opts.stage` — emit
stage-conditional parts (all pure, testable in `scene3d-stages.test.ts`):

- **Stage 0 (post security):** emit a **position trace** — four thin white marking-tape segments
  (0.05 ft tall boxes, new role `trace`, `toneMapped:false`-style bright in the renderer) on the
  hole outline, ONLY when `opts.stage === 0` (emit-time condition, not ROLE_STAGE filtering, so
  it disappears once digging starts). Doctrine: positions are traced/staked before digging.
- **Stage 1 (hasty):** dig to a **partial depth** — use
  `effDepth = max(1.7, 0.45 × depthOfCut)` for floor/walls/terrain holes when `opts.stage === 1`
  (rect family + circular; leave vehicle_ramp alone). The model then visibly deepens at stage 2
  — matching the hasty→deliberate labor split the schedule panel already teaches.
- **Stages 1-3: spoil piles** — two low double-tapered mounds (role `spoil`, fresh-dirt color)
  flanking the position, emitted only while `stage ∈ [1,3]`; they vanish at 4 exactly when the
  parapet bags appear (the spoil became the parapet). Rise-in animation works as-is.

**Acceptance.** Scrubbing 0→6 on two_man reads: tape outline → shallow scrape + spoil → full
depth + steps + spoil → revetment/sump + spoil → parapet (spoil gone) → cover → net.

### R12. Rounding: soften the excavation mouth

Terrain rect holes round corners at only 0.2 ft (`terrain.ts:69` and `offsetContour`) —
invisible at diorama scale; the mouth reads laser-cut. Raise rect-hole corner radius to
**0.45 ft** and grow the descriptor-side clearance `e` (`scene3d.ts:306-308`) from 0.05 to
0.15 so the rounded contour never cuts across the (square) wall-top corners. Verify no
wall/crust interpenetration at corners (top-down + orbit). Circular/poly holes unchanged
(poly offset math assumes rectilinear — do not round poly unions).

### R13. Parapet batter (optional, if time allows)

Real sandbag parapets are laid with a slight pyramidal batter (each course stepped in). In
`bagWallBond` (`render3d/propLayout.ts`), inset the outermost row of each course above the first
by ~6% of wall thickness per course on walls ≥ 2 rows deep. Subtle — verify it doesn't open
daylight between courses (the 1.08 oversize should still close it). Skip if it fights the bond.

---

## Execution notes for the Opus session

- **Order:** R1 → R2 → R3 first (biggest user-visible wins, independent of geometry work), then
  R4-R10 (each independent; R4 and R7 share the double-taper plumbing — do R4 first), then
  Phase 3.
- **Repo rules:** run `npm run verify` after each phase; every descriptor change needs its
  matching test updated in `test/scene3d*.test.ts` / `test/prop-layout.test.ts` (pure files —
  no Three.js in scene3d/propLayout, keep it that way). New `BoxRole` members must be added to
  BOTH palettes (`Record<BoxRole, number>` will type-error until they are — that's the guard).
- **Verify visually, not just by tests:** re-run the screenshot matrix from "How the audit was
  produced" (all 7 positions × overview; two_man/mortar/bunker × cutaway; two_man × stages
  0/1/2/4; vehicle side view; atgm top-down) and eyeball against the acceptance lines. Fresh
  `browser_navigate` after every source edit — stale-HMR is the #1 time sink in this repo.
- **Don't regress:** parapet height stays the computed doctrine height (no re-inflating); the
  vehicle berm stays LOW (FM 5-103 flattened-spoil rationale in the existing comment); labels,
  enemy arrow, and sector fan must survive every change (orientation aids are always-on).
