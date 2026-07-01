# SAP-1 — Survivability Position Planner

> **NOT FOR FIELD USE.** SAP-1 ships on **illustrative placeholder data**. Every
> authoritative value — shielding thickness, roof/stringer load, standoff — is a flagged
> `TODO`, never sourced or guessed. It is not a substitute for current engineer
> publications or the engineer's judgment. Clear handling (CUI) with your S-6 /
> information-management shop before fielding.

SAP-1 is a **deterministic, offline, private** parametric planner for doctrinal
combat-engineer survivability positions (fighting positions, crew-served, vehicle
defilade, bunkers). Dropdown/toggle inputs produce dimensioned drawings, a bill of
materials, a labor estimate, and a printable job sheet.

- **Deterministic** — `compute(inputs)` is pure; identical inputs give byte-identical output.
- **Offline & private** — no runtime network requests, no analytics, no off-device logging. System fonts only.
- **Honest about safety** — contact-burst and shaped-charge roofs are flagged out to a qualified designer; the engine never fabricates a cover thickness for them.

Full docs land with the build: `PLACEHOLDER_POLICY.md`, `DOCTRINE_SOURCES.md`,
`USER_GUIDE.md`, `DECISIONS.md`.

## Develop

```bash
npm install
npm run dev        # Vite dev server
npm run verify     # typecheck + tests + offline gate
npm run build      # PWA build + self-contained dist/sap1.html + offline gate
```

Requires Node ≥ 20.

_(This README is expanded in the docs stage.)_
