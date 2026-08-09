# RELEASES.md — release record

Every release records its artifact SHA-256 here (G-15); `.sha256` sidecars ship
beside the artifacts. Defect advisories (`DEFECT_ADVISORIES.md`) reference these
hashes to name affected versions. Sign-off flag status per release class: owner-only
releases may carry `counsel: pending`; **distribution beyond the owner requires
`counsel: returned+dispositioned`** (B33, completeness patch 2).

| Version | Date | Artifact | SHA-256 | Sign-offs | Notes |
|---|---|---|---|---|---|
| 0.0.1-r0.dev | (development) | dist/sap2-standalone.html | rebuilt per commit — see sidecar | counsel: pending · SME: pending | R0 development builds; owner-only; not a release |

*First real entry lands at the R1 exit (fill-path release, owner-only).*
