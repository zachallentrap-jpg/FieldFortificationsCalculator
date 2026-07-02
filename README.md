# SAP-1 — Survivability Position Planner

SAP-1 is a deterministic, offline, private, parametric planner for doctrinal USMC/Army combat-engineer survivability positions — fighting positions, crew-served positions, vehicle defilade, and bunkers. You pick from dropdowns and toggles (position, threat, soil, standard, roof), and SAP-1 turns those inputs into dimensioned plan/section drawings, a real **drag-to-rotate 3D model** of the position, a bill of materials, a labor estimate, and a printable job sheet — all recomputed live as you change an input.

The interface leads with plain language everywhere (the technical term stays alongside in parentheses — e.g. "Dirt wall up front (parapet)") so it's usable without already knowing the jargon; the fixed doctrinal vocabulary the spec requires is never hidden, just never load-bearing for basic use.

---

> ## ⚠ NOT FOR FIELD USE — CUI handling
>
> **SAP-1 ships on illustrative placeholder data. Do not use it to build a real position.**
>
> It is **not** a substitute for current engineer publications or the engineer's judgment. SAP-1 performs **no** authoritative-value lookup and fabricates **no** shielding thickness, roof/stringer load or span, standoff, or parapet/retaining thickness. Every such value is a flagged placeholder (`status: "PLACEHOLDER"`, `source: "TODO: confirm against current pub"`), and the safety-critical ones — shielding thickness, roof/stringer load and span, standoff, parapet and retaining thickness — are tagged `safetyCritical: true`.
>
> A data-driven **NOT FOR FIELD USE** banner is on until the count of remaining placeholders reaches zero. It clears only when a qualified user has replaced every placeholder with a real, verified value **offline** via doctrine import (`src/doctrine/io.ts`). Until then, treat every number on screen as a stand-in.
>
> **Handling:** this tool and its output are **CUI**. Clear handling and distribution with your **S-6 / information-management shop** before fielding.

---

## The philosophy: deterministic / offline / private

- **Deterministic.** The engine is pure. The same inputs always produce byte-identical drawings, BOM, labor, and job sheet — no randomness, no clock, no network. What you see is a repeatable function of what you entered, and every figure can show its own derivation (formula + operands, with placeholders flagged).
- **Offline.** No runtime network requests, ever. The doctrine, engine, and state layers carry **zero runtime dependencies** (Vite and tsx are dev-only). A build gate (`scripts/check-offline.ts`) fails the build on any external URL in `dist/`, so the shipped artifact makes no outbound calls. The only allowlisted URLs are W3C SVG/XML namespace identifiers, which are never dereferenced over the network.
- **Private.** No accounts, no analytics, no off-device logging. Your scenarios live in the browser (IndexedDB) and in files you explicitly export. Nothing leaves the machine unless you save it there yourself.

## Threat model

Threat is a **specific caliber, not a coarse bucket** — class → round: small arms / HMG (5.56, 7.62, 12.7/.50 cal, 14.5mm), indirect (mortar 60/81/120mm; artillery 105/122/152/155mm), direct-fire AT (RPG, recoilless, tank, contact-HE), and blast/overpressure (demolition/small IED, large VBIED) — each with its own placeholder shielding thickness, standoff, roof call, and cover material, so a bigger round drives more cover and more standoff.

**Hard safety invariant:** direct-fire AT (shaped charge / contact HE) and large VBIED resolve to an *engineered roof*. The engine emits **zero** fabricated cover thickness for these, and the section draws an "ENGINEERED ROOF — SEE ENGINEER" hazard block instead. Unknown munitions fail safe to the same engineered path — never a made-up number.

## Positions

`one_man`, `two_man`, `mg_crew` (inverted-T with firing platform), `fifty_cal` (L-shape), `mortar_pit`, `vehicle_hull_defilade`, `vehicle_turret_defilade`, and `bunker_op_cp`.

## Placeholder regime

Every doctrinal constant is wrapped in `Provenance<T> = { value, unit?, status, source, safetyCritical?, note? }`. The helper `P(value, opts)` defaults `status` to `"PLACEHOLDER"` and `source` to `"TODO: confirm against current pub"`. A qualified user fills real values **offline** with `exportDoctrine` / `importDoctrine` (`src/doctrine/io.ts`): export serializes every provenance leaf, you edit it off-device, and import validates strictly (rejects prototype-pollution keys and file versions newer than the app), then flips matching leaves to `status: "DOCTRINE"` in place. The banner recomputes from those statuses. The test suite enforces the doctrine-integrity side of the regime today; the end-to-end banner-clear test lands with the doctrine-import UI (Phase 2 of `docs/EXECUTION_PLAN.md`).

## Run / develop

Requires **Node ≥ 20**.

```bash
npm install
npm run dev        # Vite dev server
npm run verify     # typecheck + all tests + offline gate
```

`npm run verify` runs `tsc --noEmit`, the full `node:test` suite, and the offline gate. The suites are green.

## Build & deliver

```bash
npm run build      # produces the installable PWA in dist/ AND dist/sap1.html, then runs the offline gate
```

The build ships **two** ways to run SAP-1 offline; use whichever your environment allows.

- **Installable PWA (`dist/`).** A static build with a web app manifest and a service worker. Served over **http(s) or localhost**, it installs as an app and runs fully offline after first load. This is the normal path — including the Replit static deployment (`.replit` sets `deploymentTarget = "static"`, `publicDir = "dist"`, and `build = npm ci && npm run build`).
- **Single self-contained file (`dist/sap1.html`).** One HTML file with everything inlined — the **air-gap fallback**. It runs directly from `file://` with no server at all. Service workers do not run from `file://`, so this is the copy for a truly disconnected machine: put the one file on the box and open it in a browser.

Both are produced by the same `npm run build`, and both pass the `check:offline` gate (no external URLs in `dist/`).

## More docs

- [`PLACEHOLDER_POLICY.md`](PLACEHOLDER_POLICY.md) — the placeholder / provenance regime and how the NOT FOR FIELD USE banner clears.
- [`DOCTRINE_SOURCES.md`](DOCTRINE_SOURCES.md) — what a qualified user must confirm, and against which publications, before fielding.
- [`USER_GUIDE.md`](USER_GUIDE.md) — how to use the planner: inputs, drawings, exports, scenarios, mission rollup, comparison, and time-available planning.
- [`DECISIONS.md`](DECISIONS.md) — the design decisions behind the engine, the safety invariants, and the offline / private posture.
