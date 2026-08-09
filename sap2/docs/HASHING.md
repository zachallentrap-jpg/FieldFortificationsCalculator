# HASHING.md — canonical serialization & hash spec

The integrity primitive of the SAP-2 fill regime (blueprint §2.6, B21). Every hash in
the system — `schemaHash`, fill `contentHash`, export lineage — is SHA-256 over the
canonical serialization defined here. The implementation is `src/schema/canon.ts` +
`src/schema/sha256.ts` (pure, dependency-free, environment-free — identical bytes in
node CI, the dev server, and the `file://` air-gap artifact). `test/canon.test.ts`
reproduces every vector on every CI run.

## Canonical serialization rules

1. JSON value model only: object / array / string / finite number / boolean / null.
   `undefined` and non-finite numbers are hard errors — a value that cannot serialize
   canonically must not be hashed at all.
2. Object keys sort by UTF-16 code-unit order. Applies recursively.
3. Strings (keys and values) are Unicode-normalized to **NFC**, then JSON-escaped by
   the ECMA-262 `JSON.stringify` string algorithm.
4. Numbers serialize by the ECMA-262 number-to-string algorithm (`JSON.stringify` of
   a finite number).
5. No insignificant whitespace anywhere.
6. Arrays keep their element order. Arrays with a canonical order are sorted **before**
   serialization by the rule of the containing structure:
   - `records` sorts by `leafId` in binary (code-unit) order;
   - `audit` keeps event order (its `seq` must be strictly increasing — validated).

## Fill content hash

`contentHash = SHA-256( canonical({fillFormatVersion, class, schemaHash, records, audit}) )`
— every field of the file except `contentHash` itself. The exported file is exactly
the canonical body with `"contentHash"` spliced as the final field, so identical
content exports byte-identical files regardless of insertion order (shuffle-tested).

Record fields in canonical form: `leafId`, `value`, `citation{pub, locator, edition?}`,
`methodNote?`, `enteredBy`, `entryMethod`, `verifiedBy?`, `verifyMethod?`,
`fictitious?` (TRAINING only). Absent optionals are omitted entirely, never null.

The class is inside the hash: relabeling a TRAINING file as DOCTRINE breaks integrity
and the file refuses as CORRUPT.

## Schema hash

`schemaHash = SHA-256( canonical(sorted-by-id semantic fields of every leaf) )` where
the semantic fields are `id, unit, kind, meaningVersion, pubPointer, citationKind,
safetyCritical`, plus numeric `bounds/divisor/integer/roundingDirection/maxDecimals`
or check `coherence`. Copy fields (`name`, `plainName`, `batch`, definition prose)
are NOT hashed; definition semantics enter through `meaningVersion` (B8), and a CI
gate fails a definition edit without a `meaningVersion` bump.

## What the hash does and does not claim

The file is **evident against accidental or naive modification only** — a rewritten
file with a recomputed hash is indistinguishable. Custody plus the externally
recorded hash (the commissioning ceremony's typed
`I recorded this hash outside this machine` acknowledgment) are the controls (B5).
Export lineage (`parentExportHash`, Fill Station R1) provides fork detection.

## Worked vector

Input (logical value):

```json
{
  "fillFormatVersion": 2,
  "class": "DOCTRINE",
  "schemaHash": "aaaa…aaaa (64 × 'a')",
  "records": [{ "leafId": "pos.one_man.hole.D", "value": 4,
                "citation": { "pub": "EXAMPLE-PUB", "locator": "fig. X-1" },
                "enteredBy": "A. Example", "entryMethod": "file-import" }],
  "audit": [{ "seq": 1, "at": "2000-01-01T00:00:00Z", "type": "entry" }]
}
```

Canonical bytes:

```
{"audit":[{"at":"2000-01-01T00:00:00Z","seq":1,"type":"entry"}],"class":"DOCTRINE","fillFormatVersion":2,"records":[{"citation":{"locator":"fig. X-1","pub":"EXAMPLE-PUB"},"enteredBy":"A. Example","entryMethod":"file-import","leafId":"pos.one_man.hole.D","value":4}],"schemaHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}
```

`contentHash`:

```
59396a4ae2cb1cec7aead792416f84c1f06a1aedc7e68a6c574a7fe115709a27
```

SHA-256 reference vectors (FIPS 180-4, also asserted in tests):
`"" → e3b0c442…7852b855`, `"abc" → ba7816bf…f20015ad`.
