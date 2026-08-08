// TIMBER-2 — the structure picker (plan §5.2, mandate #3).
//
// The app OPENS here: cards with images, grouped, one of them "start from a clean sheet". The
// images are runtime SVG drawn from each preset's own members (TD11), so a card can never
// depict a structure the engine would not build.
//
// Two copy rules from the plan that are easy to get wrong:
//   - (PH) does NOT appear on cards. It belongs in the workbench, where the doctrine popover
//     can explain it. On a card it is noise that makes every structure look provisional; the
//     picker carries one footnote instead.
//   - the Custom card states its SCOPE ("custom BUILDING — towers and bunkers customize from
//     their own cards"), so nobody opens it hunting for a tower knob.

import { pickerGroups, type FamilyDef } from '../../timber/catalog';
import { isLearning } from './mode';
import { portraitCached } from '../../timber/portrait';
import { generateStructure } from '../../timber/families/index';
import type { StoredBuild } from './store';

/**
 * The three pieces on the flashcards tile: a joint, a stick and a foundation, from three
 * different structures — so the stack says "the whole trade" rather than "one building".
 */
const FAN_PICKS: readonly [string, string][] = [
  ['tower', 'hipRafter'],
  ['gp-frame', 'header'],
  ['gp-frame', 'post'],
];

export interface PickerCallbacks {
  onOpenFamily(familyId: FamilyDef['id']): void;
  onOpenBuild(id: string): void;
  onDeleteBuild?(id: string): void;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cardHtml(f: FamilyDef): string {
  // SOLID, NOT WIRE. These were line drawings — thin dark strokes designed to read on white
  // paper — and the app is dark, so fourteen cards of a building came out as fourteen faint
  // smudges you could not tell apart. The owner's word for it was "undiscernable". A card whose
  // whole job is "which structure is this" has to show the structure.
  const art = portraitCached(`card:${f.id}`, f.preset, { width: 300, height: 200 });
  const capacity = f.capacity ? `<span class="chip-meta">${esc(f.capacity)}</span>` : '';
  // Lineage on the card is the pub NAME only; the (PH) status lives in the workbench.
  const lineage = esc(f.lineage.replace(/\s*\(PH[^)]*\)/g, '').split(';')[0] ?? '');
  const dashed = f.id === 'custom' ? ' card--custom' : '';
  return `
    <button class="card${dashed}" data-family="${esc(f.id)}" type="button">
      <span class="card-art" aria-hidden="true">${art}</span>
      <span class="card-body">
        <span class="card-name">${esc(f.name)}</span>
        <span class="card-line">${esc(f.oneLiner)}</span>
        <span class="card-meta">${capacity}<span class="chip-meta">${lineage}</span></span>
      </span>
    </button>`;
}

/**
 * THE FLASHCARDS TILE — first thing in the Learning app, and a stack of cards rather than a
 * building.
 *
 * Flashcards used to be a button inside each structure's workbench: you picked a hut, waited
 * for it to draw, and then found a deck about huts. That put the general vocabulary — the part
 * that transfers between every job — behind a choice of building, and it interrupted anyone
 * who had opened a structure to look at the structure. So the deck moved out to its own page
 * and this is its front door, at the top, before any of the buildings.
 *
 * The three faces are drawn from the catalog's own presets, which keeps this tile honest: no
 * image files, and it cannot advertise a piece the engine does not build.
 */
function flashcardsHtml(): string {
  const faces = FAN_PICKS
    .map(([familyId, role], i) => {
      const family = pickerGroups().flatMap((g) => g.families).find((f) => f.id === familyId);
      if (!family) return '';
      const member = generateStructure(family.preset).members.find((m) => m.role === role);
      if (!member) return '';
      const art = portraitCached(`fan:${familyId}:${role}`, family.preset, {
        width: 300, height: 210, context: 0.8, focus: new Set([member.id]), stageMax: member.stage, background: "#17181b",
      });
      return `<span class="face f${i}">${art}</span>`;
    })
    .join('');
  return `<section class="group group--cards">
      <h2>Flashcards</h2>
      <div class="cards">
        <a class="card card--cards" href="learn.html">
          <span class="card-art" aria-hidden="true"><span class="fan">${faces}</span></span>
          <span class="card-body">
            <span class="card-name">General knowledge</span>
            <span class="card-line">See a piece, name it. Every piece of framing in the toolkit, pictured in
              the structure it belongs to at the moment it goes in — then the same pieces asked harder,
              with the stock, the span and the citation.</span>
            <span class="card-meta"><span class="chip-meta">Pieces dictionary</span><span class="chip-meta">Build sequences</span></span>
          </span>
        </a>
      </div>
    </section>`;
}

function resumeHtml(builds: StoredBuild[]): string {
  if (builds.length === 0) return '';
  const items = builds
    .map((b) => `<button class="resume-chip" data-build="${esc(b.id)}" type="button">${esc(b.label ?? b.id)}</button>`)
    .join('');
  return `<section class="resume" aria-label="Your builds">
    <h2>Your builds</h2>
    <div class="resume-row">${items}</div>
  </section>`;
}

export function renderPicker(root: HTMLElement, builds: StoredBuild[], cb: PickerCallbacks): void {
  const groups = pickerGroups();
  const jump = groups
    .map((g) => `<button class="jump" data-jump="${esc(g.group)}" type="button">${esc(g.label)}</button>`)
    .join('');

  const sections = groups
    .map(
      (g) => `<section class="group" id="group-${esc(g.group)}">
        <h2>${esc(g.label)}</h2>
        <div class="cards">${g.families.map(cardHtml).join('')}</div>
      </section>`,
    )
    .join('');

  root.innerHTML = `
    <div class="picker">
      <div class="picker-head">
        <h1>${isLearning ? 'What do you want to learn?' : 'What are you building?'}</h1>
        <p class="sub">${isLearning
          ? 'Start with the cards if you are learning the vocabulary. Or pick a structure to take apart — watch it go up stage by stage, tap any piece, change anything you like.'
          : 'Pick a standard design to start from, or a clean sheet. Every one is fully adjustable, down to the hardware.'}</p>
        <nav class="jumps" aria-label="Jump to a group">${jump}</nav>
      </div>
      ${isLearning ? flashcardsHtml() : ''}
      ${resumeHtml(builds)}
      ${sections}
      <p class="footnote">(PH) beside a citation in a build means the manual page check is still pending.</p>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-family]').forEach((el) => {
    el.addEventListener('click', () => cb.onOpenFamily(el.dataset.family as FamilyDef['id']));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-build]').forEach((el) => {
    el.addEventListener('click', () => cb.onOpenBuild(el.dataset.build!));
  });
  // Jump chips are BUTTONS calling scrollIntoView — never location.hash anchors, which would
  // trip the router's unknown-route handler and pollute the back stack (plan §5.1).
  root.querySelectorAll<HTMLButtonElement>('[data-jump]').forEach((el) => {
    el.addEventListener('click', () => {
      root.querySelector(`#group-${el.dataset.jump}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
