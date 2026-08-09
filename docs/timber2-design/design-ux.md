# TIMBER-2 UX DESIGN — Structure Picker + Workbench + View System

Role: UX designer deliverable for the TIMBER-2 plan. Wireframe-level specificity in words:
regions, controls, interactions, states, files. This document is written to the
`docs/SAP2_BLUEPRINT.md` quality bar: every judgment call is logged (D-UX-nn), every surface
has acceptance criteria, and the file layout is exact so implementing sessions need no
planner present.

Ground truth read before designing: `src/timber/{types,frame,floor,walls,roof,elevation,bom}.ts`,
`src/ui/{woodframe.html,woodframe-scene.ts,hub.html}`, `test/timber-*.test.ts`,
`docs/SAP2_BLUEPRINT.md`, `vite.config.ts` / `vite.woodframe.config.ts`, `package.json`.

Non-negotiables honored throughout: fully offline, zero external requests (build gate scans
dist), zero runtime deps beyond three.js, deterministic outputs, one toolkit deploy
(hub + `/woodframe.html` + `/survivability/`), picker images SELF-GENERATED and shipped as
FILES (the base64-inline OOM is a named never-again), doctrine cites carry the
"(PH) pending page verification" discipline, and — unlike SAP-2's ship-empty regime —
TIMBER ships working doctrinal defaults WITH cites. Life-safety items route through a named
review posture (§6.3).

---

## 0. Reading guide and vocabulary

- **Picker** — the landing view of the woodframe sub-app: the grouped card catalog.
- **Workbench** — the per-structure screen: config panel (left), 3D viewport (center),
  inspect panel (right), toolbar (views / stages / cutaway), strips + print surfaces below.
- **Structure** — a catalog entry (SEA hut, guard tower, ...) or a Custom build. Each
  structure resolves to a config (a superset of today's `BuildingInput`) fed to the engine.
- **Config** — the user-editable parameter object for one structure. Persisted per
  structure (§5). The engine call `generateStructure(structureId, config)` returns the
  `Member[]` model every pane projects from (engine team owns the signature; UX contract
  in §7).
- **Field lock** — per-field state on standard designs: `locked` (doctrinal, read-only,
  shows value + why), `preset` (editable, shows standard badge), `free`.
- **PH** — the existing cite discipline: "(PH) pending page verification" against FM 5-426
  and the wider TO canon. TIMBER-2 UX renders PH as a visible badge, never hides it.
- **Issue** — a validation result from `validateStructure` with severity
  `block | warn | note` (§6.2, contract in §7).

House style carried forward (do not reinvent): warm paper palette (`#f4f2ec` page,
`#fbf9f4` cards, `#2b2419` ink, `#6b6250` secondary, `#c9c0ad`/`#ddd6c8` borders),
system-ui font, 12–13 px UI text, chip buttons (`button.chip`, `.on` inverts), plain-language
line first and the carpenter's term second (the existing `PLAIN`/`WHAT` maps pattern in
`woodframe-scene.ts`).

---

## 1. Information architecture and navigation

### 1.1 One page, hash-routed (D-UX-1)

TIMBER-2 stays a single deployed page at `/woodframe.html` (bookmarks, the hub card link,
and `vite.woodframe.config.ts` entry all survive unchanged). Inside it, a two-view app
shell driven by the URL hash:

| Route | View | Notes |
|---|---|---|
| `#/` (or empty hash) | Structure picker | Default on load |
| `#/build/<structureId>` | Workbench for that structure | e.g. `#/build/sea-hut`, `#/build/custom-1` |
| `#/build/<structureId>?c=<base64url>` | Workbench with an imported config | Sharing path, §5.4 |

Why hash routing and not one HTML page per structure: three.js loads once; switching
structures never reloads the bundle; browser Back/Forward walk picker <-> workbench for
free; `file://` and any static host work identically; configs move between views in memory,
not through storage handoffs. A tiny hand-rolled router (`router.ts`, ~60 lines: parse
hash, notify subscribers, `push`/`replace` helpers) — no dependency.

Unknown structure id in the hash → picker view + inline notice card "No structure named
`<id>` — pick one below." (never a blank page, never a throw; the errorBoundary.ts pattern
stays the outermost net).

### 1.2 The back chain — nobody is ever stranded (D-UX-2)

```
hub.html  ──card──▶  #/ (picker)  ──card──▶  #/build/sea-hut (workbench)
   ▲                    ▲   ▲                       │
   │ "Combat Engineer   │   └── "◀ Structures" ─────┘   (NEW: picker-level back)
   │  Toolkit" link     │
   └────────────────────┴── hub glyph link, present in BOTH views (existing pattern)
```

- **Hub → picker**: the existing hub card (`hub.html`) keeps `href="./woodframe.html"`.
  Card copy updates (§8, `hub.html`): tag `TIMBER-2`, body "Structure library: guard
  towers, huts and quarters, hasty frames, bunkers — pick a standard design or start a
  custom build. Every piece framed member-by-member with stages, cut lists, and cutaways."
- **Picker → hub**: header link (the existing `⌂ Combat Engineer Toolkit` glyph link,
  top-right) is retained verbatim.
- **Workbench → picker**: NEW explicit back button, leftmost in the workbench header:
  `◀ Structures` (44 px min touch target). This is the brief's required picker-level
  back. It navigates to `#/` via `history.back()` when the previous entry is the picker,
  else `router.push('#/')` — so browser Back and the button never fight.
- **Workbench → hub**: the hub glyph link remains in the workbench header too (both
  escape levels always visible).
- Browser Back always works because every view change is a hash history entry.
- **No confirm-on-back dialogs, ever.** Back is always safe because config persistence is
  continuous (§5.1). Nothing is ever lost by navigating, so nothing needs a guard. The
  only destructive acts are explicit (Reset to standard, Delete build) and those get
  inline confirm popovers at the point of action, not on navigation.

### 1.3 Focus management on route change

- Picker → workbench: focus moves to the workbench `<h1>` (structure name,
  `tabindex="-1"`), screen reader announces "SEA hut — workbench".
- Workbench → picker: focus returns to the card that launched the structure (store the
  card id before navigating; if gone — e.g. a deleted custom — focus the picker heading).
- Route changes set `document.title`: "TIMBER-2 — Structures" / "TIMBER-2 — SEA hut".

---

## 2. THE STRUCTURE PICKER (`#/`)

### 2.1 Regions (desktop ≥ 900 px)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ HEADER  TIMBER-2 — Wood-frame construction          [⌂ Combat Eng Toolkit] │
│         sub: "Pick a structure to frame it piece by piece · FM 5-426 and   │
│         the TO construction canon · cites (PH) pending page verification"  │
├────────────────────────────────────────────────────────────────────────────┤
│ CONTROL ROW  [Filter structures… /]  Jump: [Towers][Huts][Hasty][Defense]  │
│              [Custom]   ·   [Import build file]  [Start custom]            │
├────────────────────────────────────────────────────────────────────────────┤
│ RESUME STRIP (only when a session exists)                                  │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │ ▸ Continue where you left off: SEA hut · 16×32 · edited 5 min ago     │  │
│ │   [Resume]                                    [smaller: Discard]      │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│ GUARD TOWERS — "Elevated posts: platform, rails, ladder or stair, braced   │
│ legs." (family intro line, one sentence, recruit language)                 │
│ ┌─────────┐ ┌─────────┐                                                    │
│ │ [thumb] │ │ [thumb] │   ...cards, grid auto-fill minmax(250px,1fr)...    │
│ │ Name    │ │ Name    │                                                    │
│ │ oneliner│ │ oneliner│                                                    │
│ │ TAG (PH)│ │ TAG (PH)│                                                    │
│ └─────────┘ └─────────┘                                                    │
│ HUTS & QUARTERS — ...                                                      │
│   [SEA hut] [SWA/B-hut] [Guard shack] [Small frame house] [...]            │
│ HASTY & EXPEDIENT — ...                                                    │
│   [Strongback tent frame] [Storage shed] [Field latrine] [...]             │
│ DEFENSIVE WORKS — ...                                                      │
│   [Timber bunker] [...]                                                    │
│ YOUR BUILDS (only when ≥1 custom exists)                                   │
│   [Custom — based on SEA hut] [My tower mod] ...   (overflow: ⋯ menu)      │
│ START FROM NOTHING                                                         │
│   [Custom build — dashed card]                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ FOOTER  TO construction per FM 5-426 (public release) · life-safety        │
│ register link (§6.3) · occupied/permanent structures follow local code     │
└────────────────────────────────────────────────────────────────────────────┘
```

Family order follows the owner's mandate order: Guard Towers, Huts & Quarters, Hasty &
Expedient, Defensive Works, then Your Builds, then Start From Nothing (D-UX-3). The
Custom card sits LAST with distinct dashed styling (standards-first teaches doctrine;
recruits should not default to custom), but Custom is never buried: it also has a
persistent `[Start custom]` text button in the control row and a `[Custom]` jump chip.

The picker renders entirely from the catalog module (`src/timber/catalog.ts`, contract
§7.2). The UX imposes layout and behavior; the catalog owns the entry list. The family
list above is the reference enumeration this design was sized against — the catalog
designer's enumeration governs final contents.

### 2.2 Card anatomy (exact)

Card = `<a class="card structure" href="#/build/<id>">` — a real link (middle-click,
copy-link, keyboard focus, history all free). Dimensions: grid cell from
`repeat(auto-fill, minmax(250px, 1fr))`, max width ~340 px; the hub's card visual language
(border `#c9c0ad`, radius 14 px, background `#fbf9f4`, hover: ink border + shadow lift).

