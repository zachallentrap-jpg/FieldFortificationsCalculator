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
import { thumbnailCached } from '../../timber/thumbnails';
import type { StoredBuild } from './store';

export interface PickerCallbacks {
  onOpenFamily(familyId: FamilyDef['id']): void;
  onOpenBuild(id: string): void;
  onDeleteBuild?(id: string): void;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cardHtml(f: FamilyDef): string {
  const art = thumbnailCached(`card:${f.id}`, f.preset);
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
          ? 'Pick a structure to take apart. Watch it go up stage by stage, tap any piece, change anything you like — then drill on the cards.'
          : 'Pick a standard design to start from, or a clean sheet. Every one is fully adjustable, down to the hardware.'}</p>
        <nav class="jumps" aria-label="Jump to a group">${jump}</nav>
      </div>
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
