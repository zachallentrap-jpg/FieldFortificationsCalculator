# Placeholder Policy

> **NOT FOR FIELD USE.** SAP-1 ships on **illustrative placeholder data**. It performs no authoritative-value lookup and fabricates no shielding thickness, roof/stringer load/span, standoff, or parapet/retaining thickness. Every such value is a flagged `PLACEHOLDER` until a qualified user fills it against a **current engineer publication**, offline. This tool is **not** a substitute for current engineer pubs or the engineer's judgment.
>
> **Handling is CUI.** Clear this tool and any doctrine files you build with it through your **S-6 / information-management shop** before you field it.

This document explains how that placeholder regime works and gives you the exact procedure to replace a placeholder with a real, verified value.

---

## Why the regime exists

Doctrinal protection values — how much cover stops a given round, how far a roof must stand off, how far a stringer can span — are safety-of-life numbers. If the tool shipped with numbers that *looked* authoritative, someone would build to them. So the tool ships with **no** authoritative numbers at all. Every doctrinal constant is a placeholder, visibly flagged, and a big **NOT FOR FIELD USE** banner rides on top of the drawings and job sheet until every last placeholder has been replaced by a value **you** supplied from a current pub.

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

- **`status`** — `'PLACEHOLDER'` means the value is illustrative and untrusted. `'DOCTRINE'` means a qualified user has filled it against a current pub. The **NOT FOR FIELD USE banner is driven entirely off this field**, counted across every registered value.
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

The values that stop rounds and hold up roofs carry `safetyCritical: true`. Today that covers the frontal-cover / shielding thickness, roof setback and standoff, stringer span limits, and parapet/retaining-wall thickness (see `src/doctrine/protection.ts`). The registry counts these separately (`safetyCriticalRemaining`) so you can see at a glance how many life-safety figures are still unfilled. A safety-critical value with no real source is exactly the kind of thing you must not field, so the tests require every safety-critical entry to carry a non-empty source.

### The registry and the banner

At index load, `src/doctrine/registry.ts` deep-walks the doctrine tables once and holds a live reference to every `Provenance` leaf by dotted path. It stores the **actual leaf objects**, not copies — so the moment an import mutates a leaf's `status`, the registry reflects it. `counts()` reports:

```
{ total, doctrine, placeholder, safetyCritical, safetyCriticalRemaining }
```

The engine surfaces this as `result.placeholderReport.remaining` (which is `counts().placeholder`). The **NOT FOR FIELD USE banner renders only while `remaining > 0`** and clears the instant it hits zero — see `fieldUseBanner()` in `src/render/chrome.ts` (`if (remaining <= 0) return '';`) and the header badge in `src/layout/shell.ts`. There is no manual override. The banner is a pure function of how many placeholders are left.

---

## The swap procedure — replacing a placeholder with a real value

This is the whole point of the tool: a qualified user, working **offline**, replaces each illustrative number with the real one from a current publication. Do it through the doctrine import/export workflow. **Do not hand-edit source in the field.**

For each value you fill:

1. **Obtain the authoritative value from the current pub.** Look it up in the current engineer publication that governs the position, the threat, and the material. This is your judgment call, made against real doctrine — the tool does not and will not supply the number for you.
2. **Set `value`.** Put the real number in. Values are stored **in feet internally**; the imperial/metric toggle is display-only and does not change what you store.
3. **Flip `status` to `"DOCTRINE"`.** This is what tells the tool the value is now filled and trusted.
4. **Record a real `source`.** Replace `TODO: confirm against current pub` with a specific citation — the publication and location you pulled the number from. A `DOCTRINE` entry must **not** keep a `TODO` source; the tests reject that.
5. **The banner clears when zero placeholders remain.** As you flip values to `DOCTRINE`, `remaining` drops. When it reaches zero, the **NOT FOR FIELD USE** banner disappears on its own. Until then it stays up. Watch `safetyCriticalRemaining` in particular — the shielding, roof, and standoff figures are the ones that must be right.

