// Canonical serialization (blueprint §2.6, B21) — the byte layer every hash in the
// regime is computed over. Rules, exactly as specced in docs/HASHING.md:
//   object keys sorted by UTF-16 code unit; strings NFC-normalized then JSON-escaped;
//   numbers via ECMA-262 ToString (JSON.stringify of a finite number); no insignificant
//   whitespace; arrays keep their order (record ARRAYS are sorted by the caller's
//   stated key before serialization — sortedByLeafId below). Non-finite numbers and
//   undefined are hard errors, never silently dropped: a value that cannot serialize
//   canonically must not be hashed at all.

export type CanonValue =
  | string | number | boolean | null
  | readonly CanonValue[]
  | { readonly [k: string]: CanonValue };

export class CanonError extends Error {
  override readonly name = 'CanonError';
}

export const canonicalJson = (v: CanonValue): string => {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'string':
      return JSON.stringify(v.normalize('NFC'));
    case 'number':
      if (!Number.isFinite(v)) throw new CanonError('non-finite number cannot serialize canonically');
      return JSON.stringify(v);
    case 'boolean':
      return v ? 'true' : 'false';
    case 'object': {
      if (Array.isArray(v)) return '[' + v.map((x) => canonicalJson(x as CanonValue)).join(',') + ']';
      const keys = Object.keys(v).sort();
      const parts: string[] = [];
      for (const k of keys) {
        const val = (v as Record<string, CanonValue | undefined>)[k];
        if (val === undefined) throw new CanonError(`undefined at key ${k} cannot serialize canonically`);
        parts.push(JSON.stringify(k.normalize('NFC')) + ':' + canonicalJson(val));
      }
      return '{' + parts.join(',') + '}';
    }
    default:
      throw new CanonError(`unserializable value of type ${typeof v}`);
  }
};

/** Sort a record array by a string key using binary (code-unit) order — the stated
 *  canonical order for fill records (§2.6). */
export const sortedByKey = <T>(items: readonly T[], key: (t: T) => string): readonly T[] =>
  [...items].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
