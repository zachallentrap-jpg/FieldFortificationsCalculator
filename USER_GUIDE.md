# SAP-1 — Survivability Position Planner: Operator Guide

SAP-1 turns a few dropdowns and toggles into dimensioned drawings, a real drag-to-rotate 3D model, a bill of materials, and a labor estimate for a doctrinal survivability position — a fighting position, a crew-served position, vehicle defilade, or a bunker/OP-CP. You pick the position, the standard, the soil, and the threat; it draws the plan, the section, and a 3D model you can turn with your mouse or finger, lists what you need, and tells you how long it takes. Everything runs on your device with no network.

Every input carries a plain-language explanation, not just its name — the doctrinal term is always there too (in parentheses), but you never have to already know it to use the tool.

The safety-critical values — shielding thickness, munition standoff, radiation halving thickness, stringer span limits, retaining-wall thickness and height, roof setback, parapet and vehicle-berm frontal cover, and ATGM backblast clearance — never get invented. For the heaviest threats they are not even estimated: the app hands the roof to an engineer instead (see "The engineered-roof case" below). Real values are filled in **offline** through a doctrine import file (export the current values, edit them against the current pub, import them back) — see **Doctrine values** in the menu.

---

## Getting on the tool

There are two ways to run SAP-1, both fully offline:

- **Installed app.** Served over http(s) or localhost, it installs as an app from its web manifest, and once it is open it makes no network calls at all. It does not keep a cached copy of itself, so it needs the server to be reachable when you open it. Use this on a device you can serve the app to.
- **Single file (`sap1.html`).** One self-contained file you open directly from disk (`file://`). This is the air-gap fallback — it needs no server, ever: the single file simply *is* the whole app.

Either way, no data leaves the device. The **Status** panel confirms it: **Network: offline by design.**

---

## Finding things: the menu and the bottom toolbar

There are only two places to look for a control.

- **Menu** — the hamburger button at the right of the top bar. Everything that isn't a constant action lives in it, in three groups: **Setups & planning** (Saved setups, Combine positions, Compare setups, Time planner, Build schedule, Doctrine values), **Save & print** (Print report, Download drawings, Export spreadsheet, Export settings file), and **App** (Help, Status). Click the menu again, click outside it, or press Esc to close it.
- **Bottom toolbar** — fixed across the bottom of every screen, always one tap away: **Undo**, **Redo**, **Reset**, **Theme**, and on a phone **Edit** (which opens the inputs sheet).

The inputs themselves are on the screen — in a sidebar, a column, or the phone's bottom sheet, depending on the layout.

---

## The three layouts

SAP-1 arranges itself for the screen you're on. There are three layouts, chosen automatically from width, pointer type, and orientation; rotate the device or resize the window and the layout re-resolves live. There is no layout switch to set.

- **Desktop (3-region)** — inputs sidebar on the left, the three drawings (plan, section, 3D model) in the middle, and the specs / BOM / labor / checks rail on the right, all visible at once. Chosen automatically on a wide screen with a fine pointer (mouse).
- **Tablet (split)** — a controls column beside the canvas; plan and section sit side by side, the 3D model below them (large — this is the best view of it), and the panels below that. This is the likely primary field device; targets are glove-friendly. Chosen automatically on a mid-width touch screen.
- **Mobile (bottom-sheet)** — a single scrolling column with a sticky summary bar across the top (Sandbags, Spoil, Man-hrs, Elapsed), the drawings stacked full-width, and the panels as cards. The inputs live in a bottom-sheet you open with the **Edit** button in the bottom toolbar; tap it to slide the controls up, tap it again (or press Esc, or drag the sheet down by its handle) to close. Chosen automatically on a narrow touch screen.

---

## Day / Night themes

**What you do:** press **Theme** in the bottom toolbar. Its icon is the theme you'll switch *to* — a moon while you're in Day, a sun while you're in Night.

**What you see:** Day is the default light theme. Night is a red/amber light-discipline palette for use under blackout conditions. Your choice is remembered on the device. On first run the app follows your system's light/dark setting.