Top to bottom inside the card:

1. **Thumbnail** — fixed 4:3 box (`aspect-ratio: 4/3`, full card width), background
   `#f4f2ec`, bottom border hairline. Content: `<img src="./thumbs/<id>.svg" alt=""
   loading="lazy">` (decorative; the card text is the accessible name). Self-generated
   line-art render, §2.3.
2. **Name** — 16 px semibold. Plain-language-first per house style: "Guard tower" not
   "Tower, observation, timber, Type II".
3. **One-liner** — 12.5 px, max 2 lines (`-webkit-line-clamp: 2`), recruit language,
   states what it IS and what it is FOR: "Screened sleeping hut on posts — the standard
   hot-climate troop billet."
4. **Doctrine tag row** — 11 px uppercase secondary color:
   `FM 5-426 + SEA-HUT STD DWG (PH)` plus meta chips in the same row, plain text
   separated by middots: `16×32 ft · 1 story · gable`. The default footprint shown is the
   catalog default config's footprint (never hand-typed — derived at build time by the
   thumbnail generator and emitted into the catalog metadata check, §9 T-UX-4).
5. **Badge slot** (top-right overlay on thumbnail): `SAVED CHANGES` pill when a persisted
   config differs from the structure default (§5.2), so the picker tells you which
   structures you have touched.

Custom card differences: dashed border (`border-style: dashed`, hub ghost-card language),
thumbnail is a static inline SVG (drafting grid + bare sill rectangle — shipped as
`thumbs/custom.svg`, generated like the rest but from the minimal 12×8 start frame),
name "Custom build", one-liner "Start from a bare rectangle and choose everything —
footprint, stories, roof, every opening, every system." Tag row:
`YOU SET EVERY VALUE · CITES SHOWN PER MEMBER`.

"Your builds" cards (saved customs, §5.3): same anatomy; thumbnail is the custom.svg
placeholder (runtime-rendered thumbnails are a flagged stretch, §10 S-2); name is the
user's slot name; tag row `CUSTOM · MODIFIED FROM <base>` when seeded from a standard.
Overflow `⋯` button (top-right, 32 px hit area) → menu: Rename, Duplicate, Export file,
Delete (Delete gets an inline confirm popover: "Deletes 'My tower mod'. This cannot be
undone. [Delete] [Cancel]").

### 2.3 Self-generated thumbnails (deployment-constraint compliant) (D-UX-4)

- **Mechanism**: build-time script `scripts/gen-thumbs.ts` (new). For every catalog entry
  it runs the real engine (`generateStructure(id, catalogDefaultConfig)`), projects
  `Member[]` to a fixed axonometric view (the Iso SE angle the viewer defaults to), sorts
  faces painter's-order by depth, and emits flat-shaded SVG line art (3 fills: lumber
  face `#e8dcc0`, shadow face `#cdbf9d`, concrete `#a9a69f`; hairline `#2b2419` strokes)
  to `public/thumbs/<id>.svg`. Pure node, no GL, no DOM — the same projection discipline
  as `elevation.ts` (2D is a projection of the one Member[], nothing hand-drawn).
- **Why SVG, not PNG renders**: deterministic byte output (testable, §9 T-UX-3), ~5–30 KB
  per structure, sharp at any DPI, zero headless-GL machinery in CI.
- **Ships as files**: `public/` is copied into dist as real files (`vite` publicDir is
  already wired). NO base64 inlining of thumbnails — the vite config's
  `assetsInlineLimit` applies to imported assets, and thumbnails are deliberately
  referenced by URL from HTML, not imported, so they can never be folded into the JS
  bundle. This is the named guard against the previous inline-OOM incident.
- **Drift gate**: `test/timber-thumbs.test.ts` regenerates all thumbnails to a temp dir
  and byte-compares against `public/thumbs/` — a catalog default change without a
  thumbnail regen fails CI ("run `npm run gen:thumbs`"). Also asserts every catalog id
  has a thumb and every thumb has a catalog id (no orphans).
- **Runtime fallback**: `onerror` on the `<img>` swaps in a shared inline placeholder SVG
  (bare gable outline) so a corrupted deploy never shows a broken-image icon. The offline
  gate already guarantees the file is local.

### 2.4 Filter and jump behavior

- **Filter input** (`<input type="search">`, placeholder "Filter structures…", left of
  control row). Filters on name + one-liner + family + tag, case-insensitive substring.
  Live as you type; family sections with zero matches collapse to their heading with
  "no matches" muted text; a global zero-match state shows "Nothing matches
  '<q>'. [Clear filter] — or [Start custom]." Keyboard `/` focuses it from anywhere in
  the picker (unless a text field already has focus); `Esc` clears then returns focus to
  the grid.
- **Jump chips**: one chip per family + Custom. Click scrolls the section heading into
  view (`scrollIntoView`, respecting `prefers-reduced-motion` → instant). Chips are
  `<a href="#family-towers">`-style in-page anchors so they work with no JS too.
- **Import build file** text button: opens a file input (`.json,.timber.json`), §5.4.
  The whole picker is also a drop target (drag a build file anywhere onto it; a dashed
  overlay "Drop build file to open" appears during dragover).

### 2.5 Keyboard behavior (picker)

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Natural order: header link → control row → resume strip → cards in DOM order → footer |
| `Arrow keys` | Roving focus across cards, row-aware (Left/Right = prev/next card, Up/Down = same column previous/next row, computed from bounding boxes) |
| `Enter` | Open focused card (native link behavior) |
| `/` | Focus filter |
| `Esc` | Clear filter / exit filter focus |
| `Home` / `End` | First / last card |

Cards get a visible focus ring: `outline: 2px solid #2b2419; outline-offset: 2px`
(the current stylesheet has no focus styles — this design adds them globally for chips,
cards, and controls; §8 `timber.css`).

### 2.6 Mobile behavior (picker, < 700 px)

- Control row wraps: filter full-width on its own line; jump chips become one
  horizontally scrollable row (momentum scroll, no scrollbar chrome).
- Cards switch to horizontal layout: thumbnail left at 96×72, text right; one column.
  This keeps ~4 cards per viewport instead of 1.5 and shortens the scroll to Custom.
- Family headings are sticky (`position: sticky; top: 0`) with the paper background so
  you always know which family you are in.
- Resume strip stays at top, condensed to one line + Resume button.
- Touch targets: whole card is the target; the `⋯` overflow on Your Builds cards is
  44×44.

### 2.7 Picker states

- **First run** (no session): no resume strip. Nothing else special — the catalog is the
  content; no empty state exists because the catalog always ships populated.
- **Resume strip**: shown when `store.lastActive` exists. "Resume" navigates to
  `#/build/<lastActiveId>`. "Discard" clears ONLY the last-active pointer (not the saved
  configs) — copy: "Hides this strip. Your saved changes stay on each structure."
