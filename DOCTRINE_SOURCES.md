# DOCTRINE_SOURCES.md — Placeholder Fill Checklist

> **NOT FOR FIELD USE. CUI.**
> SAP-1 ships on **ILLUSTRATIVE PLACEHOLDER** data. Nothing in this file is a
> doctrinal value, and nothing here is verified. Every quantitative constant
> below is a `P()`-wrapped placeholder whose `status` is `PLACEHOLDER` and whose
> `source` is `"TODO: confirm against current pub"`. SAP-1 performs **no**
> authoritative-value lookup and **fabricates no** shielding thickness, roof or
> stringer load/span, standoff, or parapet/retaining thickness. The
> "Current placeholder" column exists **only for traceability** so you can find
> the leaf in source — it is an **illustrative seed value, not a recommendation
> and not correct**. Do not field any output built on these numbers.
>
> **Before you fill anything:** handling is CUI. Clear this workflow with your
> S-6 / information-management shop before fielding. A qualified user fills real,
> verified values **offline** via doctrine import
> (`src/doctrine/io.ts` — `exportDoctrine()` / `importDoctrine()`), which flips a
> leaf's `status` to `DOCTRINE` in place. The app reports how many values are still
> unfilled — under **Menu → Status** and in the per-table burn-down on **Menu →
> Doctrine values** — and that count reaches zero only when every row below has
> been filled. Safety-critical leaves are counted separately by the registry.

## How to read this checklist

The tables below are **generated from the live doctrine registry** by
`scripts/gen-doctrine-sources.ts` — one row per registered leaf, no exceptions —
and `test/doctrine-sources-drift.test.ts` regenerates them on every test run, so
a leaf without a row, a row without a leaf, or a stale value fails the suite.
Do not edit the tables by hand except the **Filled?** / **Verified by** cells,
which the generator preserves.

- **Constant** — the dotted registry path (as `registerTree` keys it in
  `src/doctrine/index.ts`) plus the leaf's own note, so you can find and fill the
  exact leaf.
- **Current placeholder** — the **illustrative** value in source today. Labeled
  illustrative on every row. **Not authoritative. Not a suggested value.**
- **Likely source (TODO)** — **guidance only** on where the current
  survivability lineage would be consulted. This column asserts **no specific
  value** and does **not** claim any number is correct. See the source note
  below.
- **Filled?** — blank until a qualified user imports a verified value offline;
  mark it then.
- **Verified by** — blank until a qualified user records who verified it against
  the current publication.

### Safety-critical rows `[SC]`

Rows flagged `[SC]` are the leaves tagged `safetyCritical: true` in source — the
numbers that stop rounds, hold up roofs, and keep people out of a backblast. The
registry tracks `safetyCriticalRemaining` separately; treat every `[SC]` row as
must-verify before any use. They are:

- `protection.shielding` — the thickness of each shield material that stops each threat.
- `protection.threats` — every munition's minimum standoff, which drives the roof setback.
- `protection.radiationHalving` — the thickness of each material that halves a fallout dose.
- `protection.spanSizes` — the stringer span limits the roof member is sized from, and the dressed member sections it is drawn and built at.
- `protection.retainingWall` — the retaining-wall thickness and the height that demands one.
- `protection.overhead.setbackMin`, `protection.overhead.setbackDepthFrac` and `protection.overhead.bearingEachEnd` — the roof
  standoff used when no threat is named, the share of the cut depth the setback is
  taken from, and the bearing each stringer end carries the roof load through.
- `protection.parapet` — the frontal cover of an earth parapet: thickness and height.
- `protection.berm` — the thickness and height of a vehicle spoil berm.
- `weapons.backblast.clearanceFt` — the rear danger area an ATGM crew keeps clear.
- `vehicle.ramp.slopeRatio` — the grade a vehicle descends into its defilade cut.

### Source-lineage note (guidance only — asserts no value)

For "Likely source (TODO)" this checklist points at the **current U.S. Army/USMC
survivability publication lineage** as a starting point for a qualified user's
own research — **not** as a citation of any number:

- **ATP 3-37.34, *Survivability Operations*** — the current survivability
  operations publication; primary lineage for fighting/crew-served position
  geometry, overhead cover, revetment, and protective-construction guidance.
- **FM 5-103, *Survivability*** — **largely superseded**; historically the
  fighting-position/protective-construction reference. Listed only to trace
  lineage; confirm currency before use.
- Protective design / structural hardening, standoff, and blast/overpressure
  values trace to the protective-construction and force-protection engineering
  lineage (e.g. UFC protective-construction and antiterrorism standoff
  references). **Confirm the current, in-effect publication and edition
  yourself** — do not treat any pointer here as authoritative.

Every "Likely source (TODO)" cell is **guidance for where to look**, deliberately
non-specific, and confirms no value.