The drawings stay legible in either theme, in monochrome print, and under color-vision deficiency, because every element carries a pattern or a callout number in addition to its color — hue is never the only cue.

---

## Imperial / metric

**What you do:** set the **Units** control (in the "Scale & units" group) to **Imperial (ft-in)** or **Metric (m)**.

**What you see:** every length and volume re-labels to the chosen system. This is **display only** — all math is done internally in feet, so switching units never changes a result, only how it reads. The scale bar on the section switches too (a 5-ft bar in imperial, a 1-m bar in metric).

---

## The input controls

The inputs are grouped into **Position**, **Features**, and **Scale & units**. Every option comes straight from the doctrine tables, so the app can never offer a value the engine doesn't understand. Change any control and the drawings, BOM, and labor recompute immediately.

### Position group

- **Type** — the doctrinal position. Choices: one-man fighting position, two-man fighting position, machine-gun position (inverted-T, with a firing platform), .50 cal position (L-shape, with a firing platform), mortar pit, vehicle hull-defilade, vehicle turret-defilade, and bunker / OP-CP. Each carries its own fixed geometry, crew size, sump count, and whether it has sectors of fire.
- **Standard** — Hasty → Deliberate → Reinforced. Scales depth of cut, cover thickness, and labor. Hasty is faster and shallower (immediate protection, minimum dig); Deliberate is the full doctrinal position; Reinforced is deeper and more hardened, at more labor.
- **Soil** — Sand, Sandy loam, Loam, Silt, Clay, Gravel, Rock, or Frozen ground. Drives dig difficulty and the required cut-wall slope. Some soils (Sand, Gravel) doctrinally **force revetment** no matter what the Revetment control says.
- **Threat class → Caliber / round** — the two-level threat picker (see next section).
- **Revetment** — wall retention: None, Sandbag facing, Pickets & wire, Corrugated metal, or Timber & plywood. Each that builds a face adds material and labor.

### Features group (toggles)

- **Overhead cover** — adds an earth-on-stringers roof *where the threat allows it*. For the heaviest threats it becomes the engineered-roof flag instead (see below).
- **Grenade sump(s)** — adds the position's doctrinal sumps. Positions that define zero sumps add none even when this is on.
- **Firing step** — draws a firing step/ledge in the section. Crew-served positions carry a structural firing platform regardless of this toggle.
- **Camouflage** — adds camo-net area to the BOM.
- **Machine assist (dig)** — reduces excavation labor to reflect machine digging.

### Scale & units group

- **Positions** — how many of this position to build. Multiplies totals (BOM totals, total man-hours).
- **Team size** — the crew doing the work. Drives elapsed time (man-hours ÷ team, roughly).
- **Units** — Imperial or Metric, display only (above).

### The two-level Threat picker, and why size matters

The threat is a **specific round**, chosen in two steps:

1. **Threat class** — pick None, Small arms / HMG, Indirect (mortar / artillery), Direct-fire AT, or Blast / overpressure.
2. **Caliber / round** — the class you picked filters this second dropdown to just its rounds. Small arms / HMG offers 5.56mm, 7.62mm, 12.7mm (.50 cal), and 14.5mm HMG. Indirect offers 60mm, 81/82mm, and 120mm mortar plus 105/122/152/155mm artillery. Direct-fire AT offers RPG, recoilless rifle, tank main gun, and direct-fire HE (contact burst). Blast offers demolition / small IED and vehicle-borne IED (large).

Picking a class jumps the caliber dropdown to the first round in that class; picking **None** clears the threat.

**Why the specific round matters:** the threat's *size* is the dominant protection variable, so SAP-1 makes you choose the actual round, not a coarse bucket. Each round carries its own placeholder cover thickness, standoff, roof call, and cover material. A bigger round means more cover and more standoff — switching, say, 81mm to 155mm actually moves the cover thickness, the setback, and the BOM. The hint under the picker says it plainly: **Size drives cover thickness, standoff & roof.** (The caliber in millimeters is just the round's name — it is not one of the placeholder numbers you'd confirm against a pub.)