- **Import errors**: file fails schema/version validation → toast-style inline banner
  under the control row, plain language: "That file isn't a TIMBER build file (missing
  `timber2` marker)." / "Made with a newer TIMBER (file v3, this app reads v1) — update
  the toolkit deploy to open it." Banner has [Dismiss]. Never a thrown error, never a
  silent no-op.

---

## 3. THE WORKBENCH (`#/build/<structureId>`)

### 3.1 Regions (desktop ≥ 1100 px)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ HEADER [◀ Structures] SEA hut · HUTS & QUARTERS   FM 5-426+STD DWG (PH)       │
│        [Reset to standard] [Export ▾]                 [⌂ Combat Eng Toolkit]  │
├───────────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR VIEW [Iso NE][Iso NW][Iso SE][Iso SW][Plan][Front][Right][Rear][Left] │
│         │ family presets: [Interior][Gable end]                               │
│         STAGE [◀][1][2][3][4][5][6][7][8][9][10][11][▶][All]                  │
│         CUTAWAY [Off][E–W][N–S][Level] depth ────●──── 8'0 from front [Flip]  │
│                 presets: [Section A–A][Long section]                          │
├──────────────┬──────────────────────────────────────────────┬─────────────────┤
│ CONFIG PANEL │                                              │ INSPECT PANEL   │
│ (360px,      │              3D VIEWPORT                     │ (340px)         │
│ scrollable)  │   (canvas, click = member card,              │ ┌─────────────┐ │
│              │    drag = orbit, wheel = zoom)               │ │ MEMBER CARD │ │
│ ▸ 1 Shape    │                                              │ └─────────────┘ │
│ ▸ 2 Openings │   [validation banner docks here, §6.2]       │ Stage 8: Rafters│
│ ▸ 3 Systems  │   [regen shimmer docks here, §6.5]           │ & ridge         │
│ ▸ 4 Fine     │                                              │ stage note ·    │
│   detail     │                                              │ cut list table  │
├──────────────┴──────────────────────────────────────────────┴─────────────────┤
│ STRIPS  Plate layout strips (per wall, SVG, tappable marks — existing)        │
│ PRINT SURFACES (§4.5): links duplicated from Export menu for discoverability  │
│ FOOTER  doctrine line · life-safety register link                             │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Config panel left, inspect right (D-UX-5): config→viewport reads left-to-right as
  cause→effect; the inspect panel keeps its current position and content from
  `woodframe-scene.ts` (member card, stage title/note, per-stage cut list) so TIMBER-1
  users keep their bearings.
- The toolbar stays a top toolbar (existing pattern) but becomes three labeled clusters
  with wrap; on narrow widths each cluster is horizontally scrollable (§3.7).
- The config panel is collapsible: a `[⟨]` handle at its top edge collapses it to a 40 px
  rail (icons for levels 1–4); state persisted per device (§5.1 viewState). Viewport
  takes the freed width.

### 3.2 Header (workbench)

Left to right:
1. `◀ Structures` back button (§1.2).
2. Structure name (h1) + family tag (11 px uppercase). For a modified standard:
   name + amber dot; for customs: editable name (click-to-edit inline input, saved on
   blur/Enter, Esc cancels).
3. Doctrine tag with PH badge — click opens the doctrine popover (§6.1) explaining the
   cite and the PH discipline.
4. Spacer.
5. `Reset to standard` (only for standard structures with modifications; hidden on
   pristine standards and on customs). Inline confirm popover: "Replaces your changes to
   SEA hut with the standard values. Other structures are untouched. [Reset] [Cancel]".
6. `Export ▾` menu (§4.5).
7. Hub glyph link.

### 3.3 Config panel — progressive disclosure

Four accordion sections. Section header = level number + plain name + live one-line
summary of current state + chevron. Level 1 open on first visit; open/closed state
persists per structure (§5.1). Opening deeper levels is NEVER required for a valid
building — every field has a working doctrinal default (the ship-with-defaults boundary,
§6.3). Multiple sections may be open at once (it is a scrollable column, not an
exclusive accordion) (D-UX-6).

Section headers when closed carry the state so the panel reads as a spec sheet:

```
▸ 1 · SHAPE        16 × 32 ft · 1 story · 8 ft walls · gable 4:12 · 1 ft eaves
▸ 2 · OPENINGS     2 doors · 6 windows · 4 screen bays        [amber dot if warns]
▸ 3 · SYSTEMS      post foundation · metal roof · board siding · entry stair
▸ 4 · FINE DETAIL  studs 24" oc · joists 16" oc · headers auto
```

Every control follows one row template: **plain-language label (term)** on the first
line, control on the second, helper/cite line in 11 px secondary underneath, optional
lock/badge at the row's right edge. Controls are shared widgets from `controls.ts` (§8):
stepper, segmented, radio-card, slider, select, toggle — all real form elements,
labeled, keyboard-operable.

#### Level 1 — SHAPE (basics)

| Field | Control | Details |
|---|---|---|
| How long (Length) | Stepper (number input + [−][+]) | ft, step 1, typed values allowed to 0.5; bounds from catalog/engine (custom: 8–60). Helper: "Measured along the front wall." |
| How wide (Width) | Stepper | ft, step 1; bounds (custom: 8–32). Helper: "Front-to-back. Joists span this way — spans past the table limit need a girder line (added automatically, see Fine detail)." |
| Stories | Segmented `[1][2]` | Only shown when the family supports it (catalog `maxStories`). Towers replace this row with "Platform height" stepper (ft, catalog bounds, e.g. 10–35) — the panel schema is per-family (§7.2), same widget set. |
| Wall height (per story) | Stepper | ft, step 0.5, default 8. Two-story shows one stepper per story ("Ground story", "Upper story"). |
| Roof shape (family) | Radio-card row | One 64 px card per family the structure supports: mini SVG profile icon + name (Gable / Shed / Hip / Flat — engine team owns which exist; the row renders whatever the catalog offers). Selected card ink-inverted. |
| Roof steepness (Pitch) | Slider + readout | 0–12 in 0.5 steps, detents at doctrinal pitches (catalog), readout "4:12 — rises 4 inches per foot". Disabled with reason when roof = flat ("Flat roofs slope 1/4 in/ft to drain — set by doctrine (PH)"). Regeneration on release, ghost preview while dragging (§6.5). |
| Eave overhang | Stepper | ft, 0–2, step 0.25. |

#### Level 2 — OPENINGS (the editor)

The largest control surface; deserves its own wireframe:

```
┌ 2 · OPENINGS ──────────────────────────────────────────────┐
│  MINI-PLAN (SVG, top view)                                 │
│      ┌────────N────────┐     tap a wall to select it       │
│    W │    (badges: N:1)│ E   selected wall = ink outline   │
│      └───────S──────── ┘     openings shown as gaps        │
│                                                            │
│  WALL TABS  [Front (S) ●2] [Right (E)] [Rear (N) ●1]       │
│             [Left (W)]                                     │
│                                                            │
│  ELEVATION STRIP (SVG, of the selected wall)               │
│  ┌──────────────────────────────────────────────┐          │
│  │ ▯ studs faint · openings as rects · drag to  │          │
│  │ move (snaps 1") · tap to select · red ghost  │          │
│  │ where a drop would be invalid                │          │
│  └──────────────────────────────────────────────┘          │
│                                                            │
│  ┌ OPENING ROW ────────────────────────────────┐           │
│  │ ▤ Door 1 — personnel                    [⋯] │           │
│  │ Kind      [Door — personnel ▾]              │           │
│  │ Size      [3'0 × 6'8 — standard (PH) ▾]     │           │
│  │           (Custom… reveals W/H steppers, in)│           │
│  │ From left [ 13'0 ] ft-in stepper            │           │
│  │ Sill      — (doors sit on the floor)        │           │
│  │ status: ✓ clear · header 2x6 dbl (auto)     │           │
│  └─────────────────────────────────────────────┘           │
│  ┌ OPENING ROW ─ Window 1 … Sill [ 3'0 ] ─────┐            │
│  └─────────────────────────────────────────────┘           │
│  [+ Add opening ▾]  (menu: Door — personnel / Door —       │
│    double / Window / Vent / Screen bay …structure-aware)   │
│                                                            │
│  SUMMARY  This wall: 1 door · 1 window.                    │
│           Building: 2 doors · 6 windows · 4 screen bays.   │
└────────────────────────────────────────────────────────────┘
```

