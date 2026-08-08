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
  BuildingSpec, HutSpec, OpeningSpec, StructureSpec, StructureFamily, SpecSection, WallOpenings,
} from './spec';
import { SPEC_PATH_DEFS, SPEC_SECTION_FALLBACK, SPEC_SECTIONS_BUILDING, SPEC_SECTIONS_COMMON, WALL_ORDER, specPath } from './spec';
import type { WallId } from './types';
import { DRESSED } from './types';
import { SPAN, LUMBER, ROOFING, LADDER, IN_PER_FT } from './doctrine';
import { defaultOpenings } from './openings';
import { hutDims } from './families/hut';

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

/**
 * The tallest rough opening this wall can carry, given the header its width demands.
 *
 * A wall is not `wallHeightFt` of clear space. The sole plate eats the bottom, the doubled top
 * plate eats the top, and the header — sized by SPAN, not by what is left over — eats whatever
 * it needs above the opening. Everything left is available for sill + opening:
 *
 *   sole (1½") + sill + opening + header ≤ wallHeight − top plate (1½") − cap plate (1½")
 *
 * The storage shed is what this was written for. Its 8-ft door needs a 2x10 by the span table
 * (see DECISIONS on header sizing), a 2x10 is 9¼ in deep, and an 8-ft wall leaves 91½ in
 * between plates — so a 7-ft door needs 93¼ in of a wall that has 91½. The header was drawn
 * running 1¾ in THROUGH the top plate: two solid members in the same space, on a shipped card,
 * hidden by siding and visible the moment the framing stage was rendered.
 */
export function maxOpeningTopFt(wallHeightFt: number, widthFt: number, headerNominal?: string): number {
  const plate = DRESSED[LUMBER.plateNominal.value as string]!.w / IN_PER_FT;
  const headerD = DRESSED[headerNominal ?? headerForSpan(widthFt)]!.d / IN_PER_FT;
  return wallHeightFt - 3 * plate - headerD;
}

