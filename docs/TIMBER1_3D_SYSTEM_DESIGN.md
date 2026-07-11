# TIMBER-1 — 3D System Design Document
**Wood-Frame Construction Assistant · Companion to SAP-1 · Doctrine: FM 5-426 (public release)**

This document fully specifies the 3D system before prompt-writing. Principle throughout:
**the 3D model is not an illustration of the answer — it IS the answer, rendered.**

---

## 1. Architecture: one geometry kernel, many consumers

```
Inputs (dropdowns) ──► ENGINE (pure TS)
                          │
                          ▼
                   FRAME MODEL  ◄── the single source of truth
                   Member[] + Stage[] + Connection[]
                          │
        ┌─────────────┬───┴────────┬─────────────┬──────────────┐
        ▼             ▼            ▼             ▼              ▼
   3D scene      2D drawings   Cut list /    Labor plan    Job sheet /
  (three.js)    (plan/elev/     BOM (by     (Table C-1     exports
                 section)      stage too)    by stage)
```

- The engine emits a **FrameModel**: an array of typed `Member` objects with exact
  3D placement, plus stage assignments and connection metadata. Nothing downstream
  invents geometry; the 3D scene, the 2D drawings, the BOM, and the labor plan are
  all *projections of the same array*. 2D and 3D can never disagree because neither
  is drawn by hand — both are generated.
- The engine stays pure and DOM-free (SAP-1 discipline). three.js appears only in
  the render layer.

### 1.1 Member data model (the atom of the whole tool)

```ts
interface Member {
  id: string;                    // stable: "stud-N-014", "rafter-L-03"
  role: MemberRole;              // sill|girder|post|joist|rimJoist|bridging|subfloor|
                                 // solePlate|stud|cripple|jackStud|kingStud|header|
                                 // topPlate|capPlate|brace|rafter|ridge|collarTie|
                                 // sheathingPanel|roofPanel|siding
  nominal: string;               // "2x4", "2x10", "6x8 built-up(3)", "4x8 panel"
  actual: {w:number; d:number};  // dressed inches (from FM 5-426 Table 2-1)
  cutLength: number;             // inches, exact (incl. angle allowances)
  angles?: {plumbCut?:number; seatCut?:number; miter?:number};
  position: [x:number,y:number,z:number];  // feet, building origin at front-left sill
  rotation: [rx:number,ry:number,rz:number];
  stage: StageId;                // which build stage owns it
  wall?: 'N'|'S'|'E'|'W';        // for wall members
  grade: string;                 // "No. 2 common" default per FM 5-426
  nailing: string;               // from doctrine, e.g. "2-16d toenail ea end"
  doctrineRef: string;           // page cite, e.g. "FM 5-426 Table 6-2, p.6-17"
  count?: number;                // for instanced identical members
}
```

Everything the user can ask about a piece of wood lives on the member. Selecting a
member in 3D, a line in the BOM, or a callout in 2D all resolve to the same `id`s.

### 1.2 Framing generators (engine modules, one per system)

- `foundation.ts` — posts/footers on FM 5-426 spacing (6–10 ft), sills (type selectable).
- `floor.ts` — girders sized by **Table 6-1** via the load-area method (§ dead/live
  allowances), joists sized/spaced by **Table 6-2**, rim joists, bridging rows
  (>8 ft one line, >16 ft two), subfloor panel layout with stagger.
- `walls.ts` — plates, studs @16" OC (24 option), corner posts (FM 5-426 3-stud TO
  pattern), openings from the door/window schedule → king/jack studs, headers,
  cripples, sills; let-in or cut-in bracing; double top plate with lapped corners.
- `roof.ts` — rafters computed by the framing-square method
  (len/ft-run = √(144+rise²)/12), ridge, bird's-mouth seat geometry, overhang,
  collar ties (≤5 ft apart / every 3rd rafter per manual), gable studs, roof panels.
- Every generator consumes only doctrine + inputs and returns `Member[]` — unit-testable
  with zero graphics.

---

## 2. Build stages — the core interaction

### 2.1 Stage list (FM 5-426 construction order)
1. **Layout & foundation** — batter boards ghost, posts/footers
2. **Sills & girders**
3. **Floor joists & bridging**
4. **Subfloor**
5. **Wall framing** — per-wall sub-steps (N/E/S/W raise order, TO panel method)
6. **Plates tied & braced**
7. **Ceiling joists** (if applicable)
8. **Rafters & ridge**
9. **Roof sheathing**
10. **Roofing** (roll roofing / shingles per input)
11. **Siding & exterior finish**

