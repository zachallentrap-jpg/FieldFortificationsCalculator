// TRAINING — deck compilation (TRAINING_AND_PACKETS_PLAN §2.4.1, F1). Pure, node-tested.
//
// FD1, and it is the reason this file exists rather than a folder of hand-written cards:
// **the deck and the cut list are projections of the same model.** The spec that generates
// your take-off generates your cards. Change the building — swap the roof, add a story, widen
// the span — and the deck changes with it. A hand-authored deck goes stale the first time the
// engine changes a nominal, and a teaching aid that quietly teaches the wrong thing is worse
// than no teaching aid.
//
// CITE DISCIPLINE (TR-2b). Every fact carries where it came from:
//   · `doctrine` — the engine's own `doctrineRef` for THIS member. Cite required.
//   · `this-build` — a size or a length the operator's own configuration produced. Cite
//     FORBIDDEN, because attaching a manual reference to a number the user chose is how a
//     tool launders a preference into doctrine.
//   · `count` — how many of them this build has. Also the user's, also no cite.
// The distinction is not decoration: it is what lets a Marine tell "the manual says" from
// "this drawing says", which is the single most important thing a training aid can teach.

import type { Member, MemberRole } from '../types';
import type { StructureModel } from '../families/index';
import type { CardSpec, CitedFact, DeckSpec, QuizMode, StageDrillEntry } from './core';

/** Injected so this module stays pure and node-testable — `labels.ts` lives in the UI tree. */
export interface LabelSource {
  plainName(role: MemberRole): string;
  whatItDoes(role: MemberRole): string | undefined;
}

export interface CompileInput {
  model: StructureModel;
  deckId: string;
  title: string;
  labels: LabelSource;
  /** Feet-inches formatter, injected for the same reason. */
  fmtFtIn(inches: number): string;
}

/** The line every TIMBER card carries. Content, not chrome — it prints with the card. */
export const TIMBER_REGIME_LINE = '(PH) beside a citation means the manual page check is still pending.';

/** Roles that are structure rather than teaching material — a card each would be noise. */
const SKIP: ReadonlySet<string> = new Set(['soilGhost']);

/**
 * Where this role sits, in one sentence, derived from the model rather than written down.
 * Position-derived so it stays true when the building changes: a card that says "in the wall"
 * about a member the user just moved to the roof is a card that has stopped being true.
 */
function whereItGoes(role: MemberRole, members: Member[], model: StructureModel, plain: string): string {
  const ys = members.map((m) => m.position[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const deck = model.levels.subfloorTop;
  const plate = deck + 8;
  const band = hi < deck - 0.2 ? 'below the floor'
    : lo < deck + 0.2 && hi < plate ? 'at floor level'
      : lo >= plate - 0.5 ? 'up in the roof'
        : 'in the walls';
  const walls = [...new Set(members.map((m) => m.wall).filter(Boolean))];
  const where = walls.length > 0 && walls.length < 4 ? ` on the ${walls.join('/')} wall${walls.length > 1 ? 's' : ''}` : '';
  const stage = model.stagePlan.find((s) => s.ordinal === Math.min(...members.map((m) => m.stage)));
  return `${plain.charAt(0).toUpperCase()}${plain.slice(1)} — ${band}${where}, gone in at "${stage?.label ?? `stage ${members[0]!.stage}`}".`;
}

function factsFor(role: MemberRole, members: Member[], fmtFtIn: (n: number) => string): CitedFact[] {
  const m = members[0]!;
  const lengths = [...new Set(members.map((x) => Math.round(x.cutLength * 8) / 8))].sort((a, b) => b - a);
  const facts: CitedFact[] = [
    // Size and length are THIS BUILD's — the operator's dimensions produced them, so no cite.
    { label: 'Stock', text: m.nominal, source: 'this-build' },
    {
      label: 'Cut to',
      text: lengths.length === 1
        ? fmtFtIn(lengths[0]!)
        : `${fmtFtIn(lengths[lengths.length - 1]!)} – ${fmtFtIn(lengths[0]!)} (${lengths.length} lengths)`,
      source: 'this-build',
    },
    { label: 'How many', text: `${members.length}`, source: 'count' },
  ];
  // The nailing schedule and the reference behind it ARE doctrine, and travel together.
  if (m.nailing && !/^\d+d common/.test(m.nailing)) {
    facts.push({ label: 'Fastened', text: m.nailing.replace(/\s*\(PH\)\s*$/, ''), source: 'doctrine', cite: m.doctrineRef });
  } else {
    facts.push({ label: 'Reference', text: m.doctrineRef, source: 'doctrine', cite: m.doctrineRef });
  }
  if (m.angles?.plumbCut !== undefined) {
    facts.push({
      label: 'Cuts',
      text: `plumb ${m.angles.plumbCut.toFixed(1)}°, seat ${(m.angles.seatCut ?? 0).toFixed(1)}°`,
      source: 'this-build',
    });
  }
  return facts;
}

/** Which modes a card can be drilled in. Every card flips; scene modes need a real member. */
function modesFor(role: MemberRole, members: Member[]): QuizMode[] {
  const modes: QuizMode[] = ['flip', 'flip-reverse', 'identify'];
  if (members.length > 0) modes.push('name-to-part');
  return modes;
}

export function compileDeck(input: CompileInput): DeckSpec {
  const { model, labels, fmtFtIn } = input;
  const byRole = new Map<MemberRole, Member[]>();
  for (const m of model.members) {
    if (SKIP.has(m.role)) continue;
    const list = byRole.get(m.role);
    if (list) list.push(m);
    else byRole.set(m.role, [m]);
  }

  const cards: CardSpec[] = [];
  for (const [role, members] of byRole) {
    const plain = labels.plainName(role);
    const what = labels.whatItDoes(role);
    // No plain-language purpose means nothing to teach — a card whose back reads "stud: stud"
    // wastes the reader's attention and the dictionary test exists to keep that list at zero.
    if (!what) continue;
    const minStage = Math.min(...members.map((m) => m.stage));
    cards.push({
      id: `role:${role}`,
      deckId: input.deckId,
      subject: { kind: 'member-role', role, exemplarMemberId: members[0]!.id },
      front: {
        art: {
          kind: 'scene',
          scene: {
            memberIds: members.map((m) => m.id),
            stageOrdinal: minStage,
            view: 'iso-se',
            cutaway: null,
          },
        },
        prompt: 'Say it out loud, then flip.',
      },
      back: {
        name: plain,
        plain: what,
        whereItGoes: whereItGoes(role, members, model, plain),
        facts: factsFor(role, members, fmtFtIn),
        regimeLine: TIMBER_REGIME_LINE,
      },
      modes: modesFor(role, members),
      fallbackArt: false,
      minStage,
    });
  }

  // Teaching order: the order it goes up, then alphabetical inside a stage. A deck that opens
  // on rafters and works back to footings teaches a sequence nobody builds in.
  cards.sort((a, b) => a.minStage - b.minStage || (a.back.name < b.back.name ? -1 : a.back.name > b.back.name ? 1 : 0));

  const stageDrill: StageDrillEntry[] = model.stagePlan.map((s) => ({
    ordinal: s.ordinal,
    label: s.label,
    detail: s.detail,
    // The sequence is the app's own build order, not a manual's numbered list — say so.
    source: 'app-structure',
  }));

  return {
    id: input.deckId,
    app: 'timber',
    title: input.title,
    regime: 'timber-ph',
    cards,
    stageDrill,
    compiledFrom: {},
  };
}