---

<!-- BEGIN GENERATED DOCTRINE TABLES — written by scripts/gen-doctrine-sources.ts; checked by test/doctrine-sources-drift.test.ts. Edit only the Filled? / Verified by cells by hand. -->

One row per registered leaf — 317 rows. `[SC]` marks a leaf tagged
`safetyCritical: true` in source. Every value is an illustrative placeholder;
every "Likely source (TODO)" cell is guidance only and asserts no value.

### Per-threat shielding thickness — `protection.shielding.<threatId>.<material>`

One row per threat × shield material. Every leaf is a safety-critical placeholder
thickness in feet; the shipped seeds are derived from an illustrative per-threat base
times an illustrative material factor and confirm nothing.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.shielding.at-he-contact.clay` [SC] — illustrative shielding thickness — confirm against current pub | 2.85 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.2 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.sand` [SC] — illustrative shielding thickness — confirm against current pub | 3.3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 9 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.soil` [SC] — illustrative shielding thickness — confirm against current pub | 3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.45 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-he-contact.timber` [SC] — illustrative shielding thickness — confirm against current pub | 5.4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.clay` [SC] — illustrative shielding thickness — confirm against current pub | 3.33 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 3.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.sand` [SC] — illustrative shielding thickness — confirm against current pub | 3.85 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 3.15 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 10.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.soil` [SC] — illustrative shielding thickness — confirm against current pub | 3.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.53 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-recoilless.timber` [SC] — illustrative shielding thickness — confirm against current pub | 6.3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.clay` [SC] — illustrative shielding thickness — confirm against current pub | 3.33 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 3.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.sand` [SC] — illustrative shielding thickness — confirm against current pub | 3.85 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 3.15 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 10.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.soil` [SC] — illustrative shielding thickness — confirm against current pub | 3.5 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.53 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-rpg.timber` [SC] — illustrative shielding thickness — confirm against current pub | 6.3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.clay` [SC] — illustrative shielding thickness — confirm against current pub | 3.8 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.6 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.sand` [SC] — illustrative shielding thickness — confirm against current pub | 4.4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 3.6 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 12 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.soil` [SC] — illustrative shielding thickness — confirm against current pub | 4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.6 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.at-tank.timber` [SC] — illustrative shielding thickness — confirm against current pub | 7.2 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-demo.clay` [SC] — illustrative shielding thickness — confirm against current pub | 1.42 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.6 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 1.5 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.sand` [SC] — illustrative shielding thickness — confirm against current pub | 1.65 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.35 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 4.5 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.5 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.22 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-demo.timber` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | Protective-construction / blast lineage — confirm |  |  |
| `protection.shielding.blast-vbied.clay` [SC] — illustrative shielding thickness — confirm against current pub | 2.85 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.2 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.sand` [SC] — illustrative shielding thickness — confirm against current pub | 3.3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 9 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.soil` [SC] — illustrative shielding thickness — confirm against current pub | 3 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.45 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.blast-vbied.timber` [SC] — illustrative shielding thickness — confirm against current pub | 5.4 ft (illustrative) | Protective-construction / engineer design — engineered, confirm |  |  |
| `protection.shielding.ind-art-105.clay` [SC] — illustrative shielding thickness — confirm against current pub | 1.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.sand` [SC] — illustrative shielding thickness — confirm against current pub | 2.2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 6 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.soil` [SC] — illustrative shielding thickness — confirm against current pub | 2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-105.timber` [SC] — illustrative shielding thickness — confirm against current pub | 3.6 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.clay` [SC] — illustrative shielding thickness — confirm against current pub | 2.18 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.92 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 2.3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.sand` [SC] — illustrative shielding thickness — confirm against current pub | 2.53 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.07 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 6.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.35 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-122.timber` [SC] — illustrative shielding thickness — confirm against current pub | 4.14 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.clay` [SC] — illustrative shielding thickness — confirm against current pub | 2.57 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.08 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.sand` [SC] — illustrative shielding thickness — confirm against current pub | 2.97 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.43 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 8.1 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.41 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-152.timber` [SC] — illustrative shielding thickness — confirm against current pub | 4.86 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.clay` [SC] — illustrative shielding thickness — confirm against current pub | 2.66 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 1.12 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 2.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.sand` [SC] — illustrative shielding thickness — confirm against current pub | 3.08 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.52 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 8.4 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.soil` [SC] — illustrative shielding thickness — confirm against current pub | 2.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.42 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-art-155.timber` [SC] — illustrative shielding thickness — confirm against current pub | 5.04 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.clay` [SC] — illustrative shielding thickness — confirm against current pub | 1.71 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.72 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 1.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.sand` [SC] — illustrative shielding thickness — confirm against current pub | 1.98 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.62 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 5.4 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.27 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-120.timber` [SC] — illustrative shielding thickness — confirm against current pub | 3.24 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.clay` [SC] — illustrative shielding thickness — confirm against current pub | 0.95 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.4 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 1 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.sand` [SC] — illustrative shielding thickness — confirm against current pub | 1.1 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.soil` [SC] — illustrative shielding thickness — confirm against current pub | 1 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.15 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-60.timber` [SC] — illustrative shielding thickness — confirm against current pub | 1.8 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.clay` [SC] — illustrative shielding thickness — confirm against current pub | 1.23 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.52 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 1.3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.sand` [SC] — illustrative shielding thickness — confirm against current pub | 1.43 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.17 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 3.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.soil` [SC] — illustrative shielding thickness — confirm against current pub | 1.3 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.ind-mtr-81.timber` [SC] — illustrative shielding thickness — confirm against current pub | 2.34 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.clay` [SC] — illustrative shielding thickness — confirm against current pub | 0.66 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.28 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 0.7 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.sand` [SC] — illustrative shielding thickness — confirm against current pub | 0.77 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.63 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 2.1 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.7 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.11 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-127.timber` [SC] — illustrative shielding thickness — confirm against current pub | 1.26 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.clay` [SC] — illustrative shielding thickness — confirm against current pub | 0.86 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.36 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 0.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.sand` [SC] — illustrative shielding thickness — confirm against current pub | 0.99 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.81 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 2.7 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.14 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-145.timber` [SC] — illustrative shielding thickness — confirm against current pub | 1.62 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.clay` [SC] — illustrative shielding thickness — confirm against current pub | 0.38 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.16 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 0.4 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.sand` [SC] — illustrative shielding thickness — confirm against current pub | 0.44 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.36 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 1.2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.4 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.06 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-556.timber` [SC] — illustrative shielding thickness — confirm against current pub | 0.72 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.clay` [SC] — illustrative shielding thickness — confirm against current pub | 0.48 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.concrete` [SC] — illustrative shielding thickness — confirm against current pub | 0.2 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.gravel` [SC] — illustrative shielding thickness — confirm against current pub | 0.5 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.sand` [SC] — illustrative shielding thickness — confirm against current pub | 0.55 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.sandbagged_soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.45 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.snow_ice` [SC] — illustrative shielding thickness — confirm against current pub | 1.5 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.soil` [SC] — illustrative shielding thickness — confirm against current pub | 0.5 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.steel` [SC] — illustrative shielding thickness — confirm against current pub | 0.08 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |
| `protection.shielding.sa-762.timber` [SC] — illustrative shielding thickness — confirm against current pub | 0.9 ft (illustrative) | ATP 3-37.34 survivability lineage — confirm |  |  |