### 2.2 Stage scrubber behavior
- A horizontal timeline (numbered chips + drag scrubber). Selecting stage *k* shows
  members of stages ≤ k; current-stage members render solid + subtle highlight,
  earlier stages full material, later stages hidden (or 8%-opacity ghost toggle).
- **Stage panel** (side card): stage name & doctrine sequence note, member list for
  this stage, **materials for this stage only** (delta BOM), **man-hours for this
  stage** (Table C-1 rates × quantities), typical crew from Table C-1 notes, and
  running totals ("through stage 6: 412 BF, 61 MH").
- **Play** button animates stage-by-stage assembly (members fade/translate in,
  ~600 ms per stage, honoring `prefers-reduced-motion` → instant cuts).
- Stage state is part of app state: exports respect it ("print job sheet for
  stages 1–4" = the framing package you hand a crew today).

### 2.3 Why this matters doctrinally
FM 5-426 teaches sequence (layout → substructure → panels → roof). The scrubber makes
the manual's build order the tool's spine — junior Marines see *what gets built when*,
leaders see *what to order and staff per phase*.

---

## 3. Camera & view system

### 3.1 Standard views (one tap, animated ≤400 ms)
- **Iso NE / NW / SE / SW** (four corner isometrics)
- **Plan** (top orthographic)
- **Front / Rear / Left / Right elevations** (orthographic)
- **Section** — a draggable cut plane (X or Y), clipping the model live; the 2D
  section drawing is generated at the same plane position
- **Walk** (optional, desktop): low eye-height orbit for "standing inside" checks

### 3.2 Camera rules
- Orthographic camera for plan/elevation/section (drawings must not perspective-distort);
  perspective for isos/orbit.
- Orbit/pan/zoom: touch (1-finger orbit, 2-finger pan/pinch) and mouse; damped;
  auto-fit-to-model on load and on stage change (keeps growing building framed).
- North arrow + door-side marker fixed in a screen-corner gizmo; gizmo is also a
  clickable view cube (tap a face → that view).

### 3.3 2D/3D unification
The orthographic 2D drawings (SAP-1 visual system: header bars, numbered callouts,
single accent dimensions, legend) are generated by projecting the same FrameModel.
Dimension lines, callout anchor points, and section-cut positions are computed from
member bounding boxes. **Test-enforced:** a member count/size change reflects in both
renderers from one engine change.

---

## 4. Isolation, inspection, information layers

### 4.1 Selection & inspector
- Tap/click a member → highlight + **Member Card**: role, nominal & actual size,
  exact cut length (ft-in + angles: plumb/seat/miter), grade, nailing schedule,
  stage, count of identical members, and doctrine citation ("sized from Table 6-2,
  p. 6-17 — 2×10 @ 16″ OC, max span 15′-2″, your span 14′-0″ ✓"). The card includes
  a "show all identical" action.
- BOM ↔ 3D linkage: hover/tap a BOM row highlights those members; tap a member
  scrolls/flashes its BOM row. Same for stage-panel member lists.

### 4.2 Layer & filter system
- System toggles: Foundation · Floor · Walls (per-wall N/E/S/W sub-toggles) ·
  Roof structure · Sheathing/panels · Finish.
- Role filter ("only rafters", "only headers"), size filter ("everything cut from
  2×10 stock"), stage filter (combinable with scrubber).
- **Isolate mode:** selection stays solid; everything else 8% ghost. Esc/two-finger
  tap exits.
- **Exploded view:** systems translate apart vertically (foundation stays, floor +2 ft,
  walls +5 ft, roof +9 ft) with thin leader lines; slider controls explosion distance.

### 4.3 Information overlays (all individually toggleable)
- **Dimensions:** overall L×W×H, wall heights, opening sizes; smart placement
  (billboarded, screen-space min font, collision-avoided). Full member dimensions
  live in the Member Card, not floating in the scene — keeps the model readable.
- **Spacing tags:** "16″ OC" markers along stud/joist/rafter runs (one tag per run,
  not per member).
- **Labels:** role labels on hover/tap; optional persistent labels for teaching mode.
- **Cut-length heatmap** (nice-to-have): color members by stock length needed —
  instantly shows which walls need 12-footers.
- **Grid & ground:** 1-ft ground grid, toggleable.

---

## 5. Outputs the 3D system feeds

- **Cut list, by stage and by stock length:** members grouped (e.g., "2×4 × 92⅝″ —
  38 pcs — studs, walls N/S"), with a simple first-fit stock-length optimizer
  (waste factors from FM 5-426: +2% boards, +10% dimension lumber shown explicitly).
- **BOM:** lumber by size/length/BF, panels by count, nails by pounds (FM 5-426
  formulas), roofing squares — per stage and total.
- **Labor plan:** Table C-1 rates × generated quantities → MH per stage, crew
  suggestion, elapsed timeline for a given crew size (Gantt-style stage bar chart).
- **Job sheet:** masthead, iso snapshot of final + per-stage thumbnails, 2D drawings,
  cut list, BOM, labor plan, *Prepared by / Verified by* block. Table C-1-derived
  numbers footnoted "verify against pp. C-1–C-2" until the user marks them verified
  (Provenance status DOCTRINE-UNVERIFIED → DOCTRINE).

---

## 6. Performance engineering (rugged-tablet reality)

- **InstancedMesh per (role, nominal, cutLength) group** — a 20×40 building is
  ~600–900 members but only ~30–60 unique geometries → a handful of draw calls.
- BoxGeometry for members (framing lumber is boxes; rafters get a shear/rotate,
  bird's-mouth shown as a notch only in Member Card close-up, not scene geometry).
- No shadows by default (toggle for desktop); one hemisphere + one directional light;
  MeshLambert-class materials; antialias on, devicePixelRatio capped at 2.
- **Budgets (test-enforced):** model regen < 50 ms; scene rebuild < 100 ms;
  ≥ 30 fps orbit on mid hardware; draw calls < 100.
- Selection via GPU picking or raycast against instanced meshes with id lookup.
- **Fallback ladder:** WebGL2 → WebGL1 → **2D-only mode** (full tool minus 3D pane,
  clearly messaged). WebGL loss must never take down the calculators.
- three.js bundled locally (offline invariant); pinned version; no examples/CDN imports.

---

## 7. Tri-modal layout integration (SAP-1 pattern)

- **Mobile:** 3D pane full-width; stage scrubber as bottom chips; view switching via
  view-cube gizmo; Member Card as bottom sheet; layer toggles behind one filter
  button. Simplified overlays (dimensions off by default).
- **Tablet (primary):** split — controls left (collapsible), 3D center, stage panel
  right; scrubber under the viewport; glove-size hit targets; landscape-first.
- **Desktop:** three regions + persistent inspector; keyboard shortcuts
  (1–9 stages, P/F/L/I views, X explode, H isolate); comparison mode renders two
  FrameModels side-by-side with synced cameras.

---

## 8. Doctrine & safety posture

- All sizing flows from the FM 5-426 extract (public release) with page-cited
  Provenance — status **DOCTRINE**, except Table C-1 rows (DOCTRINE-UNVERIFIED
  until user spot-checks; banner reflects this smaller caveat, not SAP-1's full
  NOT-FOR-FIELD-USE regime).
- Validation: span exceeding Table 6-2 → error with the table row shown; girder
  load off Table 6-1's chart → "exceeds doctrinal table — engineer design required"
  (never extrapolate); load inputs outside the manual's allowances → warning.
- Standing disclaimer: TO construction per FM 5-426; occupied/permanent structures
  follow local building code and qualified review.

---

## 9. Testing additions specific to 3D

- **Model tests:** member counts/positions for golden configs (e.g., 20×40, 8-ft
  walls, gable ⅓ pitch → exact stud count per wall, joist count, rafter count);
  determinism (same inputs → identical Member[] ordering and values).
- **No-NaN scene test** across input fuzz (mirrors SAP-1's render.nan).
- **Stage integrity:** every member has a stage; union of stages = whole model;
  stage BOMs sum to total BOM exactly.
- **2D/3D consistency:** projected 2D outlines derive from the same member set
  (count parity test).
- **Performance smoke:** regen time + draw-call count asserted in CI-style test.
- **Fallback test:** WebGL unavailable → 2D mode renders, calculators fully work.

---

## 11. Interactive blueprints — readable by any Marine

Goal: a Lance Corporal who has never read a print can build from these. Two rules:
**plain language beats convention** wherever they conflict, and **every mark on the
drawing is tappable.**

### 11.1 Plain-language mode (default ON)
- Labels say what carpenters say: "TOP PLATE (doubled 2×4)", "KING STUD", "HEADER —
  two 2×10 on edge", not abstract symbols. A **Drafting mode** toggle switches to
  standard conventions (FM 5-426 Ch. 1 symbols) for those who want them; the legend
  updates to match.
- Dimensions render as carpenters read them: 7′-6″, with a long-press option that
  spells it out ("seven foot six").
- A tappable **glossary**: any framing term anywhere in the UI (labels, cards,
  validation messages) is tap-to-define with a thumbnail sketch. Terms and
  definitions come from FM 5-426's own vocabulary.

### 11.2 Everything is tappable
- **Tap a dimension** → the two points it measures between flash, with a
  "measure from / to" tag ("outside of sheathing → center of stud"). Kills the #1
  field ambiguity: what a number actually spans.
- **Tap a callout number** → the same Member Card as 3D (size, cut length, nailing,
  doctrine cite) + "show in 3D" jump that opens the model with that member isolated.
- **Tap a wall in the plan** → semantic zoom into that wall's framed elevation
  (progressive disclosure: overview plan → wall detail → opening detail). Back
  breadcrumb stays visible.
- **Tap an opening** → header size, king/jack/cripple layout, rough-opening
  dimensions labeled "RO" with plain meaning ("frame this hole 38½″ wide").

### 11.3 Semantic zoom (information reveals with zoom level)
- Zoomed out: outline, overall dims, wall labels, North/door markers only.
- Mid zoom: member callouts, spacing tags ("16″ OC"), opening ROs.
- Close zoom: individual cut lengths, nailing schedule tags, connection details.
- Density is capped at every level — labels collision-avoid and drop before they pile up.

### 11.4 Layout Strip view (the killer feature for crews)
A dedicated drawing per wall that renders **the plate as a tape measure**: the actual
layout marks a carpenter would pencil on the plate — X-marks at stud centers
(15¼″, 31¼″… for 16″ OC), K/J marks for king/jack studs at openings, C for cripples —
exactly like marking plates in the field. Printable as a strip. A crew can lay the
printout beside the plate and transfer marks. This single view converts the tool's
math into the physical act of framing.

### 11.5 Build-along mode (blueprint ⟷ stages)
- Drawings link to the stage scrubber: in build-along mode the drawing shows only
  the current stage's members bold, prior stages gray, with the stage's checklist
  beside it (each member/group has a checkbox; checking updates a progress ring).
- Progress state persists per scenario — a crew can pick up where they left off.
- "What's next" button advances stage and re-centers the drawing on the new work.

### 11.6 First-use readability aids
- A 30-second **"how to read this print"** coach-mark tour on first open (dismissible,
  re-openable from Help): points at the North arrow, a dimension, a callout, the
  legend, the scale bar.
- **Field cards export:** pocket-size (half-letter) per-wall print cards — wall
  elevation + layout strip + that wall's cut list — designed for a cargo pocket.
- High-contrast day theme, red-light night theme, minimum font sizes (SAP-1 tokens),
  and all interactions ≥44 px touch targets.

### 11.7 Tests added
- Tap-target coverage: every dimension, callout, and opening region has a hit area.
- Semantic-zoom density: label collision count = 0 at each zoom tier for golden configs.
- Layout Strip correctness: mark positions for 16″/24″ OC walls with openings match
  engine stud positions exactly (same Member[] source).
- Glossary coverage: every role/term used in labels resolves to a definition.
- Build-along integrity: checklist items map 1:1 to stage members; progress
  round-trips through save/load.

---

## 12. Build phasing (so it ships)

- **Phase A (core):** engine + FrameModel + floor/wall/roof generators + 3D scene +
  stages + standard views + plain-language blueprints w/ tappable callouts &
  dimensions + Layout Strip + BOM/cut list/labor. This is the usable tool.
- **Phase B:** isolation/inspector polish, exploded view, section plane, semantic
  zoom tiers, build-along checklists, field cards, comparison.
- **Phase C:** walk mode, heatmap, teaching labels, coach-mark tour, animation polish.
The master prompt will encode this as the triage order (SAP-1 §0 style).