---

## Reading the drawings

You get three views — **Plan**, **Section A–A**, and **Isometric** — that share one visual language: a dark header bar per view, numbered callout discs tied to a single legend, and dimensions in one accent color. Every header also reminds you: **not to scale — dimensions govern.** Read the numbers, not the pixels.

### The shared legend and numbered callouts

Every labeled feature is a numbered disc on the drawing; the same numbers are spelled out in the **LEGEND** strip at the bottom of each view. The numbers are stable across all three views — a "4" is the fighting bay everywhere. The legend lists only the callouts that view actually drew. The full catalog:

1. Ground level (existing grade) · 2. Dug-out dirt (spoil) · 3. Dirt wall up front (parapet) · 4. Where you stand and fight (the bay) · 5. Roof overhead (overhead cover) · 6. Grenade catch-pit (sump) · 7. Roof support beams (stringers) · 8. Step up to shoot (firing step) · 9. Safety gap under the roof (setback) · 10. Needs an engineer's design (no roof shown) · 11. Sectors of fire · 12. Enemy direction · 13. Dozed dirt mound up front (berm) · 14. Vehicle access ramp · 15. Elbow rest (aiming support) · 16. Backblast danger area — keep clear · 17. Ground left undug to stand/mount on (firing platform).

Note that 8 and 17 are different things: the firing step is cut into the wall of the hole, while the firing platform is ground nobody dug — the stand the crew bays are cut down around.

### Plan view — ENEMY arrow, sectors, FRONT/REAR, the A–A cut

The plan looks down on the position: the parapet ring, the fighting bay cut into it, any firing platform and grenade sumps.

- A loud **ENEMY** arrow points out the front (enemy) side (callout 12).
- If the position has sectors of fire, a shaded fan shows the **sectors of fire** off the front apex (callout 11). Positions without sectors (mortar pit, vehicle defilade, bunker) don't draw them.
- **FRONT** and **REAR** are labeled so orientation is never ambiguous.
- A dashed line with an **A** disc at each end marks the **A–A section cut** — the exact plane the Section view slices through.
- Frontage and front-to-back dimensions run along the bay.

### Section A–A — the cut, the roof, the scale figure