> **HARD SAFETY INVARIANT (do not defeat when filling):** direct-fire AT
> (`at-rpg`, `at-recoilless`, `at-tank`, `at-he-contact`) and large VBIED
> (`blast-vbied`) resolve to `roofPath: 'engineered_required'`. The engine emits
> **zero** fabricated cover thickness for these and the section draws an
> **"ENGINEERED ROOF — SEE ENGINEER"** hazard block. Filling a shielding leaf for
> these threats does **not** authorize a fabricated roof number — the engineered
> path is by design. Never substitute a made-up thickness for the engineer's
> determination.

### Per-threat standoff — `protection.threats.<threatId>.standoffMin`

Each threat's minimum standoff/setback (ft) — safety-critical placeholders.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.threats.at-he-contact.standoffMin` [SC] — illustrative standoff — engineered roof | 2 ft (illustrative) | Protective-construction / engineer design — confirm |  |  |
| `protection.threats.at-recoilless.standoffMin` [SC] — illustrative standoff — engineered roof | 2 ft (illustrative) | Protective-construction / engineer design — confirm |  |  |
| `protection.threats.at-rpg.standoffMin` [SC] — illustrative standoff — engineered roof | 2 ft (illustrative) | Protective-construction / engineer design — confirm |  |  |
| `protection.threats.at-tank.standoffMin` [SC] — illustrative standoff — engineered roof | 2.5 ft (illustrative) | Protective-construction / engineer design — confirm |  |  |
| `protection.threats.blast-demo.standoffMin` [SC] — illustrative standoff | 2 ft (illustrative) | Protective-construction / blast standoff lineage — confirm |  |  |
| `protection.threats.blast-vbied.standoffMin` [SC] — illustrative standoff — engineered roof | 4 ft (illustrative) | Protective-construction / blast standoff lineage — confirm |  |  |
| `protection.threats.ind-art-105.standoffMin` [SC] — illustrative standoff | 1.5 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-art-122.standoffMin` [SC] — illustrative standoff | 1.75 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-art-152.standoffMin` [SC] — illustrative standoff | 2 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-art-155.standoffMin` [SC] — illustrative standoff | 2 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-mtr-120.standoffMin` [SC] — illustrative standoff | 1.5 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-mtr-60.standoffMin` [SC] — illustrative standoff | 1 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.ind-mtr-81.standoffMin` [SC] — illustrative standoff | 1.25 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.sa-127.standoffMin` [SC] — illustrative standoff | 1 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.sa-145.standoffMin` [SC] — illustrative standoff | 1 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.sa-556.standoffMin` [SC] — illustrative standoff | 1 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |
| `protection.threats.sa-762.standoffMin` [SC] — illustrative standoff | 1 ft (illustrative) | Antiterrorism / protective-construction standoff lineage — confirm |  |  |

> Note: each threat also carries an illustrative `base` seed and a qualitative
> `coverMaterial` / `roof` classification. `base` is not a standalone registered
> leaf (it drives the shielding table above); `coverMaterial` and `roof` are
> qualitative structure, not P()-wrapped values. The mm caliber is a definitional
> identifier, **not** a value to confirm.

### Radiation halving thickness — `protection.radiationHalving.<material>`

Halving thickness per shield material (ft) — safety-critical placeholders.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.radiationHalving.clay` [SC] — illustrative halving thickness | 0.48 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.concrete` [SC] — illustrative halving thickness | 0.22 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.gravel` [SC] — illustrative halving thickness | 0.5 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.sand` [SC] — illustrative halving thickness | 0.55 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.sandbagged_soil` [SC] — illustrative halving thickness | 0.45 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.snow_ice` [SC] — illustrative halving thickness | 1.5 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.soil` [SC] — illustrative halving thickness | 0.5 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.steel` [SC] — illustrative halving thickness | 0.06 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |
| `protection.radiationHalving.timber` [SC] — illustrative halving thickness | 1 ft (illustrative) | CBRN / protective-construction shielding lineage — confirm |  |  |

### Parapet — `protection.parapet.<dim>`

Frontal cover of an earth parapet: thickness and height above grade.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.parapet.H` [SC] — parapet height above grade (illustrative) | 0.5 ft (illustrative) | ATP 3-37.34 survivability lineage (frontal cover) — confirm |  |  |
| `protection.parapet.W` [SC] — frontal-cover thickness (illustrative) | 3 ft (illustrative) | ATP 3-37.34 survivability lineage (frontal cover) — confirm |  |  |

