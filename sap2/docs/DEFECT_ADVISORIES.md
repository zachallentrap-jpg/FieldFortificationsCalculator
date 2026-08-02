# DEFECT_ADVISORIES.md — safety-relevant defect notices

The duty-to-warn record (blueprint §2.10; process adequacy is counsel question 9).
A discovered safety-relevant defect mints a numbered advisory here: affected
versions (by release hash from `RELEASES.md`), affected outputs, severity, remedy.
Operators check this file at every artifact transfer (`DATA_GOVERNANCE.md`).

Format:

```
## ADV-NNNN — <one-line title>
- Affected: <app versions / release hashes>
- Outputs: <which artifacts/numbers are affected>
- Severity: <error|warning|advisory>
- Defect: <what is wrong>
- Remedy: <upgrade/re-print/recompute instructions>
```

*No advisories issued. (v1's defect record — 12 of 17 critical findings open at
audit — is why this file exists from day one.)*
