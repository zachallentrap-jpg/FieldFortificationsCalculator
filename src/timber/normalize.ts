// TIMBER-2 — spec normalization (plan §3.1, TD5).
//
// TWO functions that are deliberately NOT one:
//
//   normalizeSpec   clamps values to their cited bounds and REPORTS every adjustment as a
//                   visible SpecIssue. It never reorders anything. That restraint is the
//                   whole of TD5: the legacy wall generator emits opening framing in input
//                   order and bakes that order into per-role member ids, so a "helpful" sort
//                   here would silently renumber members that the compat goldens pin.
//
//   canonicalizeSpec  IS allowed to sort — total order, fixed key order — and is used only
//                   where a canonical form is the point: catalog presets, golden fixtures,
//                   serialization, hashing. It never touches the generate path.
//
// Clamping is visible by construction: an out-of-range value produces a clamped value AND an
// issue the workbench renders. Silent correction is how a tool teaches the wrong number.

import type {
  BuildingSpec, HutSpec, OpeningSpec, StructureSpec, WallOpenings,
} from './spec';
import { SPEC_PATH_DEFS, WALL_ORDER, specPath } from './spec';
import type { WallId } from './types';
import { SPAN, LUMBER } from './doctrine';

export interface SpecIssue {
  path: string; // dotted spec path
  // 'span': a member is past its span table. Distinct from 'clamped' on purpose — nothing
  // was changed, which is the whole point of mandate #2.
  kind: 'clamped' | 'dropped' | 'forced' | 'ls-note' | 'span';
  message: string; // plain language — this is shown to the user, not logged
  severity?: 'info' | 'warn' | 'error';
}

export interface NormalizeResult {
  spec: StructureSpec;
  issues: SpecIssue[];
}

const round = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Clamp one numeric knob against its registry entry, recording the adjustment. */
function clampPath(value: number, path: string, issues: SpecIssue[], label?: string): number {
  const def = specPath(path);
  if (!def || !Number.isFinite(value)) {
    if (!Number.isFinite(value)) {
      issues.push({ path, kind: 'clamped', message: `${label ?? path} was not a number — using 0.`, severity: 'error' });
      return 0;
    }
    return value;
  }
  let out = value;
  if (def.min !== undefined && out < def.min) out = def.min;
  if (def.max !== undefined && out > def.max) out = def.max;
  out = round(out);
  if (out !== round(value)) {
    const cite = def.cite ? ` (${def.cite})` : '';
    issues.push({
      path,
      kind: 'clamped',
      message: `${def.label} ${value} is outside ${def.min}–${def.max}${cite}; using ${out}.`,
      severity: 'warn',
    });
  }
  return out;
}

/**
 * The smallest header the table allows for this span. Past the deepest row it hands back that
 * row and lets the span checker say so — the same discipline as the bunker's stringer table: a
 * lookup does not get to extrapolate past where somebody has looked.
 */
export function headerForSpan(widthFt: number): string {
  const table = SPAN.header.value as Record<string, number>;
  const rows = Object.entries(table).sort((a, b) => a[1] - b[1]);
  // Never SMALLER than the doctrine default. The first cut of this function returned the
  // smallest row that fit, which quietly shaved every 3-ft window from a 2x6 down to a 2x4 —
  // weakening the standard design in the name of a check meant to catch openings that are too
  // WIDE. The floor is what FM 5-426 frames a header out of; the table only ever deepens it.
  const floorIdx = rows.findIndex(([n]) => n === (LUMBER.headerNominal.value as string));
  const fitIdx = rows.findIndex(([, max]) => max >= widthFt - 1e-6);
  const pick = Math.max(floorIdx, fitIdx === -1 ? rows.length - 1 : fitIdx);
  return rows[pick]![0];
}