### Vehicle spoil berm — `protection.berm.<dim>`

Frontal cover of a vehicle defilade's dozed spoil berm: thickness and height.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.berm.H` [SC] — spoil-berm height above grade (illustrative) | 2 ft (illustrative) | ATP 3-37.34 survivability lineage (frontal cover, vehicle berm) — confirm |  |  |
| `protection.berm.W` [SC] — spoil-berm thickness at protective height (illustrative) | 4 ft (illustrative) | ATP 3-37.34 survivability lineage (frontal cover, vehicle berm) — confirm |  |  |

### Overhead-cover chain — `protection.overhead.<name>`

Roof standoff, stringer bearing, deck laps, spacing, and layer thicknesses.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.overhead.bearingEachEnd` [SC] — stringer overhang past its support, each end (illustrative) | 1 ft (illustrative) | ATP 3-37.34 overhead-cover lineage — confirm |  |  |
| `protection.overhead.dustproofThickness` — dustproof layer (illustrative) | 0.02 ft (illustrative) | ATP 3-37.34 overhead-cover lineage — confirm |  |  |
| `protection.overhead.endLap` — roof-deck lap onto the flank parapet past the hole end wall — no published figure (illustrative) | 1 ft (illustrative) | No published figure found (see leaf note) — confirm whether one exists |  |  |
| `protection.overhead.setbackDepthFrac` [SC] — setback as fraction of depth (illustrative) | 0.25 (illustrative) | ATP 3-37.34 overhead-cover lineage — confirm |  |  |
| `protection.overhead.setbackMin` [SC] — minimum roof setback/standoff (illustrative) | 1 ft (illustrative) | ATP 3-37.34 overhead-cover / standoff lineage — confirm |  |  |
| `protection.overhead.sheathingThickness` — roof sheathing ~1 in (illustrative) | 0.083 ft (illustrative) | ATP 3-37.34 overhead-cover lineage — confirm |  |  |
| `protection.overhead.stringerSpacing` — center-to-center stringer spacing (illustrative) | 1 ft (illustrative) | ATP 3-37.34 overhead-cover lineage — confirm |  |  |

### Stringer spans and sections — `protection.spanSizes[<i>].<name>`

Each table entry pairs a max load span with a member size: `maxSpan` is the span limit
the member is sized from, `sectionFt` the dressed cross-section it is drawn and built
at. Both are safety-critical; the `sizeLabel` is qualitative.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.spanSizes[0].maxSpan` [SC] — illustrative span limit | 4 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |
| `protection.spanSizes[0].sectionFt` [SC] — dressed section of a 4×4 stringer (illustrative) | 0.292 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |
| `protection.spanSizes[1].maxSpan` [SC] — illustrative span limit | 6 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |
| `protection.spanSizes[1].sectionFt` [SC] — dressed section of a 6×6 stringer (illustrative) | 0.458 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |
| `protection.spanSizes[2].maxSpan` [SC] — illustrative span limit | 8 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |
| `protection.spanSizes[2].sectionFt` [SC] — dressed section of an 8×8 stringer (illustrative) | 0.625 ft (illustrative) | ATP 3-37.34 overhead-cover span/stringer lineage — confirm |  |  |

