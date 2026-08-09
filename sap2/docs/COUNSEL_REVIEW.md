# COUNSEL_REVIEW.md — memo for legal / JAG review

**Status: DRAFT — R0 exit deliverable (blueprint §2.9, B33). Not legal advice; this
document is the engineering team's request FOR advice.** Review is a scheduled,
gate-consuming milestone: the release gate (G-15) records this review's status, a
`pending` status forces the STRUCTURAL-REVIEW-PENDING stamp and **blocks distribution
beyond the owner** (never builds), and R4 entry is hard-gated on the review being
returned and dispositioned.

## What the software is

SAP-2 is an offline, single-device planning aid for military survivability positions
(fighting positions). Its defining liability property is **ship-empty**: the
distributed artifact contains **zero doctrinal values**. Every number it can ever
print must be (1) entered by its operator value-by-value, (2) cited to a source
publication or explicitly marked as the operator's own estimate, (3) verified by a
recorded second pass, and (4) **commissioned** — a recorded human acceptance act —
before outputs lose their warning watermark. Outputs carry the data's provenance
state at all times. There is no network I/O (CI-enforced), no account, no telemetry;
data never leaves the device.

## The ten questions we need answered

1. **Conditions gate.** The app requires a typed-name acceptance of
   `CONDITIONS_OF_USE.md` on first run and again when the operator escalates data
   class (template → training → doctrine). Is this flow and its wording adequate and
   enforceable for its purpose? What should the wording be?
2. **License reconciliation.** The repository is source-available; conditions-of-use
   restrictions and an open license (e.g. MIT) can conflict. What license/terms
   combination fits the intent (open code, conditioned USE of commissioned outputs)?
3. **CUI posture.** The EMPTY shell is presumed unrestricted **pending this review**
   — never asserted as fact. Confirm: is the empty shell unrestricted? Are operator
   fill files, commissioned outputs, and pub-registry metadata CUI or otherwise
   controlled, and what markings must the app print on each?
4. **Export control.** The shell contains no doctrinal values, but the SCHEMA
   contains doctrine-shaped analytic structure (e.g. the relational expectation that
   bigger calibers require ≥ shielding — a monotonicity validator). Does structure of
   this kind carry export-control or distribution consequences?
5. **Aggregation sensitivity.** A complete filled dataset plus named personnel
   (enteredBy/verifiedBy/commissioner identities) on unencrypted removable media —
   what handling guidance must `HANDLING.md` give for fill files in progress and at
   rest?
6. **Records/privacy.** The fill records attested names of entry/verification
   personnel and the commissioner, permanently, inside a hash-sealed file. Any
   records-management or privacy constraints on capturing and printing these?
7. **Single-operator disclosure.** When one person both enters and verifies (no
   second person available), the artifact prints `SINGLE-OPERATOR FILL — identity
   attested, not authenticated`. Is this disclosure adequate? Required wording?
8. **Product-liability review of claims.** `SOFTWARE_CLAIMS.md` is the complete
   ledger of what the software's own text claims and refuses to claim. Review every
   line, especially: the boundary line printed on every artifact ("Planning aid —
   verify against current publications. Not a substitute for engineer judgment."),
   the model-fidelity lines, STOP-card wording, and pending-check wording.
9. **Duty to warn.** Post-release engine defects are handled by numbered advisories
   in `DEFECT_ADVISORIES.md` keyed to per-release SHA-256 hashes (`RELEASES.md`), and
   the operator workflow includes checking advisories at every artifact transfer. Is
   this process sufficient as a reasonable-care record?
10. **Commissioner qualification.** The software records WHO acted but does not
    adjudicate who MAY act (no rank/qualification enforcement). Is record-who-acted
    the right posture, or must the tool state qualification requirements?

## Facts counsel should know

- v1 (this repository's root) shipped **placeholder values that look real** behind a
  warning banner; it is now deprecated with a tombstone naming that hazard, and v2's
  architecture removes the class. The deprecation record is in the root README.
- The commissioning ceremony captures: typed full name, the typed sentence
  `I ACCEPT RESPONSIBILITY FOR THESE VALUES`, per-waiver acknowledgments, fill hash
  read-back, and the typed acknowledgment `I recorded this hash outside this
  machine`. Practice mode uses visibly different text so rehearsal never trains the
  real phrase.
- The audit trail is honest about its limits: the fill file is tamper-EVIDENT against
  accident only; a rewritten file with a recomputed hash is indistinguishable.
  Custody plus the externally recorded hash are the controls, and the docs say so.
- Fictitious TRAINING data prints an inline `FICT` suffix on every numeral and can
  never be commissioned; the class is inside the content hash so relabeling breaks
  integrity.

## What we need back

Per-question dispositions (approve / approve-with-changes / blocked), any required
wording verbatim, and an overall go/no-go for distribution beyond the owner. The
review's return is recorded as a flag file consumed by the release gate.