function normalizeOpenings(
  openings: WallOpenings | undefined,
  runFor: (w: WallId) => number,
  basePath: string,
  issues: SpecIssue[],
  wallHeightFt: number,
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
      // The opening plus its header has to fit under the plates. Clamped rather than dropped:
      // a door an inch too tall is a door that wants trimming, not a door nobody asked for.
      let openHeight = height;
      // Compared at the SAME precision the clamps round to. `clampPath` snaps every value to
      // 1e-6, so an opening sized exactly to the limit comes back a third of a millionth over
      // it and a raw `>` fires, reporting a cut to the number it already was.
      const maxTop = maxOpeningTopFt(wallHeightFt, width, o.headerNominal);
      if (round(sill + openHeight) > round(maxTop)) {
        const fixed = round(Math.max(0.5, maxTop - sill));
        issues.push({
          path: p,
          kind: 'clamped',
          message: `A ${round(width)} ft opening needs a ${o.headerNominal ?? headerForSpan(width)} header, `
            + `which does not leave ${round(openHeight)} ft under an ${round(wallHeightFt)} ft wall — cut to ${fixed} ft.`,
          severity: 'warn',
        });
        openHeight = fixed;
      }
      kept.push({ ...o, offsetFt: offset, widthFt: width, heightFt: openHeight, sillHeightFt: sill });
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
  // A SECOND STORY IS NOT BUILT, AND SAYING SO IS THE POINT. `generateBuilding` frames
  // `stories[0]` and nothing else — the story loop, the second floor bearing on the cap plates
  // and the interior stairwell are T6b, which the plan parks on its own descope ladder. What
  // was wrong was not the parking, it was the silence: a two-story spec normalized with ZERO
  // issues and then generated a model byte-identical to the one-story it was not. The picture,
  // the cut list and the packet all quietly described a different building than the one asked
  // for, and nothing anywhere said so. Clamped and warned, like every other out-of-scope input.
  if (stories.length > 1) {
    issues.push({
      path: 'stories',
      kind: 'clamped',
      message: 'This engine frames one story; the upper stories were dropped.',
      severity: 'warn',
    });
    stories = stories.slice(0, 1);
  }

  const runFor = (w: WallId): number => (w === 'S' || w === 'N' ? lengthFt : widthFt);
  const normStories = stories.map((s, i) => {
    // Clamp the wall height FIRST: an opening's headroom is measured against the wall the
    // model will actually build, not the one that was asked for.
    const wallHeightFt = clampPath(s.wallHeightFt, `stories.${Math.min(i, 1)}.wallHeightFt`, issues);
    return {
      ...s,
      wallHeightFt,
      openings: normalizeOpenings(s.openings, runFor, `stories.${i}.openings`, issues, wallHeightFt),
    };
  });

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

  // THE ROOF ARRIVES FROM OUTSIDE. `decodeSpec` accepts any JSON with a `family` key, so the
  // roof this function is handed is whatever a share link said it was — and until this block ran
  // it was trusted to be a well-formed member of the union. Three ways it was not, all of them
  // reachable by pasting a link and all of them measured:
  //
  //   · `roof` absent entirely     → threw on `.kind`; the workbench sat on "Laying out the
  //                                  frame…" forever, with no canvas and nothing said.
  //   · `kind` not in the union    → framed 656 members and NO ROOF, with zero issues. The same
  //                                  silence the pyramid note below was written about.
  //   · `shed` with no `highSide`  → threw on `walls.surfaces.find(…)!` in `generateShed`. The
  //                                  panel always writes one, so only a hand-made link gets here.
  //
  // A thrown generator is the worst of the three: the shell renders, the spinner never stops, and
  // the user is looking at a page that appears to be working. Everything below repairs and SAYS
  // SO, which is this file's whole contract.
  const ROOF_KINDS = new Set(['gable', 'shed', 'flat', 'hip', 'pyramid', 'none']);
  let roof = spec.roof;
  if (!roof || typeof roof !== 'object' || typeof (roof as { kind?: unknown }).kind !== 'string') {
    issues.push({
      path: 'roof',
      kind: 'clamped',
      message: 'This build arrived with no roof at all — framed as the standard gable so there is something to look at.',
      severity: 'warn',
    });
    roof = { kind: 'gable', risePer12: 4, overhangFt: 1 };
  } else if (!ROOF_KINDS.has(roof.kind)) {
    issues.push({
      path: 'roof.kind',
      kind: 'clamped',
      message: `"${roof.kind}" is not a roof this tool frames — framed as the standard gable. The kinds it knows are gable, shed, hip, flat and none.`,
      severity: 'warn',
    });
    roof = { kind: 'gable', risePer12: 4, overhangFt: 1 };
  }
  // A BUILDING HAS NO PYRAMID. `pyramid` is the guard tower's cab roof and the tower generator
  // owns it; the building path frames gable, hip, shed and flat and silently framed NOTHING for
  // a pyramid. The picker never offers it, so this only arrived through a shared link — and
  // `decodeSpec` takes any JSON with a `family` key — but what came back was a building open to
  // the sky under a single tilted plank of roofing, with the ceiling and rafter stages both
  // empty and not one word said about it.
  //
  // Hip is the honest nearest thing rather than a refusal: a pyramid IS a hip whose ridge has
  // shrunk to a point, which is what a hip already does on a square plan, and on a rectangular
  // plan a pyramid is not definable at one pitch at all. Said out loud, the way every other
  // downgrade in this file is.
  if (roof.kind === 'pyramid') {
    issues.push({
      path: 'roof.kind',
      kind: 'clamped',
      message: 'A pyramid roof belongs to the guard tower cab — this building was framed as a hip, which is the same roof with the ridge shrunk to a point.',
      severity: 'warn',
    });
    roof = { ...roof, kind: 'hip' };
  }
  if (roof.kind === 'shed' && !WALL_ORDER.includes(roof.highSide)) {
    // A shed is one slope, and which way it runs is the whole shape of the building — so this is
    // not a field that can be left out. `generateShed` looks the wall up and takes the answer as
    // given; with nothing to find it threw, and a thrown generator is a workbench that never
    // stops loading. North matches what the panel writes, so an app-made link and a hand-made
    // one now describe the same roof.
    const was = (roof as { highSide?: unknown }).highSide;
    issues.push({
      path: 'roof.highSide',
      kind: 'clamped',
      message: was === undefined
        ? 'A shed roof has to say which wall is the high one — took the north wall.'
        : `"${String(was)}" is not a wall (they are N, S, E and W) — took the north wall as the high side.`,
      severity: 'warn',
    });
    roof = { ...roof, highSide: 'N' };
  }
  if (roof.kind === 'gable' || roof.kind === 'shed' || roof.kind === 'hip') {
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

  // ROLL ROOFING HAS A MINIMUM SLOPE, and the toolkit was printing it on every course of roofs
  // that broke it. `rollMinSlopePer12` (2) and `rollDoubleMinSlopePer12` (1) sat in doctrine used
  // for nothing but the `doctrineRef` string stamped on each piece — so a 1-in-12 gable under
  // single-coverage roll came out clean, citing "FM 5-426 exposed-nail roll roofing minimum
  // slope" on a roof half the slope that rule requires. The rule was stated on the drawing and
  // enforced nowhere.
  //
  // The flat-roof floor two branches up is the same rule read the other way — "floored at 1:12
  // because that is the minimum double-coverage roll roofing is rated for" — which is only true
  // if the roofing IS double coverage. Plain roll on a flat roof is a leak.
  //
  // WARN, never substitute. This module clamps numbers; it does not choose materials. Handing
  // back a different roofing than the one asked for would put a covering on the drawing that
  // nobody selected, and the operator would learn nothing.
  const rollMin = ROOFING.rollMinSlopePer12.value as number;
  const rollDoubleMin = ROOFING.rollDoubleMinSlopePer12.value as number;
  const risePer12 = roof.kind === 'flat' ? (roof.drainPer12 ?? 1)
    : roof.kind === 'none' ? Infinity
    : roof.risePer12;
  const minFor = spec.coverings.roofing === 'roll' ? rollMin
    : spec.coverings.roofing === 'rollDouble' ? rollDoubleMin
    : 0;
  if (minFor > 0 && risePer12 < minFor - 1e-9) {
    const label = spec.coverings.roofing === 'roll' ? 'Exposed-nail roll roofing' : 'Double-coverage roll roofing';
    const remedy = spec.coverings.roofing === 'roll'
      ? ` Double coverage is rated to ${rollDoubleMin} in 12, or raise the pitch.`
      : ' Raise the pitch — nothing rolled goes lower.';
    issues.push({
      path: 'coverings.roofing',
      kind: 'ls-note',
      message: `${label} needs ${minFor} in 12 and this roof falls ${risePer12} in 12.`
        + `${remedy} The tool has NOT changed the covering.`,
      severity: 'warn',
    });
  }

  let foundation = spec.foundation;
  // WHAT IT STANDS ON, when the link named something this tool does not pour. `generateBuilding`
  // falls through its foundation switch to piers, so an unrecognised kind came out as a perfectly
  // ordinary pier foundation — 42 members, byte-identical to `{kind:'piers'}` — and said nothing.
  // The user asked for one thing and got another with no way to tell. Piers is still the answer;
  // the difference is that it is now an answer rather than an accident.
  const FOUNDATION_KINDS = new Set(['piers', 'wall', 'basement', 'slab', 'skids', 'embedded']);
  if (!FOUNDATION_KINDS.has(foundation?.kind)) {
    issues.push({
      path: 'foundation.kind',
      kind: 'clamped',
      message: `"${String(foundation?.kind)}" is not a foundation this tool builds — stood it on piers. It knows piers, a continuous wall, a basement, a slab, skids and embedded posts.`,
      severity: 'warn',
    });
    foundation = structuredClone(SPEC_SECTION_FALLBACK.foundation);
  }
  // A BUILDING HAS NO EMBEDDED POSTS. `'embedded'` is the tower's and the bunker's — their posts
  // are set in the ground — and the building path has no branch for it, so it fell through to a
  // pier foundation, 926 members byte-identical to `{kind:'piers'}`, and said nothing. Exactly
  // the pyramid-roof case a hundred lines up, and it gets the same treatment: piers is still the
  // answer, said out loud instead of arrived at by accident.
  if (foundation.kind === 'embedded') {
    issues.push({
      path: 'foundation.kind',
      kind: 'clamped',
      message: 'Embedded posts belong to the guard tower and the bunker, whose posts are set in the ground — this building was stood on piers.',
      severity: 'warn',
    });
    foundation = structuredClone(SPEC_SECTION_FALLBACK.foundation);
  }
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
  // RESOLVE THE VARIANT'S DOORS AND WINDOWS HERE, not downstream of this function. The hut
  // generator asked for them with `spec.openings ?? defaultOpenings(...)`, which cannot fire
  // once this line has turned an absent record into `{}` — so every hut in the toolkit built
  // itself blind, with no door and no window, no matter what its card said. Filling them in at
  // normalize also means the openings editor has something real to show and the operator can
  // move or delete them; an empty record now honestly means "none", because it can only have
  // got that way by somebody saying so.
  const hutWallHeightFt = spec.wallHeightFt ?? hutDims(spec.variant).wallHeightFt;
  const named = spec.openings ?? defaultOpenings(spec.variant, lengthFt, widthFt, hutWallHeightFt);
  const out: HutSpec = {
    ...spec,
    dims: { lengthFt, widthFt },
    openings: normalizeOpenings(named, runFor, 'openings', issues, hutWallHeightFt),
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
 * A section-shaped label for each thing a building-shaped spec must carry, for the message.
 */
const SECTION_NAMES: Record<SpecSection, string> = {
  dims: 'how big the building is',
  spacing: 'what the framing is spaced at',
  coverings: 'what it is closed in with',
  stories: 'its walls',
  roof: 'its roof',
  foundation: 'what it stands on',
};

/**
 * FILL IN WHOLE SECTIONS THAT NEVER ARRIVED.
 *
 * Everything else in this file repairs a FIELD — a number out of bounds, an opening past the end
 * of its wall. This repairs a spec that is missing a whole structural section, which is a
 * different failure and a much worse one: `clampPath` on `undefined.crawlFt` never runs, because
 * the generator reached `undefined` first and threw.
 *
 * That matters because `decodeSpec` accepts any JSON with a `family` key, so this is reachable by
 * pasting a URL. Measured on the shipped preset, deleting each top-level key one at a time: SIX
 * of the eight threw — `family`, `dims`, `spacing`, `coverings`, `stories` and `foundation`. Only
 * `roof` survived, and only because the previous pass had just fixed it, one field at a time. The
 * lesson from that pass was that a fix written for one value leaves the set; this is the set.
 *
 * A thrown generator is the worst outcome available here. The workbench shell renders — title
 * bar, Copy link, Command packet, the whole menu row — and the viewport shows a spinner reading
 * "Laying out the frame…" that never stops. No canvas, no members, no error. It does not look
 * broken; it looks slow.
 */
function repairSections(spec: StructureSpec, issues: SpecIssue[], sections: readonly SpecSection[]): StructureSpec {
  const s = spec as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  const missing: SpecSection[] = [];
  for (const key of sections) {
    const v = s[key];
    const ok = key === 'stories'
      ? Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null
      : typeof v === 'object' && v !== null && !Array.isArray(v);
    if (ok) continue;
    missing.push(key);
    out[key] = structuredClone(SPEC_SECTION_FALLBACK[key]);
  }
  if (missing.length > 0) {
    // ONE issue, not six. A link that arrived with nothing but a `family` key would otherwise
    // bury its own headline under a stack of identical lines.
    const named = missing.map((k) => SECTION_NAMES[k]).join(', ');
    issues.push({
      path: missing.length === 1 ? missing[0]! : 'spec',
      kind: 'clamped',
      message: `This build did not say ${named} — filled in with the standard values so there is something to look at. Check ${missing.length === 1 ? 'it' : 'them'} before building from this.`,
      severity: 'warn',
    });
  }
  return out as unknown as StructureSpec;
}

/**
 * Clamp and report. Never reorders (TD5). Idempotent: normalizing a normalized spec produces
 * the same spec and no new issues — asserted in `timber2-spec`.
 */
export function normalizeSpec(spec: StructureSpec): NormalizeResult {
  const issues: SpecIssue[] = [];
  // A spec that is not an object at all cannot name a family, and a family this tool does not
  // build fell off the end of the switch and returned `undefined` — which the caller destructures.
  const family = (spec as { family?: unknown } | null | undefined)?.family;
  const KNOWN: readonly StructureFamily[] = ['building', 'hut', 'tower', 'bunker', 'tentFrame', 'platform'];
  if (!KNOWN.includes(family as StructureFamily)) {
    issues.push({
      path: 'family',
      kind: 'clamped',
      message: family === undefined || family === null
        ? 'This build did not say what kind of structure it is — read as a framed building.'
        : `"${String(family)}" is not a structure this tool builds — read as a framed building.`,
      severity: 'warn',
    });
    const base = (spec && typeof spec === 'object' ? spec : {}) as unknown as Record<string, unknown>;
    return normalizeSpec2({ ...base, family: 'building' } as unknown as StructureSpec, issues);
  }
  return normalizeSpec2(spec, issues);
}

/**
 * `shutters` is a three-value enum on two different specs, and ANY string got through.
 *
 * `builtOpenings` tested it for `'none'` and treated everything else as the closed pair, so a
 * link carrying `shutters: "open"` — or a typo, or a value from a later version of this tool —
 * came back as shut windows with nothing said. The same shape as the roof kind and the
 * foundation kind above: repaired, and SAID.
 *
 * Mutates in place because it is the same object `repairSections` just handed back, and because
 * the field lives on two spec branches that are normalized separately further down.
 */
const SHUTTER_MODES = new Set(['none', 'side', 'propped']);

/**
 * THE COVERINGS SECTION TOOK ANY STRING, and two of its four fields then behaved like a real
 * choice: `siding: "nonsense"` and `roofing: "nonsense"` came back with the same member count as
 * a real answer, and `wallSheathing` and `roofDeck` came back with none and nothing said. A
 * share link is the only way to reach any of it — `decodeSpec` takes any JSON with a `family`
 * key — and a share link is exactly where a typo, or a value from a later version of this tool,
 * comes from.
 *
 * `roofDeck` also carried a fifth value, `'skip'`, that no card offered and no generator told
 * apart from `'none'`. It is gone from the type; a link still carrying it lands here and is
 * repaired to the thing it always meant, out loud.
 */
const COVERING_CHOICES: Record<string, { ok: string[]; fallback: string }> = {
  wallSheathing: { ok: ['none', 'plywood', 'boards'], fallback: 'none' },
  siding: { ok: ['none', 'plywood', 'boards', 'boardAndBatten'], fallback: 'none' },
  roofDeck: { ok: ['none', 'plywood', 'boards', 'purlins'], fallback: 'plywood' },
  roofing: { ok: ['none', 'roll', 'rollDouble', 'corrugated'], fallback: 'none' },
};

function repairCoverings(spec: StructureSpec, issues: SpecIssue[]): void {
  const cov = (spec as unknown as { coverings?: Record<string, unknown> }).coverings;
  if (!cov || typeof cov !== 'object') return;
  for (const [field, { ok, fallback }] of Object.entries(COVERING_CHOICES)) {
    const was = cov[field];
    if (was === undefined || (typeof was === 'string' && ok.includes(was))) continue;
    issues.push({
      path: `coverings.${field}`,
      kind: 'clamped',
      message: was === 'skip'
        ? 'A roof deck of "skip" was the same as none — took none, which is what it meant.'
        : `"${String(was)}" is not a ${field === 'roofDeck' ? 'roof deck' : field} this tool lays — took ${fallback === 'none' ? 'none' : fallback}. `
          + `The choices are ${ok.join(', ')}.`,
      severity: 'warn',
    });
    cov[field] = was === 'skip' ? 'none' : fallback;
  }
}

function repairShutters(spec: StructureSpec, issues: SpecIssue[]): void {
  const s = spec as { shutters?: unknown };
  if (s.shutters === undefined) return;
  if (typeof s.shutters === 'string' && SHUTTER_MODES.has(s.shutters)) return;
  issues.push({
    path: 'shutters',
    kind: 'clamped',
    message: `"${String(s.shutters)}" is not a way to hang a shutter — hung them side-hinged. `
      + 'The choices are none, side and propped.',
    severity: 'warn',
  });
  s.shutters = 'side';
}

/**
 * THE LAST OF THE UNGUARDED ENUMS.
 *
 * `decodeSpec` takes any JSON with a `family` key, so every one of these is reachable from a
 * pasted link — and a link is exactly where a typo, or a value from a later version of this tool,
 * comes from. Ten fields took any string and said nothing; nine of them fell through to whatever
 * their generator's `else` happened to be, and the tenth — the tent size — indexed a table with
 * it and THREW, which is the failure this file's own header calls the worst of the three: the
 * shell renders, the spinner never stops, and the page looks like it is working.
 *
 * The roof kind, the foundation kind, the shutter mode and the four coverings were already
 * guarded above. This is the same shape, table-driven because there is nothing to say about any
 * one of them that is not true of all ten.
 */
const FAMILY_CHOICES: { family: string; path: string; ok: string[]; fallback: string; what: string }[] = [
  { family: 'bunker', path: 'entrance', ok: ['open', 'baffle'], fallback: 'baffle', what: 'a way in' },
  { family: 'bunker', path: 'wallType', ok: ['post-plank', 'crib'], fallback: 'post-plank', what: 'a bunker wall' },
  { family: 'tower', path: 'access', ok: ['ladder', 'stair'], fallback: 'ladder', what: 'a way up' },
  { family: 'tower', path: 'footing', ok: ['timber-mudsill', 'concrete-pad'], fallback: 'concrete-pad', what: 'a footing' },
  { family: 'tower', path: 'cab.walls', ok: ['open-rail', 'half-wall', 'half-wall-screen'], fallback: 'half-wall-screen', what: 'a cab wall' },
  { family: 'tower', path: 'cab.roof', ok: ['pyramid', 'shed'], fallback: 'pyramid', what: 'a cab roof' },
  { family: 'platform', path: 'base', ok: ['piers', 'skids'], fallback: 'piers', what: 'a base' },
  { family: 'platform', path: 'deck', ok: ['plank', 'panel'], fallback: 'plank', what: 'a decking' },
  { family: 'tentFrame', path: 'tent', ok: ['gpSmall', 'gpMedium', 'temper'], fallback: 'gpMedium', what: 'a tent size' },
  { family: 'building', path: 'bridging', ok: ['cross', 'solid'], fallback: 'cross', what: 'a bridging' },
];

function repairFamilyChoices(spec: StructureSpec, issues: SpecIssue[]): void {
  for (const c of FAMILY_CHOICES) {
    if (spec.family !== c.family) continue;
    const parts = c.path.split('.');
    let holder = spec as unknown as Record<string, unknown>;
    for (const k of parts.slice(0, -1)) {
      const next = holder[k];
      if (!next || typeof next !== 'object') { holder = null as never; break; }
      holder = next as Record<string, unknown>;
    }
    if (!holder) continue;
    const leaf = parts[parts.length - 1]!;
    const was = holder[leaf];
    if (was === undefined || (typeof was === 'string' && c.ok.includes(was))) continue;
    issues.push({
      path: c.path,
      kind: 'clamped',
      message: `"${String(was)}" is not ${c.what} this tool builds — took ${c.fallback}. `
        + `The choices are ${c.ok.join(', ')}.`,
      severity: 'warn',
    });
    holder[leaf] = c.fallback;
  }
}

function normalizeSpec2(raw: StructureSpec, issues: SpecIssue[]): NormalizeResult {
  // Every family extends `SpecCommon`, so dims/spacing/coverings are repaired for all of them.
  // The three that only a BuildingSpec declares are repaired only for a building: a hut carries
  // none of them by design and the hut generator derives them from its variant, so demanding
  // them there would "repair" the shipped sea-hut card. Per-family fields beyond these — a
  // tower's `cabPlanFt`, a bunker's cover depth — are NOT covered here; recorded, not half-done.
  const spec = repairSections(
    raw,
    issues,
    raw.family === 'building' ? SPEC_SECTIONS_BUILDING : SPEC_SECTIONS_COMMON,
  );
  repairShutters(spec, issues);
  repairCoverings(spec, issues);
  repairFamilyChoices(spec, issues);
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
      //
      // AGAINST THE THRESHOLD, not against the two heights the picker happens to offer. The rule
      // was written as `=== 24 || === 32`, which covers the select's own options and nothing else
      // — so a 26-, 28- or 30-ft tower, reachable from a saved spec, a link or the custom card,
      // came back with a thirty-foot fixed ladder on it. The card's own help text states the real
      // rule ("Above 20 ft a fixed ladder is not an acceptable sole means of access") and
      // `LADDER.cageThresholdFt` is the figure; both were already right.
      const cage = LADDER.cageThresholdFt.value as number;
      if (spec.platformHeightFt > cage && spec.access === 'ladder') {
        out.access = 'stair';
        issues.push({
          path: 'access',
          kind: 'forced',
          message: `A ${spec.platformHeightFt}-ft climb is past the ${cage}-ft fixed-ladder cage threshold (EM 385-1-1, PH) — switched to a switchback stair.`,
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
