// Flashcards for the wood-frame LEARNING app — the quick flip deck inside the studio.
//
// ONE DECK COMPILER (FD1). This file used to author its own cards from the member list; it now
// PROJECTS the shared `compileDeck` output into the studio's flip-card shape. Two decks
// compiled from the same model by two different files is two decks that agree the day they are
// written and drift after that — and the one that gets less attention is the one that ends up
// teaching a nominal the engine stopped emitting.
//
// The projection is not lossless and is not meant to be: the studio deck is a fast flip over
// the building currently on screen, so it takes the same facts and asks them in the direction
// a person is actually asked to work in on a site — told the job, produce the piece.
//
// WHAT CHANGED WHEN THIS MOVED, and it is worth stating: the size/length card used to print
// the member's `doctrineRef` under it. That is a manual reference under a number the OPERATOR
// chose by setting the building's dimensions, which is precisely the laundering TR-2b exists
// to prevent. Sizes and lengths now say where they really came from.

import type { StructureModel } from '../../timber/families/index';
import { compileDeck } from '../../timber/train/compile';
import { mulberry32, shuffle as fisherYates, type CardSpec } from '../../timber/train/core';
import { fmtFtIn } from '../../timber/units';
import { plainName, whatItDoes } from './labels';

export interface Card {
  /** Stable, so a deck can be reshuffled without a card changing identity mid-drill. */
  id: string;
  /** The question. Always answerable without seeing the answer first. */
  front: string;
  /** The answer, one short line. */
  back: string;
  /** Where it comes from — shown under the answer, never on the front. */
  source: string;
  group: 'pieces' | 'sequence' | 'fastening' | 'numbers';
}

const GROUP_LABEL: Record<Card['group'], string> = {
  pieces: 'Pieces',
  sequence: 'Sequence',
  fastening: 'Fastening',
  numbers: 'Numbers',
};

export function groupLabel(g: Card['group']): string {
  return GROUP_LABEL[g];
}

const factText = (card: CardSpec, label: string): string | undefined =>
  card.back.facts.find((f) => f.label === label)?.text;

const factCite = (card: CardSpec, label: string): string | undefined =>
  card.back.facts.find((f) => f.label === label)?.cite;

/** The one doctrinal reference on a card, for the "source" line under an answer. */
function reference(card: CardSpec): string {
  const doctrinal = card.back.facts.find((f) => f.source === 'doctrine' && f.cite);
  return doctrinal?.cite ?? card.back.regimeLine;
}

export function buildDeck(model: StructureModel): Card[] {
  const deck = compileDeck({
    model,
    deckId: 'live',
    title: 'This build',
    labels: { plainName, whatItDoes },
    fmtFtIn,
  });

  const cards: Card[] = [];
  for (const c of deck.cards) {
    const name = c.back.name;
    // Job → name. This is the direction the work goes: you are told what has to happen and you
    // have to know what to cut.
    cards.push({
      id: `piece:${c.id}`,
      front: `${c.back.plain}\n\nWhat is this piece called?`,
      back: name,
      source: reference(c),
      group: 'pieces',
    });

    const stock = factText(c, 'Stock');
    const cut = factText(c, 'Cut to');
    const count = factText(c, 'How many');
    if (stock && cut) {
      cards.push({
        id: `size:${c.id}`,
        front: `What stock does this building use for the ${name.toLowerCase()}, and how long does it cut?`,
        back: `${stock} — ${cut}${count && count !== '1' ? ` (${count} of them)` : ''}`,
        // NOT a doctrine reference: these are this structure's own numbers.
        source: 'From this structure — your dimensions produced it, not a doctrinal minimum.',
        group: 'numbers',
      });
    }

    const fastened = factText(c, 'Fastened');
    if (fastened) {
      cards.push({
        id: `nail:${c.id}`,
        front: `How is the ${name.toLowerCase()} fastened?`,
        back: fastened,
        source: factCite(c, 'Fastened') ?? reference(c),
        group: 'fastening',
      });
    }
  }

  // Sequence: the stage plan, asked both ways round — what comes next, and why this order.
  deck.stageDrill.forEach((s, i) => {
    const next = deck.stageDrill[i + 1];
    if (next) {
      cards.push({
        id: `next:${s.ordinal}`,
        front: `You have just finished: ${s.label}.\n\nWhat goes up next?`,
        back: next.label,
        source: next.detail ?? '',
        group: 'sequence',
      });
    }
    if (s.detail) {
      cards.push({
        id: `why:${s.ordinal}`,
        front: `Why is "${s.label}" done at this point and not later?`,
        back: s.detail,
        source: `Stage ${s.ordinal} of ${deck.stageDrill.length} — this app's build order, not a numbered list from a manual.`,
        group: 'sequence',
      });
    }
  });

  return cards;
}

/**
 * Deterministic shuffle. `Math.random` would reshuffle on every re-render and make the "next"
 * button jump around; a seed the caller controls means the order is stable within a session and
 * different between sessions.
 *
 * The permutation itself is the PINNED one from the training core — one shuffle in the code
 * base, so the deck a student sees here and the deck they see in the trainer are ordered by the
 * same rule.
 */
export function shuffle<T>(items: T[], seed: number): T[] {
  return fisherYates(items, mulberry32(seed >>> 0 || 1));
}
