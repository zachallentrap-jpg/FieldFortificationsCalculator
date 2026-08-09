// TRAINING — what there is to study (TRAINING_AND_PACKETS_PLAN §2.4, F2).
//
// The deck list is COMPILED FROM THE CATALOG, not written down. Ship a new family and its deck
// appears; retire one and its deck goes with it. The alternative — a hand-kept list beside the
// catalog — is two lists that agree on the day they are written and never again.
//
// Two kinds of deck, and the second is the one that matters most for a 1371:
//
//   PER STRUCTURE. "Guard tower", "SEA hut", "Crib bunker" — every piece in that specific
//   building, in the order it goes up. This is what you drill the night before you build one.
//
//   FRAMING PIECES. Every distinct member role across the whole catalog, each shown in the
//   simplest building that actually uses it. A jack stud is a jack stud whether it is in a hut
//   or a guard shack, and the vocabulary is what transfers between jobs — so the fundamentals
//   deck teaches the piece, not the project.

import { GROUP_LABELS, GROUP_ORDER, shippedFamilies, type FamilyDef, type FamilyGroup } from '../catalog';
import { generateStructure } from '../families/index';
import { fmtFtIn } from '../units';
import { compileDeck, type LabelSource } from './compile';
import type { CardSpec, DeckSpec } from './core';

export const FUNDAMENTALS_ID = 'framing-pieces';
export const NAMING_ID = 'name-the-piece';

/**
 * HOW HARD A DECK ASKS.
 *
 *   'name'  See it, say it, flip, check. One question, one answer, no scoring games. This is
 *           what people mean by flashcards, and it is the deck somebody who has never framed
 *           anything should meet first — a picture of a hip rafter, the words "hip rafter".
 *   'full'  The same pieces with everything attached: stock, cut length, where it goes, what
 *           holds it, and the citation. Multiple choice, point-at-it and reversed recall, so
 *           the card can be PROVED rather than just recognised.
 *
 * Both are compiled from the same structures, which is the point: the easy deck is not a
 * simplified copy of the hard one, it is the same cards asked a smaller question.
 */
export type DeckStyle = 'name' | 'full';

export interface DeckEntry {
  readonly deck: DeckSpec;
  readonly group: FamilyGroup | 'fundamentals';
  readonly groupLabel: string;
  /** One line under the title on the deck list — what drilling this actually gets you. */
  readonly blurb: string;
  /** Catalog id whose spec draws this deck's art, or null for the cross-family deck. */
  readonly familyId: string | null;
  /**
   * GENERAL decks teach the vocabulary of the trade and are the front page of the trainer.
   * STRUCTURE decks drill one specific building and are for the night before you build it —
   * still here, but no longer bolted inside each structure's workbench, where they interrupted
   * somebody who had come to look at a building.
   */
  readonly kind: 'general' | 'structure';
  readonly style: DeckStyle;
  /**
   * Member ids to pick out of the tile drawing. The general decks use it to show one of every
   * piece at once, so the tile reads as "the pieces" rather than as a fifteenth building.
   */
  readonly tileHighlight?: readonly string[];
  /** Structure the tile is drawn from when it differs from `familyId` (the cross-family deck). */
  readonly tileFamilyId?: string;
}

/** One member of every distinct role — the "here is everything" drawing. */
function oneOfEach(familyId: string): string[] {
  const family = shippedFamilies().find((f) => f.id === familyId);
  if (!family) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const m of generateStructure(family.preset).members) {
    if (seen.has(m.role)) continue;
    seen.add(m.role);
    ids.push(m.id);
  }
  return ids;
}

/**
 * Simple structures first. The fundamentals deck keeps the FIRST building it meets a role in,
 * so this order decides which building each piece is taught in — and a stud is easier to find
 * in a storage shed than in a two-story hut.
 */
const TEACHING_ORDER: readonly string[] = [
  'storage-shed', 'gp-frame', 'guard-shack', 'tent-floor', 'platform',
  'sea-hut', 'swa-hut', 'b-hut', 'squad-hut', 'strongback', 'latrine', 'tower', 'crib-bunker',
];

function rank(id: string): number {
  const i = TEACHING_ORDER.indexOf(id);
  return i === -1 ? TEACHING_ORDER.length : i;
}

