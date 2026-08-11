# Placeholder Policy

> **NOT FOR FIELD USE.** SAP-1 ships on **illustrative placeholder data**. It performs no authoritative-value lookup and fabricates no shielding thickness, roof/stringer load/span, standoff, or parapet/retaining thickness. Every such value is a flagged `PLACEHOLDER` until a qualified user fills it against a **current engineer publication**, offline. This tool is **not** a substitute for current engineer pubs or the engineer's judgment.
>
> **Handling is CUI.** Clear this tool and any doctrine files you build with it through your **S-6 / information-management shop** before you field it.

This document explains how that placeholder regime works and gives you the exact procedure to replace a placeholder with a real, verified value.

---

## Why the regime exists

Doctrinal protection values — how much cover stops a given round, how far a roof must stand off, how far a stringer can span — are safety-of-life numbers. If the tool shipped with numbers that *looked* authoritative, someone would build to them. So the tool ships with **no** authoritative numbers at all. Every doctrinal constant is a placeholder, and the app keeps a live count of how many are still unfilled — total, and safety-critical separately. That count is what tells you whether anything here has been confirmed against a pub: it starts at every registered value and only falls as **you** supply real values from a current pub. Where the app shows it is under [The registry and the placeholder count](#the-registry-and-the-placeholder-count).

Nothing in this codebase sources, fetches, transcribes, guesses, or hard-codes a real doctrinal number. That is by design, and it is enforced by tests.

---

## The `Provenance<T>` pattern

Every doctrinal constant is wrapped in a `Provenance<T>` record instead of being a bare number. The type is defined in `src/doctrine/types.ts`:

```ts
export type ProvStatus = 'PLACEHOLDER' | 'DOCTRINE';

export interface Provenance<T> {
  value: T;              // the number (or structured value) itself
  unit?: string;         // 'ft', etc. — display only; the engine works in feet internally
  status: ProvStatus;    // 'PLACEHOLDER' (unfilled) or 'DOCTRINE' (you filled it)
  source: string;        // where the value came from
  safetyCritical?: boolean; // true for shielding / roof / standoff / retaining figures
  note?: string;         // a short human note ('illustrative span limit', etc.)
}
```

The two fields that carry the whole policy:

- **`status`** — `'PLACEHOLDER'` means the value is illustrative and untrusted. `'DOCTRINE'` means a qualified user has filled it against a current pub. **Every count the app reports is driven entirely off this field**, tallied across every registered value.
- **`source`** — free text saying where the number came from. On a fresh build every source reads `TODO: confirm against current pub`.

### The `P()` helper

Because every constant defaults to placeholder, the authors never write out the whole record. They use the `P()` helper (also in `src/doctrine/types.ts`):

```ts
export const P = <T>(value: T, o: Partial<Provenance<T>> = {}): Provenance<T> => ({
  value,
  status: 'PLACEHOLDER',
  source: 'TODO: confirm against current pub',
  ...o,
});
```

So `P(3.0, { unit: 'ft', safetyCritical: true, note: 'frontal-cover thickness (illustrative)' })` produces a value of `3.0 ft`, tagged safety-critical, with status `PLACEHOLDER` and source `TODO: confirm against current pub`. The author supplies only the illustrative value and its metadata; **the author never sets `status: 'DOCTRINE'` in source, and never writes a real source string.** The comment on `P()` says so directly:

> Callers override only `value`, `unit`, `safetyCritical`, `note` — never flip `status` to `'DOCTRINE'` in source. The status flips to `'DOCTRINE'` exclusively via validated doctrine import (`io.ts`), which is how a qualified user supplies real, verified numbers offline.

That is the crux of the policy: **the only sanctioned way a value becomes `DOCTRINE` is the offline import path below — not by editing source.**

### `safetyCritical` tagging

The values that stop rounds, hold up roofs, and keep people out of a backblast carry `safetyCritical: true`. These are the leaves the registry counts separately as `safetyCriticalRemaining`, so you can see at a glance how many life-safety figures are still unfilled. They are:

- `protection.shielding` — the thickness of each shield material that stops each threat.
- `protection.threats` — every munition's minimum standoff, which drives the roof setback.
- `protection.radiationHalving` — the thickness of each material that halves a fallout dose.
- `protection.spanSizes` — the stringer span limits the roof member is sized from, and the dressed member sections it is drawn and built at.
- `protection.retainingWall` — the retaining-wall thickness and the height that demands one.
- `protection.overhead.setbackMin`, `protection.overhead.setbackDepthFrac` and `protection.overhead.bearingEachEnd` — the roof standoff used when no threat is named, the share of the cut depth the setback is taken from, and the bearing each stringer end carries the roof load through.
- `protection.parapet` — the frontal cover of an earth parapet: its thickness and the height it stands above grade.
- `protection.berm` — the thickness and height of a vehicle spoil berm, the only protection a hull-down position has.
- `weapons.backblast.clearanceFt` — the rear danger area an ATGM crew keeps clear.
- `vehicle.ramp.slopeRatio` — the grade a vehicle descends into its defilade cut; too steep noses in or overturns it.

A safety-critical value with no real source is exactly the kind of thing you must not field, so the tests require every safety-critical entry to carry a non-empty source.

### The registry and the placeholder count

At index load, `src/doctrine/registry.ts` deep-walks the doctrine tables once and holds a live reference to every `Provenance` leaf by dotted path. It stores the **actual leaf objects**, not copies — so the moment an import mutates a leaf's `status`, the registry reflects it. `counts()` reports:

```
{ total, doctrine, placeholder, safetyCritical, safetyCriticalRemaining }
```

The engine surfaces this as `result.placeholderReport.remaining` (which is `counts().placeholder`). Three places put it in front of a user, all recomputed from the live leaves, with no manual override anywhere:

- **Menu → Status.** `collectDiagnostics()` and `diagnosticsText()` in `src/layout/diagnostics.ts` print `Placeholders: <remaining> / <total> (safety-critical: <n>)`, the applied doctrine fill (or `none (all placeholders)`), the last error, and `Network: offline by design`.
- **Menu → Doctrine values.** `doctrineOverlay()` in `src/layout/tools.ts` is the fill screen itself: a per-table **Remaining / Total** burn-down, an `SC` tag on every safety-critical row, each value's current source, and the applied fill's hash, author and date.
- **The printed job sheet.** `fillFooter()` in `src/render/jobSheet.ts` prints, at the foot of every sheet, the content hash of the doctrine fill the sheet was computed against, with the author and date the fill carried — once a fill has been applied. A sheet built on the shipped placeholders carries no fill line, because there is no fill to name.

The drawings themselves carry no disclaimer text: their text alternative describes the position and nothing else, and `test/trust.test.ts` holds it to that whether placeholders remain or every one has been filled. Read the counts above, not the drawing, to know what a number is worth.

---

## The swap procedure — replacing a placeholder with a real value

This is the whole point of the tool: a qualified user, working **offline**, replaces each illustrative number with the real one from a current publication. Do it through the doctrine import/export workflow. **Do not hand-edit source in the field.**

For each value you fill:

1. **Obtain the authoritative value from the current pub.** Look it up in the current engineer publication that governs the position, the threat, and the material. This is your judgment call, made against real doctrine — the tool does not and will not supply the number for you.
2. **Set `value`.** Put the real number in. Values are stored **in feet internally**; the imperial/metric toggle is display-only and does not change what you store.
3. **Flip `status` to `"DOCTRINE"`.** This is what tells the tool the value is now filled and trusted.
4. **Record a real `source`.** Replace `TODO: confirm against current pub` with a specific citation — the publication and location you pulled the number from. A `DOCTRINE` entry must **not** keep a `TODO` source; the tests reject that.
5. **The count falls as you fill.** Each value you flip to `DOCTRINE` drops `remaining` by one, and Status reads it back to you the moment the fill lands — no reload. Watch `safetyCriticalRemaining` in particular: the shielding, roof, standoff and backblast figures are the ones that must be right, and a zero there is the last thing to reach zero, not the first.

You do steps 2–4 in a JSON file, not in the code. Here is how.

---

## The sanctioned path: offline doctrine import / export

The only supported way to fill values lives in `src/doctrine/io.ts`. It is built for an air-gapped workflow: dump every value to a file, fill the file offline, load it back.

### 1. Export

`exportDoctrine()` serializes every registered `Provenance` leaf to a flat JSON structure:

```jsonc
{
  "doctrineVersion": 1,
  "note": "SAP-1 doctrine export — status is PLACEHOLDER unless confirmed and re-imported as DOCTRINE.",
  "manifest": {
    "contentHash": "…",       // computed over the entries themselves
    "author": "…",            // optional, whatever you passed to exportDoctrine()
    "date": "…"               // optional — the module reads no clock, so you supply this
  },
  "entries": [
    {
      "path": "…",              // dotted path identifying the exact value
      "value": 3.0,             // current (illustrative) value
      "unit": "ft",
      "status": "PLACEHOLDER",
      "source": "TODO: confirm against current pub",
      "safetyCritical": true,   // present only when true
      "note": "frontal-cover thickness (illustrative)"
    }
    // …one entry per doctrinal constant
  ]
}
```

Every value is in that file. Nothing is hidden.

### 2. Fill it offline

On a machine and in a setting appropriate to CUI handling, open the exported JSON and, for each value you are filling, do steps 2–4 above: set `value`, set `"status": "DOCTRINE"`, and replace `source` with a real citation. Leave anything you are not filling as `PLACEHOLDER`. You can fill in passes — the count just keeps falling as you supply more.

### 3. Import

`importDoctrine(raw)` reads your filled file back in. It **validates strictly and never trusts the file blindly**.

Refused before anything is read entry by entry:

- a non-object payload, a missing or non-numeric `doctrineVersion`, or a file **newer** than the app supports;
- prototype-pollution keys (`__proto__`, `prototype`, `constructor`) anywhere in the tree;
- an oversized file (more than `maxEntries`, default 5000);
- a missing or non-array `entries`.

Refused per entry:

- an entry that is not an object, or a missing / non-string `path`;
- an **unknown path** — one that matches no live value;
- an invalid `status` (anything but `PLACEHOLDER` or `DOCTRINE`);
- a `value` whose **type does not match** the live value's type;
- a number that is not finite, is negative, or is 1000 or greater — a magnitude that far out is a transcription error, not doctrine;
- a `DOCTRINE` status carrying a `TODO` source. Stamping a value as confirmed while its source still says "confirm this" would defeat the one check the whole regime rests on.

Refused against the table as it *would* stand once the file lands, because some tables are read by their order or their sum rather than value by value:

- the stringer span limits (`protection.spanSizes`) must ascend. The size lookup is first-fit, so a limit out of order hides a row behind a longer one and hands back an undersized member on the safety-critical span path.
- the excavation stage shares (`stages.excavationSplit`) must sum to 1. The stage clock partitions one man-hour total by them, so anything else invents or loses labor with no other symptom. No single share is the wrong one, so this is reported against the table rather than against a row you could go and edit.

**Any rejection refuses the whole file.** Nothing is mutated — not the entries that passed, not the ones before the bad one. Safety-critical data must never land half-applied: a partly-filled shielding table is a table where the number you are reading may be a real one or may be the illustrative seed, and nothing on the screen tells you which. So the importer stages every change, validates the lot, and only then commits. Fix the file and import it again.

What is **reported but still applied** is a fill that is merely surprising rather than broken: a bigger round given less cover or less standoff than a smaller one, and any protective magnitude that lands at zero or so close to zero that the app can only print it as zero — a thickness, a parapet, a berm, a backblast clearance, a halving thickness, a depth of cut, or a build-standard multiplier that scales one of those out of sight. The importer refuses what would break the engine, not what disagrees with expectation; these come back as `warnings` for the person who made the fill to judge.

Once every entry passes, each staged change is written to its live leaf (`value`, `status`, `source`, `note` — `unit` and `safetyCritical` are structural and never come from a file). Because the registry holds the live leaves, the counts and `placeholderReport` **recompute immediately** — no reload, no rebuild.

`importDoctrine()` returns `{ ok, applied, dryRun, rejected, rejectedTables, warnings, message, manifest, counts }`. Pass `{ dryRun: true }` to get all of that **without mutating anything**: the report's `counts` previews the state an apply would produce, which is what the Doctrine values screen shows you before you commit to it.

A fill applied through the screen is also saved on the device so you do not re-import the file every session — and it is re-applied on the next boot through the **same** validated importer (`saveFill()` / `restoreFill()` in `src/state/doctrineFill.ts`). Stored bytes get no more trust than a fresh file: a saved fill that no longer matches the registry is refused whole, and you are back to placeholders rather than to a doctrine table half-built from a stale file. If device storage refuses the write, the app says so — the fill holds for the session and will not survive a reload.

### The fill manifest

Every applied fill records a manifest: a content hash computed over the entries, plus the author and date the file carried. `getFillState()` returns it, the Status and Doctrine values panels show it, and the job sheet prints it. That is what makes a `DOCTRINE` stamp attributable: a sheet says which fill it was computed against, so two sheets built on different fills can be told apart afterwards.

### Why not just edit the source?

Because the field is the wrong place to be editing TypeScript, because a source edit is unreviewed and untested, and because the whole regime is built so that **filling a value is a deliberate, validated, offline act by a qualified person**, not a code change. The `P()` helper is written so authors *cannot* accidentally ship a `DOCTRINE` value; the import path is the one door in.

---

## What the tool will never do — the hard safety invariant

For **direct-fire AT** (RPG, recoilless, tank main gun, direct-fire contact HE) and **large VBIED** overpressure, the threat resolves to `roofPath: 'engineered_required'`. For these, the engine emits **zero** fabricated cover thickness — ever — and the section drawing renders an **ENGINEERED ROOF — SEE ENGINEER** hazard block instead of a number (`src/doctrine/protection.ts`, `src/render/drawSection.ts`). Filling placeholders does **not** unlock a made-up roof thickness for these threats, and it is not supposed to. Those roofs are designed by an engineer, off-tool. Do not read the absence of a number as a gap to fill.

---

## Tests enforce all of this

The regime is not a convention you can quietly drift from — it is checked:

- **`test/doctrine-integrity.test.ts`** — on a fresh build **every** registered value is `PLACEHOLDER`; no `DOCTRINE` entry may keep a `TODO` source; every `safetyCritical` value must carry a non-empty source; and `counts()` must show all placeholders remaining (`doctrine === 0`, `placeholder === total`, `safetyCriticalRemaining === safetyCritical`, and at least one safety-critical value present).
- **`test/doctrine-io.test.ts`** — the import/export path end to end: a full fill drives the counts to zero and a restore brings them back; `importDoctrine()` refuses out-of-range values, a `DOCTRINE` status with a `TODO` source, unknown paths, newer versions and prototype-polluted files; one bad entry rejects the whole file with nothing mutated; a dry run previews the post-apply counts while the live registry stays untouched; a scrambled span table and a stage split that misses 1 are refused whole; implausible-but-applied fills come back as warnings; and a persisted fill survives a reload.
- **`test/schema-import.test.ts`** — the *scenario and inputs* schemas, which are a different file format from the doctrine file above and are validated separately.
- **`test/docs-drift.test.ts`** — this document and its siblings against the code: every file, symbol and registry path named here has to exist, and the safety-critical list above has to match the leaves the registry actually tags.
- **`test/doctrine-sources-drift.test.ts`** — the fill checklist against the registry: `DOCTRINE_SOURCES.md`'s tables are generated from the live registry by `scripts/gen-doctrine-sources.ts`, and this test regenerates them on every run — a leaf without a checklist row, a row without a leaf, a stale value or a wrong `[SC]` mark fails the suite.

If you add a doctrinal constant, wrap it in `P()`, tag it `safetyCritical` if it stops a round or holds a roof, and let it ship as a placeholder. If you fill values, do it through the export → offline-fill → import path, cite a real source, and read the counts back off the Status panel rather than assuming the fill landed.

---

**Reminder:** even with every value filled and the count at zero, this tool is a planning aid, not doctrine. Verify against the current pub, use the engineer's judgment, and clear the tool and your doctrine files with your S-6 / information-management shop before fielding. **CUI.**
