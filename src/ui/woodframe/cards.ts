// Flashcards for the LEARNING app.
//
// Every card is generated from the structure on screen — its own members, its own stage plan,
// its own doctrine references — rather than typed into a list. Two reasons, and the second is
// the important one:
//
//   1. A hand-written deck goes stale the moment the engine changes a nominal or a nailing
//      schedule, and a teaching aid that quietly teaches the wrong thing is worse than none.
//   2. The cards then adapt to what the student is actually looking at. Change the building to a
//      shed roof and the rafter cards go away; add a basement and stair cards appear. You drill
//      on the thing in front of you, not on a generic house.
//
// CARD DESIGN, learned the hard way: the FRONT must be answerable. An early pass asked "what
// carries this? — 2x4", which no one can answer, because six different roles are all 2x4. The
// front is therefore always the DESCRIPTION or the JOB, and the back is the name, the size and
// the doctrine behind it — the direction a person is actually asked to work in on a site.

import type { StructureModel } from '../../timber/families/index';
import type { Member, MemberRole } from '../../timber/types';
import { plainName, whatItDoes } from './labels';
import { fmtFtIn } from './studio';

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

/** One representative member per role — the deck asks about roles, not 741 individual sticks. */
function byRole(members: Member[]): Map<MemberRole, Member> {
  const out = new Map<MemberRole, Member>();
  for (const m of members) if (!out.has(m.role)) out.set(m.role, m);
  return out;
}

export function buildDeck(model: StructureModel): Card[] {
  const cards: Card[] = [];
  const roles = byRole(model.members);
  const counts = new Map<MemberRole, number>();
  for (const m of model.members) counts.set(m.role, (counts.get(m.role) ?? 0) + 1);

  for (const [role, m] of roles) {
    const name = plainName(role);
    const job = whatItDoes(role);
    if (job) {
      // Job → name. This is the direction the work goes: you are told what has to happen and you
      // have to know what to cut.
      cards.push({
        id: `piece:${role}`,
        front: `${job}\n\nWhat is this piece called?`,
        back: name,
        source: m.doctrineRef,
        group: 'pieces',
      });
    }
    cards.push({
      id: `size:${role}`,
      front: `What stock does this building use for the ${name.toLowerCase()}, and how long does it cut?`,
      back: `${m.nominal} — ${fmtFtIn(m.cutLength)}${(counts.get(role) ?? 0) > 1 ? ` (${counts.get(role)} of them)` : ''}`,
      source: m.doctrineRef,
      group: 'numbers',
    });
    if (m.nailing && !/^\d+d common \(PH\)$/.test(m.nailing)) {
      cards.push({
        id: `nail:${role}`,
        front: `How is the ${name.toLowerCase()} fastened?`,
        back: m.nailing.replace(/\s*\(PH\)\s*$/, ''),
        source: m.doctrineRef,
        group: 'fastening',
      });
    }
  }

  // Sequence: the stage plan, asked both ways round — what comes next, and why this order.
  model.stagePlan.forEach((s, i) => {
    const next = model.stagePlan[i + 1];
    if (next) {
      cards.push({
        id: `next:${s.ordinal}`,
        front: `You have just finished: ${s.label}.\n\nWhat goes up next?`,
        back: next.label,
        source: next.detail,
        group: 'sequence',
      });
    }
    cards.push({
      id: `why:${s.ordinal}`,
      front: `Why is "${s.label}" done at this point and not later?`,
      back: s.detail,
      source: `Stage ${s.ordinal} of ${model.stagePlan.length}`,
      group: 'sequence',
    });
  });

  return cards;
}

/**
 * Deterministic shuffle. `Math.random` would reshuffle on every re-render and make the "next"
 * button jump around; a seed the caller controls means the order is stable within a session and
 * different between sessions.
 */
export function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0 || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
