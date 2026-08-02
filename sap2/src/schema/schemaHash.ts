// schemaHash (blueprint §2.3): SHA-256 over the canonical serialization of every
// leaf's SEMANTIC identity, sorted by id. Copy edits to name/plainName/batch don't
// stale fills; any semantic change does — definition semantics enter via
// meaningVersion (B8), and a CI gate diffs definition text against meaningVersion
// bumps so prose edits can't silently change meaning.

import { canonicalJson, sortedByKey, type CanonValue } from './canon';
import { sha256Hex } from './sha256';
import { isNumericLeaf, type SchemaLeaf } from './leaf';

const semanticFields = (l: SchemaLeaf): CanonValue => {
  const common = {
    id: l.id,
    unit: l.unit,
    kind: l.kind,
    meaningVersion: l.meaningVersion,
    pubPointer: l.pubPointer,
    citationKind: l.citationKind,
    safetyCritical: l.safetyCritical,
  };
  if (isNumericLeaf(l)) {
    return {
      ...common,
      bounds: l.bounds.kind === 'sign'
        ? { kind: 'sign', sign: l.bounds.sign }
        : { kind: 'range', min: l.bounds.min, max: l.bounds.max },
      divisor: l.divisor,
      integer: l.integer,
      roundingDirection: l.roundingDirection,
      maxDecimals: l.maxDecimals,
    };
  }
  if (l.unit === 'text' && l.coherence) {
    return {
      ...common,
      coherence: {
        governingDimKey: l.coherence.governingDimKey,
        bodyUnitId: l.coherence.bodyUnitId,
        toleranceFt: l.coherence.toleranceFt,
      },
    };
  }
  return common;
};

export const computeSchemaHash = (leaves: readonly SchemaLeaf[]): string =>
  sha256Hex(canonicalJson(sortedByKey(leaves, (l) => l.id).map(semanticFields)));