You do steps 2–4 in a JSON file, not in the code. Here is how.

---

## The sanctioned path: offline doctrine import / export

The only supported way to fill values lives in `src/doctrine/io.ts`. It is built for an air-gapped workflow: dump every value to a file, fill the file offline, load it back.

### 1. Export

`exportDoctrine()` serializes every registered `Provenance` leaf to a flat JSON structure:

```jsonc
{
  "doctrineVersion": 1,
  "note": "SAP-1 doctrine export — values are ILLUSTRATIVE PLACEHOLDERS unless status is DOCTRINE. NOT FOR FIELD USE.",
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

On a machine and in a setting appropriate to CUI handling, open the exported JSON and, for each value you are filling, do steps 2–4 above: set `value`, set `"status": "DOCTRINE"`, and replace `source` with a real citation. Leave anything you are not filling as `PLACEHOLDER`. You can fill in passes — the banner just keeps counting down as you supply more.

### 3. Import

`importDoctrine(raw)` reads your filled file back in. It **validates strictly and never trusts the file blindly**:

- rejects a non-object payload, a missing/invalid `doctrineVersion`, or a file **newer** than the app supports;
- rejects prototype-pollution keys (`__proto__`, `prototype`, `constructor`) anywhere in the tree;
- rejects an oversized file (more than `maxEntries`, default 5000);
- per entry, rejects a missing/non-string `path`, an **unknown path** (one that does not match a live value), an invalid `status`, or a `value` whose **type does not match** the live value's type.

Entries that pass are applied in place: the matching live leaf's `value`, `status`, and `source` are updated. Because the registry holds the live leaves, the banner and `placeholderReport` **recompute immediately** — no reload, no rebuild. `importDoctrine()` returns a report: `{ ok, applied, rejected: [{path, reason}], counts }`, so you can see exactly what took and what was refused.

### Why not just edit the source?

Because the field is the wrong place to be editing TypeScript, because a source edit is unreviewed and untested, and because the whole regime is built so that **filling a value is a deliberate, validated, offline act by a qualified person**, not a code change. The `P()` helper is written so authors *cannot* accidentally ship a `DOCTRINE` value; the import path is the one door in.

---

## What the tool will never do — the hard safety invariant

For **direct-fire AT** (RPG, recoilless, tank main gun, direct-fire contact HE) and **large VBIED** overpressure, the threat resolves to `roofPath: 'engineered_required'`. For these, the engine emits **zero** fabricated cover thickness — ever — and the section drawing renders an **ENGINEERED ROOF — SEE ENGINEER** hazard block instead of a number (`src/doctrine/protection.ts`, `src/render/drawSection.ts`). Filling placeholders does **not** unlock a made-up roof thickness for these threats, and it is not supposed to. Those roofs are designed by an engineer, off-tool. Do not read the absence of a number as a gap to fill.

---

## Tests enforce all of this

The regime is not a convention you can quietly drift from — it is checked:

- **`test/doctrine-integrity.test.ts`** — on a fresh build **every** registered value is `PLACEHOLDER`; no `DOCTRINE` entry may keep a `TODO` source; every `safetyCritical` value must carry a non-empty source; and `counts()` must show all placeholders remaining (`doctrine === 0`, `placeholder === total`, `safetyCriticalRemaining === safetyCritical`, and at least one safety-critical value present).
- **`test/schema-import.test.ts`** and the io/protection suites — valid doctrine files round-trip; malformed, newer-version, prototype-polluted, and oversized files are rejected with a message.

If you add a doctrinal constant, wrap it in `P()`, tag it `safetyCritical` if it stops a round or holds a roof, and let it ship as a placeholder. If you fill values, do it through the export → offline-fill → import path, cite a real source, and confirm the banner clears only after `remaining` reaches zero.

---

**Reminder:** even with every value filled and the banner cleared, this tool is a planning aid, not doctrine. Verify against the current pub, use the engineer's judgment, and clear the tool and your doctrine files with your S-6 / information-management shop before fielding. **CUI.**