The section is the front-to-back vertical slice taken along the A–A line, with **FRONT on the left** to match the plan. You see the earth mass with the bay cut out of it, the spoil-filled parapets, the firing step or platform, a grenade sump notch, and — if you have overhead cover — the roof on its stringers, set back from the front edge to leave a firing gap. A standing figure (~5'-10" reference) and a scale bar give real-world scale. Dimensions cover depth of cut, front-to-back, parapet height, roof setback, and cover thickness.

### The engineered-roof case — never a made-up number

This is the hard safety rule. When the threat is **direct-fire AT** (RPG, recoilless, tank, contact-HE) or a **large VBIED**, the roof does **not** get a fabricated thickness. Instead:

- The specs panel shows **Overhead roof: Engineered — see engineer** rather than a cover figure.
- The Section draws a hatched hazard block reading **ENGINEERED ROOF — SEE ENGINEER** (callout 10) where the roof would be.

The engine emits zero cover thickness for these threats, by design. If you need overhead protection against them, that roof is an engineering problem — take it to an engineer.

### 3D model — drag it, turn it, see the shape

Where the plan and section are precise measured drawings, the third view is a real, interactive 3D model you can drag to rotate, scroll or pinch to zoom, built from the exact same numbers. Every position type gets its own real shape — a rectangular one/two-man hole, the inverted-T trench of an MG position, the L-shaped alcove of a .50-cal position, a round mortar pit, or a ramp cut for vehicle defilade — plus a small figure standing next to it for scale, and floating labels ("Dirt wall up front", "Enemy direction"...) so a glance tells you what you're looking at. Click **Reset view** to recenter the camera; it never resets on its own just because you changed an input.

It carries **no dimensions** on purpose — the plan and section still govern measurement. If your device has no WebGL (rare), SAP-1 automatically falls back to a flat 2.5D schematic instead — nothing breaks, it just draws differently.

**The materials you see are the materials in the bill of materials — nothing is decoration.** Overhead cover is shown as stacked sandbags. The front protection depends on the position: a bunker / OP-CP is built as sandbag walls around the hole, a rifle or crew position gets a mounded earth parapet with a low sandbag firing rest at the aperture (the only concentrated sandbags on it), and a vehicle position's berm is dozed spoil. The dug-out walls show whatever you picked for Revetment: sandbag facing tiles the same way as a sandbag wall, Pickets & wire shows visibly open posts and wire (not a solid wall), and Corrugated metal / Timber & plywood each get their own distinct texture. Pick **Revetment: None** and the wall goes back to bare, sloped earth — how far the cut flares out depends on the Soil you picked: sand and gravel flare the widest and force a revetment on their own, rock and frozen ground stand vertical, and the loams, silt and clay sit between.

Configure nothing and each view shows a prompt ("Configure a position to see the plan view.") rather than a blank box.

---

## Tap-to-explain: the derivation trace

Any number with an underline (it renders as a button) is backed by a derivation you can open.

**What you do:** tap/click the underlined number — in the specs, in the BOM, or in the labor panel. (You can also tap the underlined dimension figures.)

**What you see:** a panel with the figure's **label**, the exact **formula**, the running **result**, and every **operand** with its value and unit. This is how you see *why* a number is what it is.

Close the panel by clicking outside it or pressing Esc.

---

## Scenarios — save, load, import, export

Scenarios let you keep named configurations and move them between devices. Open the panel with **Saved setups** in the menu.

**What you do / what you see:**

- **Save current…** — names and stores the current inputs. You're prompted for a name.
- **Load** / **Delete** — on each saved scenario in the list. Loading replaces your current inputs (and resets undo history to that point).
- **Import JSON** — pick a scenario `.json` file from disk. It's re-validated before it loads; a bad file is refused with a message rather than corrupting anything.
- **Export all** — downloads every saved scenario as one `sap1-scenarios.json` file.

Scenarios live **on this device only** (in the browser's IndexedDB), as the panel notes. Corrupt or unreadable rows are skipped silently, never loaded blindly.

---

## Mission BOM — roll up many positions, subtract on-hand, see the shortfall

Mission BOM combines several positions into one materials list and tells you what you're short. Open it with **Combine positions** in the menu (the panel is headed "Group job list").

**What you do:**

- **Add current position** — adds the position you have configured right now to the mission set. Add as many as the mission needs (repeat with different configs).
- Enter an **On hand** quantity for any line.
- **Clear** — empties the mission set.

**What you see:** a table with each material's total **Need**, an editable **On hand** field, and the resulting **Short** (need minus on-hand; shortfalls are highlighted). Below the table, total man-hours and elapsed time for the whole mission (with your team size). Empty, it tells you to add positions first.

---

## Compare — 2 to 3 configurations side by side

Compare puts configurations next to each other so you can weigh protection against cost. Open it with **Compare setups** in the menu.

**What you do:**

- **Add current** — adds the current configuration as a column (up to three). The button disables at three.
- **Hasty vs deliberate vs reinforced** — replaces the comparison with the current position at each of the three standards, in one press.
- **✕** on a column header removes that column; **Clear** empties the comparison.

**What you see:** a table with one column per config and rows for Position, Standard, Threat, Depth, Overhead cover (a thickness, "engineered," or "none"), Setback, total Sandbags, total Man-hours, and Elapsed. It's the quick way to see what a heavier standard or a bigger threat actually costs you in dig and materials.

---

## Time-available planning — hours + team → the standard you can actually build

This is the inverse question: given the time and crew you have, what's the most protection you can build for the current position and threat? Open it with **Time planner** in the menu.

**What you do:** enter **Hours available** and **Team size**, then press **Find achievable standard**.

**What you see:** a ranked table of the configurations that **fit** your budget — each row shows the Standard, the Roof (cover / engineered / none), the Revetment, and the Elapsed time — with a **Use** button that applies that configuration to your inputs. The list is ranked by protection first, then buildability, so the highest protection that fits your time comes first. If **nothing** fits, it tells you so and names the closest over-budget option (e.g. the standard you'd reach and how many hours it would actually take), so you know what you're trading.

---

## Build schedule — priorities of work, and are we ready by stand-to?

Open it with **Build schedule** in the menu (the panel is headed "Priorities of work").

**What you do:** enter **Team size**, **Hours to stand-to**, and **% on the tools** — how much of the team is digging while the rest pull security — then press **Build the timeline**.

**What you see:** the stages in doctrinal order, each with its man-hours and the hour it is done by, and above them a plain verdict: ready with time to spare, or short by so many hours (cut the standard, add hands, or accept a hasty position). The per-stage man-hours partition the position's total exactly, and the job sheet prints the same stages in the same order as its priorities-of-work table.

---

## Exports — job sheet, drawings, CSV, JSON

Every export is produced locally, from the **Save & print** group of the menu; you click to download or print. Nothing is uploaded.

- **Print report** — opens a printable **job sheet** for the current position (the dimensioned drawings, specs, BOM, labor, and the priorities-of-work table in a print-friendly page) and sends it to your printer / PDF. If your browser blocks the pop-up, you get the same sheet as a **`sap1-job-sheet.html`** file instead, so you still walk away with the document.
- **Download drawings** — the plan and the section as **`sap1-plan.svg`** and **`sap1-section.svg`**.
- **Export spreadsheet** — the bill of materials as **`sap1-bom.csv`** (RFC-4180 CSV, safe to open in a spreadsheet).
- **Export settings file** — the current inputs as **`sap1-scenario.json`** — the portable configuration you can re-import later or on another device.

Exports carry the app / schema / doctrine version stamps.

---

## Undo / redo / reset

**What you do:** **Undo** and **Redo** in the bottom toolbar step through your input changes; **Reset** returns every input to the starting defaults. With a keyboard, Ctrl+Z / Ctrl+Y (or Cmd+Z / Cmd+Shift+Z) do undo/redo too. Undo and Redo grey out when there is nothing to step to.

**What you see:** the inputs, drawings, and panels jump to the prior/next state. Undo/redo cover *input* changes; switching theme or opening a panel from the menu doesn't disturb your inputs or your history.

---

## Status + Help

**Status** (in the **App** group of the menu) opens an offline snapshot for troubleshooting or a bug report: the app / schema / doctrine versions, the practice-value counts (how many still need a real number, and how many of those are safety-critical), which doctrine fill is applied if any, the last error if any, and a flat statement that the app is **offline by design** — it makes no network calls, ever. If a view ever fails to draw, it degrades to an error card instead of crashing, and that error shows up here.

**Help** (also in the **App** group) opens a plain-language explainer of every input — Type, Standard, Soil, Threat, Revetment, the feature toggles, Positions / Team size, Units, and the tap-a-number trace — all offline.

**Doctrine values** (in **Setups & planning**) is where a qualified user replaces the practice numbers with real ones, offline, against current pubs — export the file, fill it off-device, import it back, or edit inline and apply. An import is checked and applied all-or-nothing: one bad value refuses the whole file rather than leaving half a table filled. See [`PLACEHOLDER_POLICY.md`](PLACEHOLDER_POLICY.md) for the full procedure.

---

## The short version

Pick a position, a standard, a soil, and a specific threat round. Read the drawings by their dimensions and legend, not their pixels. Tap any number to see how it was derived. Use the menu — Saved setups, Combine positions, Compare setups, Time planner, Build schedule — to work across many positions and constraints; print the report or export the drawings, spreadsheet, or settings file when you're done.
