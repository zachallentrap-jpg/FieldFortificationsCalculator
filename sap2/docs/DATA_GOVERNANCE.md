# DATA_GOVERNANCE.md — the fill regime, operationally

How doctrinal data enters, lives in, and leaves SAP-2. The architecture is blueprint
§2; this document is the operator-facing procedure set. Sections marked (R1) land
with the Fill Station.

## The three classes

| Class | For | Marks | Commissionable |
|---|---|---|---|
| DOCTRINE | real planning data | provenance strip when commissioned | yes — only class |
| TRAINING | workflow practice | FICT on every numeral; no bare exports | never |
| TEST | CI only | — | never; refuses to load in shipped builds |

## Entry (R1: file round-trip first, then the Fill Station)

- One leaf at a time: definition read, unit shown, citation captured (publication +
  para/page/table + edition) or, for `owner-estimate` leaves, a method note.
- **Blind double entry**: pass B re-derives every value in a different session with
  values masked; mismatches resolve by a third pub-open derivation with a required
  note (`mismatch-resolution` — that resolution IS the verification record).
- The importer is all-or-nothing: any invalid record rejects the whole file with
  reasons; nothing partial ever applies.

## Integrity & custody

- The file's content hash covers records + audit list + class + schema hash
  (`docs/HASHING.md`). **It is evidence against accident only** — a rewritten file
  is indistinguishable. The controls are: custody of the files, and the hash you
  recorded OUTSIDE the machine at commissioning.
- Keep two copies. Export at every batch seal and session end (R1). On resume, the
  station compares export lineage and hard-stops on a true fork.
- Check `DEFECT_ADVISORIES.md` for your app version at every artifact transfer.

## Commissioning (R1)

Reachable only when every covered leaf is filled + verified with zero open
mismatches. The ceremony: scroll-through manifest, typed per-event facts (fill
short-hash, waiver count, changed-leaf count), typed full name, the typed acceptance
sentence, single-operator disclosure when applicable, printed summary, and the typed
`I recorded this hash outside this machine` acknowledgment. Coverage is
**per-position** — artifacts outside the declared coverage stay watermarked.

## Corrections & recall

Any correction voids the affected coverage. Corrections mint a superseding file plus
a **printed recall notice** naming the revoked hash and affected leaf ids; the
planner keeps a revoked-hash list and refuses (or loudly flags) revoked fills.
Destroy superseded prints; re-print from the superseding fill.

## Failure modes

The full failure-mode table (F1–F27) from blueprint §2.12 governs; the residuals it
DECLARES (consistent misread surviving blind re-entry, fictional verifier identity,
wiped clock high-water store, forged file with recomputed hash) are accepted and
disclosed, not hidden.