function normalizeOpenings(
  openings: WallOpenings | undefined,
  runFor: (w: WallId) => number,
  basePath: string,
  issues: SpecIssue[],
): WallOpenings {
  const out: WallOpenings = {};
  if (!openings) return out;
  // I-15: walk the const wall order, never Object.keys — key order must not reach the model.
  for (const wall of WALL_ORDER) {
    const list = openings[wall];
    if (!list || list.length === 0) continue;
    const run = runFor(wall);
    const kept: OpeningSpec[] = [];
    list.forEach((o, i) => {
      const p = `${basePath}.${wall}[${i}]`;
      const width = clampPath(o.widthFt, 'openings[].widthFt', issues, `Opening width on wall ${wall}`);
      const height = clampPath(o.heightFt, 'openings[].heightFt', issues, `Opening height on wall ${wall}`);
      const sill = clampPath(o.sillHeightFt, 'openings[].sillHeightFt', issues, `Sill height on wall ${wall}`);
      // Impossible topology is an ERROR and the opening is dropped — never a NaN downstream.
      if (width >= run) {
        issues.push({
          path: p,
          kind: 'dropped',
          message: `An opening ${width} ft wide does not fit wall ${wall} (${round(run)} ft) — dropped.`,
          severity: 'error',
        });
        return;
      }
      let offset = clampPath(o.offsetFt, 'openings[].offsetFt', issues, `Opening offset on wall ${wall}`);
      if (offset + width > run) {
        const fixed = round(Math.max(0, run - width));
        issues.push({
          path: p,
          kind: 'clamped',
          message: `Opening at ${offset} ft would run past the end of wall ${wall}; moved to ${fixed} ft.`,
          severity: 'warn',
        });
        offset = fixed;
      }
      kept.push({ ...o, offsetFt: offset, widthFt: width, heightFt: height, sillHeightFt: sill });
    });
    // Order is PRESERVED exactly as supplied (TD5).
    if (kept.length > 0) out[wall] = kept;
  }
  return out;
}

function normalizeBuilding(spec: BuildingSpec, issues: SpecIssue[]): BuildingSpec {
  const lengthFt = clampPath(spec.dims.lengthFt, 'dims.lengthFt', issues);
  const widthFt = clampPath(spec.dims.widthFt, 'dims.widthFt', issues);

  let stories = spec.stories;
  if (stories.length === 0) {
    issues.push({ path: 'stories', kind: 'clamped', message: 'A building needs at least one story; added one.', severity: 'warn' });
    stories = [{ wallHeightFt: 8, openings: {} }];
  }
  if (stories.length > 2) {
    issues.push({ path: 'stories', kind: 'clamped', message: 'Three or more stories are out of scope; kept the first two.', severity: 'warn' });
    stories = stories.slice(0, 2);
  }

  const runFor = (w: WallId): number => (w === 'S' || w === 'N' ? lengthFt : widthFt);
  const normStories = stories.map((s, i) => ({
    ...s,
    wallHeightFt: clampPath(s.wallHeightFt, `stories.${Math.min(i, 1)}.wallHeightFt`, issues),
    openings: normalizeOpenings(s.openings, runFor, `stories.${i}.openings`, issues),
  }));

  // openFront (storage shed): that wall is posts + header, so it can carry no openings.
  if (spec.openFront) {
    for (const s of normStories) {
      if (s.openings[spec.openFront]?.length) {
        issues.push({
          path: `stories.0.openings.${spec.openFront}`,
          kind: 'dropped',
          message: `Wall ${spec.openFront} is the open front — its openings were dropped (the whole wall is the opening).`,
          severity: 'warn',
        });
        delete s.openings[spec.openFront];
      }
    }
  }

  let roof = spec.roof;
  if (roof.kind === 'gable' || roof.kind === 'shed' || roof.kind === 'hip' || roof.kind === 'pyramid') {
    roof = {
      ...roof,
      risePer12: clampPath(roof.risePer12, 'roof.risePer12', issues),
      overhangFt: clampPath(roof.overhangFt, 'roof.overhangFt', issues),
    };
  } else if (roof.kind === 'flat') {
    // TD7: a "flat" TO roof still drains. Floored at 1:12 because that is the minimum slope
    // double-coverage roll roofing is rated for, and built-up roofing is not modeled.
    const drain = clampPath(roof.drainPer12 ?? 1, 'roof.drainPer12', issues);
    roof = { ...roof, overhangFt: clampPath(roof.overhangFt, 'roof.overhangFt', issues), drainPer12: drain };
  }

  let foundation = spec.foundation;
  if (foundation.kind === 'piers' || foundation.kind === 'wall') {
    foundation = { ...foundation, crawlFt: clampPath(foundation.crawlFt, 'foundation.crawlFt', issues) };
  } else if (foundation.kind === 'basement') {
    foundation = { ...foundation, depthFt: clampPath(foundation.depthFt, 'foundation.depthFt', issues) };
  } else if (foundation.kind === 'embedded') {
    foundation = { ...foundation, embedFt: clampPath(foundation.embedFt, 'foundation.embedFt', issues) };
  }

  const out: BuildingSpec = {
    ...spec,
    dims: { lengthFt, widthFt },
    stories: normStories,
    roof,
    foundation,
  };

  // gap-11: a second story with no interior stair is LEGAL minute control — but it must not
  // strand the floor. The access subsystem emits an exterior ladder instead, and the user is
  // told, because "why is there no stair" should never be a mystery.
  if (out.stories.length === 2 && out.interiorStairs === false) {
    issues.push({
      path: 'interiorStairs',
      kind: 'ls-note',
      message: 'No interior stair: the second floor is reached by an exterior ladder. Ladder construction is life-safety — check the register.',
      severity: 'warn',
    });
  }
  return out;
}