function deckForFamily(f: FamilyDef, labels: LabelSource): DeckSpec {
  return compileDeck({
    model: generateStructure(f.preset),
    deckId: f.id,
    title: f.name,
    labels,
    fmtFtIn,
    artSource: f.id,
  });
}

/**
 * Every distinct role in the catalog, taught in the simplest structure that has one. Cards keep
 * their compiled id (`role:stud`), so the same piece drilled here and in a structure deck is
 * genuinely the same card — but progress is stored per deck, so mastering "stud" in
 * fundamentals does not silently mark the tower deck complete.
 */
export function fundamentalsDeck(labels: LabelSource): DeckSpec {
  const families = [...shippedFamilies()].sort((a, b) => rank(a.id) - rank(b.id) || (a.id < b.id ? -1 : 1));
  const seen = new Map<string, CardSpec>();
  const drill: DeckSpec['stageDrill'] = [];
  for (const f of families) {
    const deck = deckForFamily(f, labels);
    for (const card of deck.cards) {
      if (seen.has(card.id)) continue;
      // Drop `stage-order` with the structure it came from. A card's mode list is a claim about
      // what can be asked of it IN THIS DECK, and this deck has no build sequence to grade
      // against; leaving the mode on would make the list a lie the drill has to work around.
      seen.set(card.id, {
        ...card,
        deckId: FUNDAMENTALS_ID,
        modes: card.modes.filter((m) => m !== 'stage-order'),
      });
    }
  }
  const cards = [...seen.values()].sort(
    (a, b) => a.minStage - b.minStage || (a.back.name < b.back.name ? -1 : a.back.name > b.back.name ? 1 : 0),
  );
  return {
    id: FUNDAMENTALS_ID,
    app: 'timber',
    title: 'Framing pieces',
    regime: 'timber-ph',
    cards,
    // Deliberately no stage drill: "what goes up next" is a question about ONE structure, and a
    // deck assembled from thirteen of them has no single answer to give.
    stageDrill: drill,
    compiledFrom: {},
  };
}

/**
 * The same pieces, asked the simplest possible question: here is a picture, what is it called?
 *
 * It is a projection of the fundamentals deck rather than a second compilation — one source of
 * truth for what a piece IS, two ways of asking about it. Restricting `modes` to 'flip' is what
 * makes it a flip deck: the drill's mode ladder can only ever offer what a card declares, so a
 * card that declares one mode is a card that only ever gets asked one way.
 */
export function namingDeck(labels: LabelSource): DeckSpec {
  const base = fundamentalsDeck(labels);
  return {
    ...base,
    id: NAMING_ID,
    title: 'Name the piece',
    cards: base.cards.map((c) => ({
      ...c,
      deckId: NAMING_ID,
      modes: ['flip'] as const,
      front: { ...c.front, prompt: 'What is this piece called?' },
    })),
  };
}

export function allDecks(labels: LabelSource): DeckEntry[] {
  const general: DeckEntry[] = [
    {
      deck: namingDeck(labels),
      group: 'fundamentals',
      groupLabel: 'General knowledge',
      blurb: 'See a piece, name it. Every piece of framing the toolkit builds with, photographed in the structure it belongs to at the moment it goes in. Start here.',
      familyId: null,
      kind: 'general',
      style: 'name',
      tileFamilyId: 'gp-frame',
      tileHighlight: oneOfEach('gp-frame'),
    },
    {
      deck: fundamentalsDeck(labels),
      group: 'fundamentals',
      groupLabel: 'General knowledge',
      blurb: 'The same pieces with everything attached — stock, cut length, what holds it, and the citation. Asked four ways, so you can prove you know it and not just recognise it.',
      familyId: null,
      kind: 'general',
      style: 'full',
      tileFamilyId: 'tower',
      tileHighlight: oneOfEach('tower'),
    },
  ];
  const perFamily: DeckEntry[] = [];
  for (const group of GROUP_ORDER) {
    // `custom` is a blank sheet to start a design from, not a structure anyone studies — its
    // deck would be the GP frame's deck under a name that teaches nothing.
    for (const f of shippedFamilies().filter((x) => x.group === group && x.id !== 'custom')) {
      perFamily.push({
        deck: deckForFamily(f, labels),
        group,
        groupLabel: GROUP_LABELS[group],
        blurb: f.oneLiner,
        familyId: f.id,
        kind: 'structure',
        style: 'full',
      });
    }
  }
  return [...general, ...perFamily];
}