> Spans beyond the tabulated maximum return `'engineered'` (designer decides) —
> filling these does not extend the engine into fabricating a member for an
> untabulated span. The import path refuses a span table out of ascending order.

### Retaining / revetment wall limits — `protection.retainingWall.<name>`

Structural limits — safety-critical placeholders.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `protection.retainingWall.maxHeight` [SC] — illustrative max unengineered height | 5 ft (illustrative) | ATP 3-37.34 revetment / retaining lineage — confirm |  |  |
| `protection.retainingWall.thickness` [SC] — illustrative wall thickness | 1 ft (illustrative) | ATP 3-37.34 revetment / retaining lineage — confirm |  |  |

## positions — position geometry (`src/doctrine/positions.ts`)

Geometry magnitudes (feet) only. Crew size, sump/elbow-hole counts, `shape`, and
boolean flags are qualitative definition, not P()-wrapped values, so they are not
fill leaves. None of these dimensions are authoritative — confirm against the
current survivability ATP before any use.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `positions.atgm_javelin.firingPlatform.L` — launcher platform length | 4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.firingPlatform.W` — launcher platform width | 3 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.firingPlatform.riseAboveFloor` — bay floor below platform | 0.5 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.hole.D` — defilade depth | 4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.hole.L` — gunner frontage | 8 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.hole.W` — position depth | 3 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.subBay.L` — side crew/ammo alcove reach past the bay end | 4.8 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.subBay.W` — side crew/ammo alcove width | 2.7 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.atgm_javelin.subBay.depthFrac` — arm depth as a fraction of the main bay cut (illustrative) | 0.85 (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.bunker_op_cp.hole.D` — standing depth | 6.5 ft (illustrative) | ATP 3-37.34 bunker / protective-construction geometry — confirm |  |  |
| `positions.bunker_op_cp.hole.L` — interior length | 10 ft (illustrative) | ATP 3-37.34 bunker / protective-construction geometry — confirm |  |  |
| `positions.bunker_op_cp.hole.W` — interior width | 8 ft (illustrative) | ATP 3-37.34 bunker / protective-construction geometry — confirm |  |  |
| `positions.connecting_trench.hole.D` — crawl/fighting depth | 5.5 ft (illustrative) | ATP 3-37.34 trench / fighting-position geometry — confirm |  |  |
| `positions.connecting_trench.hole.L` — trench run length | 15 ft (illustrative) | ATP 3-37.34 trench / fighting-position geometry — confirm |  |  |
| `positions.connecting_trench.hole.W` — trench width | 2.5 ft (illustrative) | ATP 3-37.34 trench / fighting-position geometry — confirm |  |  |
| `positions.fifty_cal.firingPlatform.L` — platform length | 4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.firingPlatform.W` — platform spans the full trench width (illustrative) | 2 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.firingPlatform.riseAboveFloor` — bay floor below platform | 1 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.hole.D` — depth | 4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.hole.L` — frontage | 9 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.hole.W` — width | 2 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.subBay.L` — side crew/ammo alcove reach past the bay end | 5.4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.subBay.W` — side crew/ammo alcove width | 1.8 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.fifty_cal.subBay.depthFrac` — arm depth as a fraction of the main bay cut (illustrative) | 0.85 (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.firingPlatform.L` — platform length | 3 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.firingPlatform.W` — platform width | 2 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.firingPlatform.riseAboveFloor` — bay floor below platform | 1.5 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.hole.D` — depth | 4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.hole.L` — trench frontage | 8 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.hole.W` — trench width | 2 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.subBay.L` — rear crew/ammo trench width across the frontage | 2.4 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.subBay.W` — rear crew/ammo trench run behind the bay | 2.2 ft (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mg_crew.subBay.depthFrac` — stem depth as a fraction of the main bay cut (illustrative) | 0.85 (illustrative) | ATP 3-37.34 crew-served position geometry — confirm |  |  |
| `positions.mortar_pit.hole.D` — pit depth | 4.5 ft (illustrative) | ATP 3-37.34 mortar-position geometry — confirm |  |  |
| `positions.mortar_pit.hole.L` — pit diameter | 8 ft (illustrative) | ATP 3-37.34 mortar-position geometry — confirm |  |  |
| `positions.mortar_pit.hole.W` — pit diameter | 8 ft (illustrative) | ATP 3-37.34 mortar-position geometry — confirm |  |  |
| `positions.one_man.hole.D` — armpit-deep | 4 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.one_man.hole.L` — frontage (illustrative) | 2.5 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.one_man.hole.W` — front-to-back | 4 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.two_man.hole.D` — armpit-deep | 4 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.two_man.hole.L` — frontage | 7 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.two_man.hole.W` — front-to-back | 2 ft (illustrative) | ATP 3-37.34 fighting-position geometry — confirm |  |  |
| `positions.vehicle_hull_defilade.hole.D` — hull-down depth | 3.5 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `positions.vehicle_hull_defilade.hole.L` — position length | 22 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `positions.vehicle_hull_defilade.hole.W` — position width | 12 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `positions.vehicle_turret_defilade.hole.D` — turret-down depth | 6 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `positions.vehicle_turret_defilade.hole.L` — position length | 22 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `positions.vehicle_turret_defilade.hole.W` — position width | 12 ft (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |

## vehicle — defilade ramp doctrine (`src/doctrine/positions.ts`)

The access-ramp grade a vehicle descends into its cut (safety-critical) and the
ramp/pan split of the position's run.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `vehicle.ramp.rampRunFrac` — share of the position run taken by the graded ramp, the rest being the level pan (illustrative) | 0.65 (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |
| `vehicle.ramp.slopeRatio` [SC] — access-ramp run per foot of cut depth (illustrative) | 5 ratio (illustrative) | ATP 3-37.34 vehicle-defilade geometry — confirm |  |  |

## weapons — backblast clearance (`src/doctrine/positions.ts`)

The rear danger area an ATGM crew keeps clear — safety-critical placeholder.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `weapons.backblast.clearanceFt` [SC] — rear backblast danger-area clearance (illustrative) | 25 ft (illustrative) | Weapon-system TM backblast danger-area lineage — confirm |  |  |

## features — drawn position features (`src/doctrine/positions.ts`)

The firing-step ledge, the mortar-pit wall batter, and the way in and out (entrance
passage, backblast lane, earth steps). The firing-step leaves have **no published
doctrinal figure** — they are model-derived and say so in their notes.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `features.access.backblastLaneFrac` — share of the frontage an ATGM position keeps open to the rear for backblast (illustrative) | 0.85 (illustrative) | ATP 3-37.34 survivability / access lineage — confirm |  |  |
| `features.access.passWidthFt` — rear entrance passage width (illustrative) | 3 ft (illustrative) | ATP 3-37.34 survivability / access lineage — confirm |  |  |
| `features.access.stairMaxRiserFt` — maximum rise per earth step on the way down (illustrative) | 0.83 ft (illustrative) | ATP 3-37.34 survivability / access lineage — confirm |  |  |
| `features.access.stairTreadFt` — earth-step tread run (illustrative) | 0.5 ft (illustrative) | ATP 3-37.34 survivability / access lineage — confirm |  |  |
| `features.firingStep.heightFt` — firing-step ledge height above the bay floor — no published doctrinal figure exists (illustrative, model-derived) | 0.67 ft (illustrative) | No published figure — model-derived (see leaf note); confirm the modeling, not a number |  |  |
| `features.firingStep.runFt` — firing-step ledge front-to-back run — no published doctrinal figure exists (illustrative, model-derived) | 0.8 ft (illustrative) | No published figure — model-derived (see leaf note); confirm the modeling, not a number |  |  |
| `features.mortarPit.batterRatio` — mortar-pit wall batter, run per foot of depth (illustrative) | 0.25 (illustrative) | ATP 3-37.34 mortar-position geometry — confirm |  |  |

## soils — soil behavior (`src/doctrine/soils.ts`)

Per soil: a dig-labor multiplier, a required cut-wall slope (H per 1 V), and a
boolean "revetment forced by soil" flag. All P()-wrapped placeholders.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `soils.clay.digFactor` — dig-labor multiplier (illustrative) | 1.5 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.clay.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.clay.wallSlopeRatio` — H:V wall slope (illustrative) | 0.75 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.frozen.digFactor` — dig-labor multiplier (illustrative) | 3.5 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.frozen.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.frozen.wallSlopeRatio` — H:V wall slope (illustrative) | 0 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.gravel.digFactor` — dig-labor multiplier (illustrative) | 1.4 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.gravel.revetForced` — revetment forced by soil (illustrative) | true (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.gravel.wallSlopeRatio` — H:V wall slope (illustrative) | 1.48 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.loam.digFactor` — dig-labor multiplier (illustrative) | 1 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.loam.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.loam.wallSlopeRatio` — H:V wall slope (illustrative) | 0.65 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.rock.digFactor` — dig-labor multiplier (illustrative) | 3 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.rock.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.rock.wallSlopeRatio` — H:V wall slope (illustrative) | 0 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.sand.digFactor` — dig-labor multiplier (illustrative) | 1.3 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.sand.revetForced` — revetment forced by soil (illustrative) | true (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.sand.wallSlopeRatio` — H:V wall slope (illustrative) | 1.48 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.sandy_loam.digFactor` — dig-labor multiplier (illustrative) | 1.15 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.sandy_loam.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.sandy_loam.wallSlopeRatio` — H:V wall slope (illustrative) | 1 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |
| `soils.silt.digFactor` — dig-labor multiplier (illustrative) | 1.1 (illustrative) | ATP 3-37.34 soil / excavation lineage — confirm |  |  |
| `soils.silt.revetForced` — revetment forced by soil (illustrative) | false (illustrative) | ATP 3-37.34 revetment lineage — confirm |  |  |
| `soils.silt.wallSlopeRatio` — H:V wall slope (illustrative) | 1 ratio (illustrative) | ATP 3-37.34 excavation slope-stability lineage — confirm |  |  |

## standards — build-standard multipliers (`src/doctrine/standards.ts`)

How hasty / deliberate / reinforced scale depth, cover, and labor relative to the
position's base geometry. All P()-wrapped placeholders.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `standards.deliberate.coverMul` — cover multiplier (illustrative) | 1 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.deliberate.depthMul` — depth multiplier (illustrative) | 1 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.deliberate.laborMul` — labor multiplier (illustrative) | 1 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.hasty.coverMul` — cover multiplier (illustrative) | 0.75 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.hasty.depthMul` — depth multiplier (illustrative) | 0.6 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.hasty.laborMul` — labor multiplier (illustrative) | 0.6 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.reinforced.coverMul` — cover multiplier (illustrative) | 1.4 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.reinforced.depthMul` — depth multiplier (illustrative) | 1.25 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |
| `standards.reinforced.laborMul` — labor multiplier (illustrative) | 1.6 (illustrative) | ATP 3-37.34 build-standard lineage — confirm |  |  |

## materials — materials & construction factors (`src/doctrine/materials.ts`)

Sandbag geometry and load, revetment picket spacing/wire, camo drape, grenade sump,
excavation swell, and machine assist. Labels, `kind`, and `buildsFace` are
qualitative structure, not fill leaves.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `materials.camo.drapeFactor` — camo net area factor over footprint (illustrative) | 1.25 (illustrative) | Camouflage / concealment lineage — confirm |  |  |
| `materials.camo.drapeHeightFt` — height the net is flown above grade (illustrative) | 1.8 ft (illustrative) | Camouflage / concealment lineage — confirm |  |  |
| `materials.excavation.swellFactor` — bank-to-loose swell factor (illustrative) | 1.25 (illustrative) | Earthwork / excavation estimating practice — confirm |  |  |
| `materials.machine.excavationFactor` — labor factor when machine-excavated (illustrative) | 0.4 (illustrative) | Engineer equipment productivity lineage — confirm |  |  |
| `materials.revetments.pickets_wire.spacing` — picket spacing (illustrative) | 2 ft (illustrative) | ATP 3-37.34 revetment (picket) lineage — confirm |  |  |
| `materials.revetments.pickets_wire.wirePerPicket` — tie wire per picket (illustrative) | 6 ft (illustrative) | ATP 3-37.34 revetment (picket) lineage — confirm |  |  |
| `materials.sandbag.H` — filled bag thickness (illustrative) | 0.33 ft (illustrative) | ATP 3-37.34 revetment / sandbag lineage — confirm |  |  |
| `materials.sandbag.L` — filled bag length (illustrative) | 1.25 ft (illustrative) | ATP 3-37.34 revetment / sandbag lineage — confirm |  |  |
| `materials.sandbag.W` — filled bag width (illustrative) | 0.75 ft (illustrative) | ATP 3-37.34 revetment / sandbag lineage — confirm |  |  |
| `materials.sandbag.basicLoad` — sandbags carried per soldier (illustrative) | 7 (illustrative) | ATP 3-37.34 revetment / sandbag lineage — confirm |  |  |
| `materials.sandbag.frontWallHeight` — front retaining-wall course height (illustrative) | 0.83 ft (illustrative) | ATP 3-37.34 revetment / sandbag lineage — confirm |  |  |
| `materials.sandbag.wasteFactor` — sandbag waste factor (illustrative) | 1.15 (illustrative) | Construction estimating practice — confirm |  |  |
| `materials.sump.D` — sump depth (illustrative) | 1 ft (illustrative) | ATP 3-37.34 grenade-sump lineage — confirm |  |  |
| `materials.sump.L` — sump length (illustrative) | 1 ft (illustrative) | ATP 3-37.34 grenade-sump lineage — confirm |  |  |
| `materials.sump.W` — sump width (illustrative) | 1 ft (illustrative) | ATP 3-37.34 grenade-sump lineage — confirm |  |  |
| `materials.sump.gravelFt3` — gravel per sump (illustrative) | 1 ft³ (illustrative) | ATP 3-37.34 grenade-sump lineage — confirm |  |  |
| `materials.sump.rollInSlope` — floor roll-in slope toward sump (illustrative) | 0.1 (illustrative) | ATP 3-37.34 grenade-sump lineage — confirm |  |  |

## labor — man-hour rates & feature adders (`src/doctrine/labor.ts`)

Base per-position labor plus per-volume and per-feature adders. All P()-wrapped
placeholders. Dig productivity varies enormously with soil, tools, fatigue, and
weather — these are illustrative only.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `labor.baseMH` — base per-position labor (illustrative) | 4 man-hours (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.camoAdd` — camouflage adder (illustrative) | 0.75 man-hours (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.machinePerVolMH` — blade/excavator hours per bank ft³ (illustrative) | 0.004 machine-hours/ft³ (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.overheadAdd` — overhead-cover build adder (illustrative) | 3 man-hours (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.perVolMH` — excavation labor per bank ft³ (illustrative) | 0.08 man-hours/ft³ (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.revetAdd` — revetment build adder (illustrative) | 2 man-hours (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |
| `labor.sumpAdd` — grenade-sump adder (illustrative) | 0.5 man-hours (illustrative) | ATP 3-37.34 / engineer estimating lineage — confirm |  |  |

## stages — excavation-stage shares (`src/doctrine/stages.ts`)

How the excavation labor splits across the earthmoving stages. The shares partition
one man-hour total, so the import path refuses a fill whose shares do not sum to 1.

| Constant | Current placeholder | Likely source (TODO) | Filled? | Verified by |
|---|---|---|---|---|
| `stages.excavationSplit.deliberate` — share of dig labor from hasty depth to full depth (illustrative) | 0.45 (illustrative) | ATP 3-37.34 priorities-of-work / build-sequence lineage — confirm |  |  |
| `stages.excavationSplit.hasty` — share of dig labor to reach hasty prone depth (illustrative) | 0.3 (illustrative) | ATP 3-37.34 priorities-of-work / build-sequence lineage — confirm |  |  |
| `stages.excavationSplit.parapet` — share of dig labor forming the parapet/berm from spoil (illustrative) | 0.2 (illustrative) | ATP 3-37.34 priorities-of-work / build-sequence lineage — confirm |  |  |
| `stages.excavationSplit.security` — share of dig labor spent posting security & staking (illustrative) | 0.05 (illustrative) | ATP 3-37.34 priorities-of-work / build-sequence lineage — confirm |  |  |

<!-- END GENERATED DOCTRINE TABLES -->

---

## Filling procedure (offline only)

1. **Clear handling first.** This is CUI — coordinate with your S-6 /
   information-management shop before fielding or moving files.
2. Run `exportDoctrine()` (`src/doctrine/io.ts`) to serialize every Provenance
   leaf, including the `path` and current `status`, to a JSON file.
3. Offline, a **qualified user** replaces each illustrative `value` with a real,
   **verified** value from the **current** in-effect publication and sets that
   entry's `status` to `DOCTRINE`, recording the source and who verified it (fill
   the `Filled?` and `Verified by` columns here in the same pass).
4. Reload the file with `importDoctrine()`. It validates strictly — prototype-pollution
   keys, newer doctrine versions, unknown paths, type mismatches, magnitudes outside
   `0 ≤ v < 1000`, a `DOCTRINE` status still carrying a `TODO` source, a scrambled
   stringer-span table and stage shares that miss 1.0 are all refused — and **any**
   rejection refuses the whole file, leaving the live doctrine exactly as it was.
   Nothing half-applies. Values that pass are written to the live leaves and the
   registry's `counts()` recomputes at once.
5. The remaining count falls only as rows are filled, and
   `safetyCriticalRemaining` must reach zero before any safety-critical output is
   trusted — the `[SC]` rows above are that set.

**Do not** edit `status: 'DOCTRINE'` directly in source. The regime deliberately
routes every fill through validated import so provenance is preserved, and the
integrity/unlock test suites enforce it.