function normalizeHut(spec: HutSpec, issues: SpecIssue[]): HutSpec {
  const lengthFt = clampPath(spec.dims.lengthFt, 'dims.lengthFt', issues);
  const widthFt = clampPath(spec.dims.widthFt, 'dims.widthFt', issues);
  const runFor = (w: WallId): number => (w === 'S' || w === 'N' ? lengthFt : widthFt);
  const out: HutSpec = {
    ...spec,
    dims: { lengthFt, widthFt },
    openings: normalizeOpenings(spec.openings, runFor, 'openings', issues),
  };
  if (spec.variant === 'latrine') {
    const seats = spec.latrine?.seats === 2 ? 2 : 4;
    const depthFt = clampPath(spec.latrine?.depthFt ?? 6, 'latrine.depthFt', issues);
    out.latrine = { seats, depthFt };
  } else if (spec.latrine) {
    issues.push({ path: 'latrine', kind: 'dropped', message: 'Latrine settings only apply to the latrine — dropped.', severity: 'info' });
    delete out.latrine;
  }
  return out;
}

/**
 * Clamp and report. Never reorders (TD5). Idempotent: normalizing a normalized spec produces
 * the same spec and no new issues — asserted in `timber2-spec`.
 */
export function normalizeSpec(spec: StructureSpec): NormalizeResult {
  const issues: SpecIssue[] = [];
  switch (spec.family) {
    case 'building':
      return { spec: normalizeBuilding(spec, issues), issues };
    case 'hut':
      return { spec: normalizeHut(spec, issues), issues };
    case 'tower': {
      const out = { ...spec };
      // EM 385-1-1 (plan TD32): above the cage threshold a fixed ladder is not an acceptable
      // sole means of access, and the cage is IN-later — so the tall towers get a stair. This
      // is a FORCE, not a bounds clamp: the user asked for something unsafe and is told.
      if ((spec.platformHeightFt === 24 || spec.platformHeightFt === 32) && spec.access === 'ladder') {
        out.access = 'stair';
        issues.push({
          path: 'access',
          kind: 'forced',
          message: `A ${spec.platformHeightFt}-ft climb is past the fixed-ladder cage threshold (EM 385-1-1, PH) — switched to a switchback stair.`,
          severity: 'warn',
        });
      }
      if (spec.footing === 'timber-mudsill' && spec.platformHeightFt >= 24) {
        issues.push({
          path: 'footing',
          kind: 'ls-note',
          message: 'Tall towers default to concrete pad footings; a timber mudsill at this height needs a soil check.',
          severity: 'warn',
        });
      }
      return { spec: out, issues };
    }
    case 'bunker': {
      const out: StructureSpec = {
        ...spec,
        interiorLengthFt: clampPath(spec.interiorLengthFt, 'interiorLengthFt', issues),
        interiorWidthFt: clampPath(spec.interiorWidthFt, 'interiorWidthFt', issues),
        clearHeightFt: clampPath(spec.clearHeightFt, 'clearHeightFt', issues),
        designCoverDepthFt: clampPath(spec.designCoverDepthFt, 'designCoverDepthFt', issues),
      };
      return { spec: out, issues };
    }
    case 'tentFrame': {
      const out = { ...spec };
      if (spec.tent === 'temper') {
        out.temperBays = clampPath(spec.temperBays ?? 4, 'temperBays', issues);
      } else if (spec.temperBays !== undefined) {
        issues.push({ path: 'temperBays', kind: 'dropped', message: 'Bay count applies to TEMPER tents only — dropped.', severity: 'info' });
        delete out.temperBays;
      }
      return { spec: out, issues };
    }
    case 'platform': {
      const out = {
        ...spec,
        dims: {
          lengthFt: clampPath(spec.dims.lengthFt, 'dims.lengthFt', issues),
          widthFt: clampPath(spec.dims.widthFt, 'dims.widthFt', issues),
        },
        deckHeightFt: clampPath(spec.deckHeightFt, 'deckHeightFt', issues),
        ramp: spec.ramp ? { ...spec.ramp, widthFt: clampPath(spec.ramp.widthFt, 'ramp.widthFt', issues) } : undefined,
      };
      return { spec: out, issues };
    }
  }
}