Behavior spec:

- **Wall tabs**: segmented control, count badge per wall. Wall naming is
  plain-language-first with the compass second — "Front (S)" — matching the existing
  strips labels ("South (front)").
- **Mini-plan**: 120 px tall SVG derived from the config (not hand-drawn): rectangle,
  wall thickness exaggerated 2×, openings as gaps, selected wall ink-stroked. Click a
  wall = select. Redundant with tabs by design (spatial + labeled).
- **Elevation strip**: rendered from `wallElevation()` of the CURRENT engine model —
  studs/kings/jacks/cripples as faint rects, openings as labeled rectangles. This is the
  live-validation surface: dragging an opening horizontally previews the move with 1"
  snap; a drop position that fails validation renders the rect red-dashed and snaps back
  on release with the issue message toast. Drag never regenerates mid-gesture; release
  regenerates (§6.5). Tap selects the opening (scrolls its row into view, highlights the
  members in 3D via the existing selection tint).
- **Opening row**: card per opening, sorted by offset (no manual reorder — position IS
  order). Fields:
  - Kind: select. Options come from the catalog per structure (Door — personnel; Door —
    double; Window — hinged; Window — fixed screen; Vent — gable; Vent — crawl; Screen
    bay (SEA hut full-bay screen); Hatch (tower platform)). Changing kind re-defaults
    size/sill to the kind's standard.
  - Size: select of standard sizes for the kind, each labeled "3'0 × 6'8 — standard
    (PH)"; last option "Custom…" reveals Width and Height steppers in inches (step 1",
    bounds engine-validated). Standard-first teaches the doctrinal sizes; custom is one
    step away (mirrors the whole app's standard/custom philosophy).
  - From left (Offset): ft-in stepper (accepts `13'6`, `13.5`, `162"` — one parser in
    `controls.ts`, always displayed as ft-in). Helper: "Measured from the wall's left
    end, seen from OUTSIDE — same as the layout strips."
  - Sill height: stepper, inches, hidden for door kinds (replaced by the muted line
    "Doors sit on the floor — no sill"); for vents/windows bounds-checked (a sill so low
    it kills the below-sill cripples is the engine's known guard — the UI surfaces it as
    a note, not silence).
  - Header: read-only line "header 2x6 doubled (auto — spans to 4'0, Table 6-x PH)" with
    override in Level 4 (§Level-4). Kept out of Level 2 to keep the common path simple.
  - Row status line: validation state for THIS opening (§6.2): `✓ clear`, or the warn/
    block message with a fix-it action ("Move left 1'3 to clear the door" — applies the
    computed nearest-valid offset).
  - `⋯` menu: Duplicate (adds at nearest clear spot right), Delete (immediate, with
    5-second undo toast "Removed Window 2 — [Undo]"; no confirm dialog for a single
    undoable row) (D-UX-7).
- **Add opening**: button opens a kind menu (structure-aware). On add: placed at the
  midpoint of the largest clear run on the selected wall (computed against current
  openings), selected, row scrolled into view, 3D highlights the new framed bay. If NO
  clear run fits the kind's standard size, the menu item is disabled with reason
  ("No room left on this wall — 2'8 clear needed").
- **Counts summary**: sticky at section bottom while Level 2 is open. Counts are
  engine-derived (openings array + kind), rendered as plain text with middots. Building
  count includes per-kind totals; clicking a count cycles selection through those
  openings.

#### Level 3 — SYSTEMS

| Group | Field | Control | Details |
|---|---|---|---|
| Foundation | Type | Radio-cards | Options per family from catalog: Piers / Continuous wall / Basement (house family — existing engine); Posts-in-ground (tower, SEA hut); Skids (guard shack, hasty). Each card: mini section icon + one-liner ("Posts on concrete pads — the TO expedient"). Sub-fields appear under the selected card: Crawl height stepper (piers), Basement depth stepper + Basement stair toggle (basement — existing engine options). |
| Floor | Bridging | Segmented [Cross][Solid] | Existing option, existing copy. |
| Roof covering | Covering | Select | None — frame only / Sheathing only / Corrugated metal / Roll roofing / Wood shingles (options per catalog; each labeled with its doctrinal context, e.g. "Corrugated metal — standard TO roofing (PH)"). Helper notes underlayment when applicable. |
| Wall covering | Siding | Select | None / Sheathing only / Board siding / Plywood / Screen upper + board lower (SEA hut signature). |
| Access | Entry stair | Toggle + auto note | "Stair is laid out from the floor height automatically — <n> risers @ <h>". Tower family swaps this group for: Ladder vs Stair segmented, Landing toggle. |
| Access | Railings | Toggle + locked height | Railing height renders as a LOCKED value row "42 in — life-safety (PH)" with the shield glyph (§6.3). On platform structures (towers) the toggle itself is locked ON: "Platforms over 30 in get rails. Locked — life-safety." |
| Extras | per-family flags | Toggles | From catalog featureFlags: Attic hatch (existing), Gable vents pair, Splinter shielding (bunker), etc. Each toggle carries its own cite helper. |

#### Level 4 — FINE DETAIL

| Field | Control | Details |
|---|---|---|
| Stud spacing | Segmented [16"][24"] | Doctrinal default starred per family (huts 24, house 16 — catalog decides); helper cites the table (PH). |
| Joist spacing | Segmented [16"][24"] | Same pattern. |
| Rafter spacing | Segmented [16"][24"] | Same pattern. |
| Header sizing | Table (read-only + per-row override select) | One row per opening: "Door 1 · span 3'0 · AUTO 2x6 dbl (Table 6-x PH) · [Auto ▾]" — override select offers 2x4..2x12 dbl; choosing an undersized header for the span is a BLOCK issue with the table cite. |
| Member sizing display | Read-only rows | "Girder: built-up 3-2x10 (fixed, load-area method pending — PH)", "Joists: 2x8 (span check pending — PH)", "Collar ties: every 3rd rafter (PH)" — the how-it-was-sized explain surface; each row's cite opens the doctrine popover. These become live selects only when the engine grows its sizing tables (the UI renders whatever the panel schema marks editable). |
| Nailing | Toggle "Show nailing on member cards" (default ON) + link "Nail schedule sheet" | Link jumps to the print surface (§4.5). |

### 3.4 Custom vs standard — the lock system (D-UX-8)

- **Custom structure** (`custom` and Your-Builds slots): every field above is `free`.
  Starts from the minimal valid frame (12×8 × 8 ft walls, gable 4:12, piers, no
  openings) so "start from nothing" is literal but never broken. The empty-state coach
  stack guides the first three moves (§6.4).
- **Standard structure**: the catalog marks each field `locked | preset | free`:
  - `locked` — read-only row: value + lock glyph. Click/tap or focus+Enter opens the WHY
    popover: one plain sentence + the cite. Example (SEA hut width): "SEA huts are 16 ft
    wide so standard trusses and screen bays fit the standard drawings. — SEA-hut std
    drawing / FM 5-426 (PH page verification)." Locked rows are in the tab order (they
    are disclosure buttons, not dead text) — a recruit can interrogate every locked
    number.
  - `preset` — editable control showing a `STD` badge with the standard value ("STD
    4:12"). When changed, the badge becomes a `↺ std` reset affordance on that row.
  - `free` — plain control.
- **The escape hatch**: bottom of the config panel on every standard structure:
  `[Unlock everything — copy to a custom build]`. Creates a Your-Builds slot seeded with
  the standard's FULL config, navigates to it, names it "Custom — based on SEA hut". The
  original standard remains untouched. The new build's doctrine tag honestly downgrades:
  `CUSTOM · MODIFIED FROM SEA HUT — cites apply per member, not to the whole design`.
  This is the reconciliation of mandate #6 ("minute control ... type of everything")
  with doctrinal standards: standards stay true to their drawings; total freedom is one
  explicit, labeled step away, and the label travels into every export (§4.5 title
  blocks).

### 3.5 Regeneration loop

Single source of truth loop, unchanged in spirit from `woodframe-scene.ts`:
`config change → validateStructure → (issues gate, §6.2) → generateStructure → MODEL →
all panes re-project` (3D group rebuild, inspect panel, strips, mini-plan, elevation
strip, summaries). Debounce: steppers/typed input 200 ms after last change; sliders and
elevation-strip drags regenerate on release only. Double-buffered scene swap (§6.5) so
the canvas never blanks.

### 3.6 Two-story and tower notes (panel schema, not bespoke UI)

The workbench renders a per-family **panel schema** (§7.2). No family gets custom
layout code; families differ only in which rows exist, their bounds, locks, and labels.
Named examples the schema must express (acceptance §9):
- Tower: no Stories row; Platform height stepper; Ladder/Stair choice; railing locked
  ON; family camera presets (§4.2); cut presets (§4.4).
- Two-story house: per-story wall height steppers; stair REQUIRED between stories
  (toggle locked ON with why); openings editor gains a story switcher segment
  `[Ground][Upper]` above the wall tabs (same editor, filtered per story).
- Strongback tent frame: no siding group (covering = canvas, locked); openings limited
  to end doors.

### 3.7 Responsive workbench

- **≥ 1100 px**: three panes as wireframed.
- **700–1100 px**: inspect panel folds into a right-edge tab strip; tapping `Member` /
  `Stage` slides it over the viewport (does not push layout). Config panel stays, at
  320 px, collapsible.
- **< 700 px (mobile)**: single column. Order: header, toolbar (each cluster a
  horizontally scrollable row), viewport (fixed 55vh), then two bottom-sheet launchers
  docked under the viewport: `[Configure]` and `[Inspect]` (44 px). Each opens a
  bottom sheet (80vh, drag-handle, swipe-down or Esc to close, focus-trapped) hosting
  the config panel / inspect panel unchanged — same DOM nodes restyled, never cloned
  (the SAP-2 "same node restyled, zero DOM moves" discipline). Member tap on canvas
  auto-opens the Inspect sheet at the member card. Strips and print links remain in
  page flow below.

---

## 4. VIEW SYSTEM

### 4.1 Universal view presets (kept + completed)

Existing chips kept verbatim (Iso NE/NW/SE/SW, Plan, Front, Left) and completed with
`Right` and `Rear` so no wall lacks a straight-on view (D-UX-9). Behavior unchanged:
perspective isos, orthographic plan/elevations, orbit controls always live after the
preset positions the camera. Preset math scales from the structure's bounding box
(today's `R` from length/width — extended to include height so towers frame correctly;
the viewer computes bounds from `Member[]`, not from config, so it is always right).

### 4.2 Per-family camera presets (catalog-driven)

Appended after a thin divider in the VIEW cluster; defined as data (`CameraPreset[]`) in
the catalog, rendered as ordinary chips:

- Tower: `Elevation` (full-height ortho front — bracing pattern reads like the standard
  drawing), `Platform` (high iso down at the deck framing), `Underside` (low front
  quarter looking up at braces/joists).
- Huts: `Interior` (perspective, eye height 5'6", centered, FOV 60, auto-engages the
  N-side cutaway at 40% so you are not inside a dark box — preset carries an optional
  cutaway state), `Gable end`.
- Bunker: `Embrasure line` (ortho at embrasure sill height).

A preset is `{ id, label, camera: {type, posSpec, up?, fov?}, cutaway?: CutState,
stage?: StageId }` — posSpec in building-relative terms (fractions of bounds + absolute
eye heights) so one preset works across footprints.

### 4.3 Stage scrubber and member cards (kept + upgraded)

- **Scrubber**: numbered chips per engine-emitted stage (existing behavior — only stages
  with members render). Additions: `[◀]`/`[▶]` step buttons flanking the chips; `All`
  chip (= last stage, current default state, now explicit); keyboard `[` / `]` steps
  stages while the viewport has focus; hover/long-press tooltip keeps the stage name
  (existing `title`); on ≥ 1280 px widths each chip gains a short label under the number
  ("1 Layout", "8 Rafters"). Stage lists are per-structure (the engine's stage table is
  already data — `STAGES` — and the scrubber renders whatever the BOM emits, so towers
  can have e.g. "Legs & bracing / Platform / Rails / Ladder" stages with zero scrubber
  changes).
- **Current-stage highlight** (amber tint) and **selection highlight** (orange) carry
  forward unchanged.
- **Member card** (inspect panel top): existing fields kept (plain name + id, WHAT line,
  size, cut length + angles, grade/nailing, stage, identical count, doctrine). Additions:
  - `Show in cut list` — highlights the BOM line containing this member (memberIds
    already link them) and scrolls the stage panel to it.
  - `Isolate ×N` — dims all but the identical-member set (existing "identical" count
    becomes actionable); press again or Esc to clear.
  - Doctrine line becomes a button opening the doctrine popover (§6.1) — full cite, PH
    explainer, life-safety shield when applicable.
  - Nailing line hidden when Level-4 "Show nailing" is off.

### 4.4 CUTAWAY — every structure (mandate #5)

Toolbar cluster `CUTAWAY`, always present, default Off:

```
CUTAWAY  [Off][E–W][N–S][Level]   depth ───────●────  8'0 from front   [Flip]
         presets: [Section A–A] [Long section] [Platform slice]
```

- **Axis segmented**: `Off` / `E–W` (plane normal = building X — cuts across the length)
  / `N–S` (normal = Z — cuts across the width) / `Level` (normal = Y — horizontal slice).
  Plain-language tooltips: "Cut across the building, front wall to rear", etc.
- **Depth slider**: 0–100% of the bounding extent along the chosen axis, 1" resolution,
  live readout in ft-in with a spatial anchor ("8'0 from front", "12'6 above sill",
  "4'0 from left end"). Dragging updates in real time — implementation is a single
  `THREE.Plane` in `renderer.clippingPlanes` (global clipping: zero per-material work,
  no regeneration, cheap on any model size). Keyboard: slider is a native range input
  (arrows = 1", PgUp/PgDn = 1'0).
- **Flip**: swaps which side is removed (negates the plane).
- **Preset cuts** (catalog data, chips): Huts/house: `Section A–A` (N–S at mid-length),
  `Long section` (E–W at mid-width); Tower: `Platform slice` (Level, just above deck),
  `Half tower` (N–S mid); Bunker: `Through embrasure` (N–S at embrasure center),
  `Cover layers` (Level through the overhead-cover stack). A preset sets axis + depth +
  flip in one tap.
- **Honesty note**: first activation per device shows a one-time dismissible note under
  the toolbar: "Cutaway changes the view only — counts, cut lists, and exports always
  cover the whole building."
- **Interactions**: cutaway composes freely with any view preset and any stage. The
  `Plan` view + `Level` cut at 4'6 is offered as the `Section plan` preset chip on every
  structure (a true architectural plan section — walls cut, openings visible).
- **Member picking under cutaway**: three.js raycasting ignores clip planes, so the
  click handler must reject intersections on the clipped side of the active plane
  (`plane.distanceToPoint(hit.point) < 0` filter) before walking up to `memberId` —
  otherwise taps select invisible members. Named here because it WILL be the first bug
  otherwise (acceptance test §9 T-UX-8).
- v1 renders open cuts (members are solid boxes; unclipped faces read fine). Capped/
  filled cut faces are flagged stretch (§10 S-3), not core.

### 4.5 Print / export surfaces (kept + improved)

`Export ▾` menu in the header (duplicated as links in the below-fold PRINT SURFACES
section for discoverability):

| Item | Surface | Notes |
|---|---|---|
| Cut list — full building | Print page | Existing per-stage tables, all stages sequentially, grouped by stage with stage headers; column set unchanged (Stock / Cut / Pcs / Use) + checkbox column for field use. |
| Bill of materials | Print page | BOM rollup: per-nominal totals, board feet, panel count, nail/hardware summary lines (as the engine grows them), man-hours with the existing "(PH rates)" footnote. |
| Stage sheets | Print pages (one per stage) | Stage name + note, the stage's cut list, nailing schedule per role, doctrine cites as footnotes, and a captured viewport image of the model AT that stage (canvas `toDataURL` with `preserveDrawingBuffer` already on — capture loop sets stage, renders once, snapshots, restores; sequential, one image in memory at a time — the OOM lesson applied). |
| Plate layout strips | Print page | The existing SVG strips, one wall per row, already print-clean. |
| Build file (.timber.json) | File download | §5.4. |
| Print… (browser) | — | Opens the print stylesheet view of whichever surface is chosen; all surfaces are plain DOM + `@media print` CSS in `print.ts` — no libraries, offline-safe. |

Every print surface carries a title block: structure name, family, footprint, config
hash (short), date, doctrine tag INCLUDING the modified-from-standard downgrade when
applicable, and the standing footer ("TO construction per FM 5-426 (public release)...").
Exports never silently omit the PH status — cites print with their (PH) marks.

---

## 5. STATE & SHARING

### 5.1 Persistence model (local, offline) (D-UX-10)

`localStorage`, following the repo's existing precedent (`src/theme/theme.ts`,
`src/state/session.ts` — storage injected so tests use a Map-backed fake). One key,
one versioned envelope:

```ts
// store.ts
interface Timber2SessionV1 {
  v: 1;
  lastActive?: string;                    // structureId for the Resume strip
  structures: Record<string, {            // keyed by structureId (standards AND customs)
    config: StructureConfig;              // full config, engine-schema shape
    viewState: {                          // per-structure, restored on entry
      view: string;                       // preset id or 'orbit'
      stage: StageId | 'all';
      cutaway: CutState | null;
      panelOpen: [boolean, boolean, boolean, boolean]; // levels 1..4
      configCollapsed: boolean;
    };
    updatedAt: number;                    // epoch ms, for "edited 5 min ago"
  }>;
  customs: { id: string; name: string; baseId?: string; createdAt: number }[];
}
```

- Writes are debounced 300 ms after any change; write failures (quota, disabled
  storage) degrade to in-memory with a one-time visible notice ("Changes won't survive
  closing this tab — storage is unavailable"), the SAP-2 degrade pattern.
- Reads at boot: unknown `v` → ignore payload, start fresh, non-blocking notice "Saved
  work was from a newer TIMBER version and was left untouched." (never crash, never
  destroy — the stale payload stays in storage under its key until a same-or-newer
  version reads it).
- Storage stays device-local. Nothing ever leaves the machine except via explicit
  file export — consistent with the toolkit's zero-external-requests posture.

### 5.2 Switching structures without losing work

The `structures` map holds an independent config per structure. Opening SEA hut, making
changes, backing out to the picker, opening the tower, and returning to SEA hut restores
the SEA hut exactly — config, view, stage, cutaway, open panels. The picker's
`SAVED CHANGES` badge (§2.2) renders on any standard whose stored config differs from
its catalog default (deep-equal check at picker render). "Reset to standard" (§3.2)
deletes that structure's entry only.

### 5.3 Custom builds ("Your builds")

- Creating: from the Custom card (blank minimal frame) or via "Unlock everything" on a
  standard (§3.4). Each creates an entry in `customs` with id `custom-<n>` (monotonic
  counter kept in the envelope) and a `structures` map entry.
- The picker's YOUR BUILDS group lists them (§2.2) with Rename / Duplicate / Export /
  Delete. Duplicate copies config + name + " (copy)".
- There is no fixed slot limit in the UX; a soft cap warning appears past 20 builds
  ("Storage is finite — export builds you want to keep long-term").

### 5.4 Sharing without a server (offline-true)

- **Build file (primary)**: Export writes `<name>.timber.json` via Blob + anchor
  download. Deterministic serialization (sorted keys, fixed number formatting) so two
  exports of the same config are byte-identical. Envelope:
  `{ marker: "timber2-build", v: 1, structureId, name, config, engine: <engine version
  string>, exportedAt }`. Import (picker button or drag-drop, §2.4) validates marker →
  version → structure id known (unknown id offers "Open as custom build" since a config
  is self-sufficient) → config schema; failures produce the §2.7 plain-language banners.
  Files survive sneakernet/USB — the sharing story cannot depend on any network.
- **Link fragment (secondary)**: "Copy link" in the Export menu produces
  `woodframe.html#/build/<id>?c=<base64url(deflate(json))>`. Opening it imports into a
  session copy (does not overwrite the stored config until the user edits — the banner
  reads "Viewing a shared build — editing saves it to Your builds"). Guard: if the
  encoded fragment exceeds 4 KB the menu item shows "too large — use a build file".
- Both paths are pure client-side; the offline build gate sees zero new request sites.

---

## 6. RECRUIT-GRADE CLARITY

### 6.1 Language system

- **Plain-language-first everywhere** (existing house style, now made a rule): every
  label is a plain phrase with the trade term in parentheses — "How steep (Pitch)",
  "Short stud above a header (Cripple)". The `PLAIN` and `WHAT` maps move to
  `src/ui/timber/copy.ts` and become the single home of ALL UI strings (labels,
  helpers, empty states, errors, popover bodies) so language review is one-file work
  and the no-jargon bar is enforceable in review.
- **Doctrine popover** (one component, used by: header tag, locked rows, helper cites,
  member-card doctrine line, life-safety shields). Contents: plain-language sentence of
  WHAT the rule is; the cite string verbatim (e.g. "FM 5-426 Table 6-2, p.6-17 (PH)");
  a standing one-paragraph PH explainer: "(PH) means the page number is pending
  verification against the printed manual. The value is the working doctrinal default
  this tool ships with; the cite is completed as pages are verified."; for life-safety
  items, the review-posture line (§6.3). Dismiss: Esc, outside click, or the close
  button; focus returns to the opener.
- **Tooltips** are reserved for icon-only controls (title + aria-label); anything a
  recruit must LEARN from uses the popover (tooltips are invisible on touch).

### 6.2 Validation and error states (invalid opening placement and friends)

Issue contract (engine team owns evaluation; UX consumes — §7.3): severity
`block | warn | note`, plain message, cite (optional), `fix` (optional machine-applicable
remedy), anchors (openingId / memberIds / fieldPath).

- **BLOCK** (e.g. opening overlaps another; opening runs past the wall end; header
  override under-spans; sill+height exceeds wall height): the offending change is held
  at the control level — the elevation strip shows the red-dashed ghost at the attempted
  position, the opening row bears the red border + message + fix-it button, and the 3D
  model REMAINS THE LAST VALID MODEL with a thin red banner docked at the viewport top:
  "1 problem — showing the last valid building. Fix: <first block message>". The banner
  links to the offending row. Blocks never produce a broken or missing 3D model, and
  never a dialog.
- **WARN** (amber; e.g. door within 16" of a corner crowds the let-in brace; header at
  its table limit; zero doors on the building): model regenerates normally; amber dot on
  the section header + row message. Warns never gate.
- **NOTE** (grey; informational: "Sill under 24 in — typically a vent, check screening
  (PH)").
- All messages are plain sentences with the measurement in ft-in and, where doctrinal,
  the cite: "This window overlaps Door 1 by 0'8. Openings need 3 in of stud between
  them (PH). [Move right 0'11]".
- The zero-openings case is a WARN not a BLOCK ("No doors yet — most buildings need at
  least one") because sheds and bunkers legitimately differ; the catalog can raise it to
  BLOCK per family.

### 6.3 The defaults-with-cites boundary and the life-safety posture (D-UX-11)

Stated plainly in the plan and in the UI because it is the opposite of SAP-2's regime:
**TIMBER ships working doctrinal defaults, cited, PH-disciplined.** SAP-2 ships empty
because its numbers kill in one wrong trench; TIMBER's numbers frame lumber, and the
manual is public. The boundary: any value tagged **life-safety** in the catalog
(tower platform framing and live load, railing geometry, stair rise/run limits, ladder
specifics, span-table limits used by header/joist/girder sizing, bunker overhead cover)
renders with a shield glyph and the review line: "Life-safety value — ships as the
FM 5-426 working default; carried on the LIFE-SAFETY REGISTER for page-verified review
before field reliance." The register itself is a footer-linked print surface
(`print.ts`) listing every life-safety leaf, its value, cite, and verification status
(PH / verified), generated from the catalog — so the review posture is a visible,
printable artifact, not a comment in code. Life-safety locked fields are never
`preset`/`free` on standard structures; on customs they remain editable but the shield
and register entry follow the value into exports.

### 6.4 Empty states

- **Openings, empty wall**: centered in the list area — small inline SVG of a bare stud
  wall + "No openings on this wall yet." + `[+ Add opening]`. If the whole building has
  zero openings, the Level-2 header shows the §6.2 zero-door WARN dot.
- **Custom first-run coach stack** (config panel top, dismissible, auto-checks off from
  config state, no tracking beyond the config itself): "1. Set your footprint (Shape) —
  2. Pick a roof — 3. Add a door (Openings)". Each line is a link that opens the level.
  Disappears when all three are true or on dismiss.
- **No saved builds**: YOUR BUILDS group simply absent (no empty shelf).
- **Member card, nothing selected**: the card area shows "Tap any piece of the building
  to read its card — size, cut length, nailing, and the doctrine it comes from."
  (today it collapses to nothing; the hint earns its space on first use).

### 6.5 Loading and heavy-structure behavior

- Budget: typical regenerate ≤ 150 ms end-to-end. Measured rolling average per
  structure; when the projected regenerate exceeds 120 ms, interactions switch to
  coarse preview: sliders/drags show a ghost silhouette (bounding outline at the new
  dimensions) during the gesture and regenerate once on release.
- **Never a blank canvas**: rebuilds are double-buffered — the new `THREE.Group` is
  built detached, then swapped in one frame; the old model stays visible (dimmed 20%)
  under a corner shimmer chip "Framing… 2,412 pieces" whenever the rebuild runs past
  100 ms. No spinner overlays, no layout shift.
- Picker: thumbnails are static files — instant; `loading="lazy"` keeps first paint to
  the first two families.
- Route entry to a heavy structure: viewport shows the shimmer chip over the paper
  background (first build has no old model to keep), header/config render immediately.
- `prefers-reduced-motion`: camera preset moves become instant jumps; scroll behavior
  auto; shimmer becomes a static chip.

### 6.6 Keyboard map (workbench)

| Key | Action |
|---|---|
| `[` / `]` | Previous / next stage |
| `1..9,0` | View presets in toolbar order (0 = tenth) — announced in chip tooltips |
| `C` | Cycle cutaway axis Off → E–W → N–S → Level |
| arrows on cutaway slider | 1" steps (PgUp/PgDn 1'0) |
| `Esc` | Close popover/sheet → clear isolate → clear selection (in that order) |
| `Tab` order | header → toolbar clusters → config panel → viewport (canvas focusable, `aria-label`) → inspect panel → strips |
| `/` (picker only) | focus filter |

The canvas is `tabindex="0"` with `aria-label="3D model viewport. The panels beside it
carry the same information as text."` — the inspect panel + strips + cut lists ARE the
accessible equivalent (projection parity makes this claim true by construction).

---

## 7. CONTRACTS THE UX REQUIRES (engine/catalog teams own implementations)

UX consumes these shapes; signatures are stated here so the workbench can be built
against fixtures before the full engine lands.

### 7.1 Generation

```ts
// src/timber/structures.ts (engine team)
generateStructure(structureId: string, config: StructureConfig): StructureModel;
// StructureModel ⊇ { input; members: Member[]; levels; stages: StageDef[] }
// StageDef = { id, name } — per-structure stage tables; scrubber renders these.
// Member unchanged (role/nominal/actual/cutLength/position/rotation/stage/nailing/doctrineRef).
```

### 7.2 Catalog (drives picker + panel schema + presets)

```ts
// src/timber/catalog.ts (catalog team)
interface StructureCatalogEntry {
  id: string; family: FamilyId;
  name: string; oneLiner: string; doctrineTag: string;   // copy.ts reviews language
  defaults: StructureConfig;
  panel: PanelSchema;            // groups -> fields: control kind, bounds, unit,
                                 // labelKey, helperKey, citeKey, lock: 'locked'|'preset'|'free',
                                 // lifeSafety?: boolean, whyKey? (locked rows)
  cameraPresets: CameraPreset[]; // §4.2
  cutPresets: CutPreset[];       // §4.4
  openingKinds: OpeningKindDef[];// kinds + standard sizes + per-kind bounds
}
interface FamilyDef { id: FamilyId; name: string; introLine: string; order: number }
```

The picker renders `families × entries` verbatim; the workbench renders `panel`
generically via `controls.ts`. No structure gets bespoke panel code (§3.6).

### 7.3 Validation

```ts
// src/timber/validate.ts (engine team)
validateStructure(structureId: string, config: StructureConfig): Issue[];
interface Issue {
  severity: 'block' | 'warn' | 'note';
  messageKey: string; params: Record<string, string | number>; // copy.ts renders
  cite?: string;
  anchor: { fieldPath?: string; openingId?: string; memberIds?: string[] };
  fix?: { labelKey: string; apply: (c: StructureConfig) => StructureConfig };
}
```

`validateStructure` runs before every regenerate; a `block` suppresses regeneration
(§6.2). It must be pure and fast (< 5 ms) since it runs on every keystroke debounce.

### 7.4 Projections reused by UX

`wallElevation` / `layoutStrip` (existing `elevation.ts`) power the Level-2 elevation
strip and the strips section; `bomSummary` powers the inspect panel and print pack.
UX adds no geometry of its own anywhere — every drawn rectangle traces to a Member or
to the config (mini-plan only).

---

## 8. FILES TOUCHED / CREATED

The current `woodframe-scene.ts` (485 lines, one file) is dissolved into a `timber/`
UI package. Everything below `src/ui/timber/` is new unless marked.

| File | Status | Responsibility (single) |
|---|---|---|
| `src/ui/woodframe.html` | rewritten | App shell: header socket, `#picker` and `#workbench` view containers, `#printRoot`, strips section, footer. Static skeleton only; no inline app CSS beyond critical layout — styles move to `timber.css`. |
| `src/ui/timber.css` | new | All TIMBER-2 styles: palette variables (aligned with `tokens.css` names), chips, cards, panel rows, sheets, focus rings, print media rules. |
| `src/ui/timber/app.ts` | new | Boot, error boundary hookup, router wiring, store init, view mounting. |
| `src/ui/timber/router.ts` | new (~60 lines) | Hash parse/subscribe/push/replace; route type. |
| `src/ui/timber/picker.ts` | new | Picker view: control row, resume strip, family sections, cards, filter, arrow-key roving, import drop target. |
| `src/ui/timber/workbench.ts` | new | Workbench layout shell, header, responsive modes, sheet management; owns the regenerate loop and double-buffer swap. |
| `src/ui/timber/config-panel.ts` | new | Renders PanelSchema → accordion levels 1/3/4 rows, lock rows, summaries, coach stack. |
| `src/ui/timber/openings-editor.ts` | new | Level 2: wall tabs, mini-plan SVG, elevation strip (drag/snap/ghost), opening rows, add menu, counts. |
| `src/ui/timber/scene.ts` | new (extracted from `woodframe-scene.ts`) | three.js scene, member meshes (lumber/plywood/concrete via `three-viewer.ts` props), tints, picking (with clip-side filter), ground. |
| `src/ui/timber/views.ts` | new | Universal + catalog camera presets; bounds-aware placement; ortho/persp swap. |
| `src/ui/timber/cutaway.ts` | new | CutState, clip-plane controller, depth slider readouts, presets, one-time honesty note. |
| `src/ui/timber/inspect.ts` | new (extracted) | Member card (+ isolate, show-in-cut-list), stage panel, per-stage cut list. |
| `src/ui/timber/strips.ts` | new (extracted) | Plate layout strips (unchanged behavior). |
| `src/ui/timber/print.ts` | new | Print surfaces: cut list, BOM, stage sheets (sequential viewport capture), strips page, life-safety register; `@media print` routing. |
| `src/ui/timber/store.ts` | new | Versioned localStorage envelope, debounced writes, migration guard, injected storage for tests, custom-slot CRUD, export/import serialization (deterministic), fragment codec. |
| `src/ui/timber/controls.ts` | new | Widget library: stepper (ft / in / ft-in parser), segmented, radio-card, slider+detents, select, toggle, popover, toast/undo, sheet. All labeled, keyboard-complete. |
| `src/ui/timber/copy.ts` | new | Every UI string: PLAIN/WHAT maps (moved), labels, helpers, issues, popover bodies, PH explainer. |
| `src/ui/timber/validation-ui.ts` | new | Issue rendering: viewport banner, row messages, section dots, fix-it buttons. |
| `src/ui/hub.html` | edited | TIMBER card copy → TIMBER-2 structure-library text (§1.2). |
| `scripts/gen-thumbs.ts` | new | Build-time catalog → SVG thumbnails into `public/thumbs/`; `npm run gen:thumbs`. |
| `public/thumbs/*.svg` | generated | Shipped as files (never inlined). |
| `vite.woodframe.config.ts` / `vite.config.ts` | unchanged entry | `woodframe.html` remains the input; no new entries needed. |
| `src/ui/woodframe-scene.ts` | deleted at cutover | Its pieces live in `timber/scene|inspect|strips|views`. |

Engine/catalog-side files referenced but owned elsewhere: `src/timber/structures.ts`,
`src/timber/catalog.ts`, `src/timber/validate.ts` (§7).

---

## 9. ACCEPTANCE CRITERIA AND TEST SPECS (UX scope)

Node-testable without a browser wherever possible (repo culture: `node --test` + tsx).
DOM-dependent specs are written against the same injected-storage / pure-function seams
the repo already uses; anything genuinely needing a browser is marked [manual] until a
browser harness exists.

- **T-UX-1 Router**: hash ↔ route round-trip for every route form incl. unknown ids
  (falls back to picker route with notice flag); push/back sequences produce the §1.2
  chain.
- **T-UX-2 Store**: round-trip of the full envelope through a fake storage; debounce
  collapses N writes; unknown-version payload is preserved untouched and flagged;
  per-structure isolation (editing A never mutates B's entry); custom CRUD; deep-equal
  modified-badge logic.
- **T-UX-3 Thumbs determinism**: `gen-thumbs` twice → byte-identical; SVG contains no
  external refs (offline gate parity); painter-order stable under member reordering of
  equal input.
- **T-UX-4 Thumbs drift**: every catalog id has a thumb and vice versa; thumbnail
  regeneration matches committed files; card meta (footprint text) equals catalog
  default dims.
- **T-UX-5 Export/import**: deterministic serialization byte-stable; importer rejection
  matrix (bad marker / future version / unknown structure / malformed config) each
  yields its distinct messageKey; fragment codec round-trips and enforces the 4 KB
  guard.
- **T-UX-6 Panel schema rendering**: given a fixture PanelSchema, the rendered row model
  (a pure intermediate the DOM layer consumes) contains exactly the schema's fields with
  lock states, cites, and life-safety shields; locked fields produce no writable
  control.
- **T-UX-7 Issue gating**: a `block` issue leaves the last model in place (regenerate
  not called) and surfaces banner + row anchors; `warn` regenerates; fix-it applies and
  clears.
- **T-UX-8 Cutaway picking** [manual until browser harness]: with a mid cut active,
  clicking a clipped member selects nothing / the visible member behind it; slider
  readout matches plane position in ft-in.
- **T-UX-9 Keyboard**: picker roving focus order matches visual order for a fixture
  grid; workbench map (§6.6) dispatches; Esc ladder order.
- **T-UX-10 Copy discipline**: every messageKey/labelKey referenced anywhere resolves in
  `copy.ts` (no orphan keys, no hardcoded strings in view modules — lint by grep for
  quoted sentences outside copy.ts, allowlisted).
- **T-UX-11 Print pack**: stage-sheet generator produces one sheet per engine-emitted
  stage; title block carries the modified-from-standard downgrade when set; life-safety
  register lists exactly the catalog's lifeSafety-flagged fields.
- **T-UX-12 Never-blank canvas** [manual]: heavy-structure entry and slider drags keep
  either the old model or the ghost silhouette on screen at all times.

---

## 10. STRETCH FLAGS AND RISKS (not core; do not silently promote)

- **S-1 Stage play button** (auto-advance scrubber): nice for demos; core delivers
  step buttons + keys only.
- **S-2 Runtime thumbnails for Your Builds**: offscreen render to dataURL at save time.
  Risk: the historical inline/OOM class — if attempted, sequential capture, one at a
  time, files stored as Blobs in memory only for the session, NEVER into localStorage.
  Core ships the static custom.svg placeholder.
- **S-3 Capped cut faces** (filled sections on cutaway): stencil-based capping. Core
  ships open cuts.
- **S-4 Dual-plane cuts** (tower quarter cut): compose two planes; slider UI doubles.
  Core ships single plane.
- **R-1 Panel-schema underfit**: a family needs a control the schema lacks (e.g. bunker
  cover-layer stack editor). Mitigation: schema includes an `extension` control kind
  whose renderer is registered per family in ONE mapped location (`config-panel.ts`),
  keeping "no bespoke panel code" 95% true and the exception auditable.
- **R-2 Elevation-strip drag on touch**: 1" snap on a 300 px strip is fiddly. Mitigation:
  touch drags snap to 3" with the stepper for fine placement; strip zooms 2× while
  dragging on touch.
- **R-3 Catalog/thumbnail scale**: 15–20 structures × ~20 KB SVG ≈ 400 KB of files —
  fine; if line-art SVGs blow past ~150 KB each (dense towers), the generator must
  decimate hidden faces (depth cull) before shipping, and T-UX-3 gains a size budget
  assertion (≤ 150 KB per thumb).

---

## 11. DECISIONS LOG

- **D-UX-1 Hash-routed single page** over per-structure pages: one three.js load,
  free history semantics, in-memory config transfer, `file://` safe. Conflict noted:
  MPA purity of the suite — resolved because the suite boundary (hub ↔ tools) stays
  MPA; routing is internal to the tool.
- **D-UX-2 Two backs everywhere**: explicit `◀ Structures` + hub glyph on the
  workbench; hub glyph on the picker. Browser Back mirrors. No navigation confirms —
  safety comes from continuous persistence, not dialogs.
- **D-UX-3 Custom card last, never buried**: standards-first ordering teaches doctrine;
  Custom additionally surfaced via control-row button + jump chip. Mandate's
  "None/Custom" prominence satisfied by triple placement, not top slot.
- **D-UX-4 SVG line-art thumbnails generated at build time from the engine** (not PNG
  renders, not hand-drawn, not runtime): deterministic, tiny, offline-clean, testable,
  and honest — the picture IS the model. Ships as files; never inlined (OOM
  never-again).
- **D-UX-5 Config left / inspect right**: cause → effect → readout, preserving the
  TIMBER-1 inspect panel position for continuity.
- **D-UX-6 Non-exclusive accordion** with summary-bearing headers: the panel doubles as
  a readable spec sheet when closed; levels are disclosure, not wizard steps.
- **D-UX-7 Undo-toast instead of delete confirms for opening rows**: single-row
  deletions are cheap to restore; confirms are reserved for bulk-destructive acts
  (Reset to standard, Delete build).
- **D-UX-8 Locks with reasons + one-step unlock-to-custom**: standards remain
  doctrinally exact; total freedom exists but re-labels the artifact honestly, and the
  label follows into every export.
- **D-UX-9 Complete the elevation set** (add Right/Rear): every wall gets a straight-on
  view; per-family presets are catalog data, not code.
- **D-UX-10 localStorage versioned envelope, injected storage**: repo precedent;
  unknown versions preserved, never destroyed.
- **D-UX-11 Defaults-with-cites stated as the anti-SAP-2 boundary, life-safety carried
  on a printable register**: TIMBER ships working values; the register makes the review
  posture a visible artifact with named scope (platforms, rails, stairs, ladders,
  spans, overhead cover).
- **D-UX-12 Block issues freeze regeneration, never the UI**: the last valid model is
  always on screen; errors anchor to the control that caused them with a computed fix
  where possible.