// ── canonicalizeSpec ─────────────────────────────────────────────────────────

function sortOpenings(a: OpeningSpec, b: OpeningSpec): number {
  // Total order with tie-breaks, so equal offsets are still deterministic.
  return (
    a.offsetFt - b.offsetFt ||
    a.widthFt - b.widthFt ||
    a.heightFt - b.heightFt ||
    a.sillHeightFt - b.sillHeightFt ||
    (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0)
  );
}

function canonicalOpenings(openings: WallOpenings | undefined): WallOpenings {
  const out: WallOpenings = {};
  if (!openings) return out;
  for (const wall of WALL_ORDER) {
    const list = openings[wall];
    if (!list || list.length === 0) continue;
    out[wall] = [...list].sort(sortOpenings);
  }
  return out;
}

/**
 * A canonical form for presets, goldens, serialization and hashing ONLY (TD5). Two specs that
 * describe the same structure canonicalize to byte-identical JSON — which is what makes a
 * share link stable and a golden diff meaningful. Never called on the generate path.
 */
export function canonicalizeSpec(spec: StructureSpec): StructureSpec {
  switch (spec.family) {
    case 'building':
      return {
        ...spec,
        stories: spec.stories.map((s) => ({ ...s, openings: canonicalOpenings(s.openings) })),
      };
    case 'hut':
      return { ...spec, openings: canonicalOpenings(spec.openings) };
    default:
      return { ...spec };
  }
}

/** Deterministic JSON for a spec: sorted keys, canonical opening order. */
export function specToJson(spec: StructureSpec): string {
  const canon = canonicalizeSpec(spec);
  const stable = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(stable);
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, x]) => [k, stable(x)]));
  };
  return JSON.stringify(stable(canon));
}

/** Every numeric path the registry declares — used by the schema/clamp coverage test. */
export const CLAMPED_PATHS: readonly string[] = SPEC_PATH_DEFS.filter(
  (d) => d.min !== undefined || d.max !== undefined,
).map((d) => d.path);
