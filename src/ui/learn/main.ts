// 1371 LEARNING — the toolkit-level trainer.
//
// Three surfaces over one compiled model:
//   DECKS     flashcards, scheduled, with the card art drawn from the structure itself.
//   PIECES    the whole framing dictionary, searchable — the thing you actually reach for on a
//             site when someone says a word you do not know.
//   SEQUENCE  the build order of every shipped structure, stage by stage, with why.
//
// This file is the shell: routing, rendering and event wiring. Every decision worth arguing
// about lives in a module that runs under `node --test` — the scheduler in train/core, the
// question builder in train/drill, the deck list in train/decks, the storage rules in
// ./store. What is left here is DOM, deliberately, so the thinking is all testable.
//
// NO CLOCK. The scheduler counts sessions (FD9); nothing on this page calls Date.now, which is
// what lets a whole session be replayed from a saved blob in a test.

import { allDecks, type DeckEntry } from '../../timber/train/decks';
import {
  buildSession,
  deckMastery,
  fnv1a,
  mark,
  sealSession,
  sessionSeed,
  type CardSpec,
  type CitedFact,
  type DeckSpec,
  type QuizMode,
} from '../../timber/train/core';
import { buildQuestion, isSelfGraded, promptFor, type Question } from '../../timber/train/drill';
import { PLAIN, WHAT, plainName, whatItDoes } from '../woodframe/labels';
import { familyById, shippedFamilies, type FamilyId } from '../../timber/catalog';
import { generateStructure } from '../../timber/families/index';
import { cardArt, deckArt, stageArt } from './art';
import { loadTrain, progressFor, resetDeck, saveTrain, withProgress, type TrainState } from './store';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const app = document.getElementById('app')!;
const noticeBar = document.getElementById('notices')!;

// ── State ────────────────────────────────────────────────────────────────────

const LABELS = { plainName, whatItDoes };
const DECKS: DeckEntry[] = allDecks(LABELS);
const byId = new Map(DECKS.map((d) => [d.deck.id, d]));

const boot = loadTrain(window.localStorage);
let state: TrainState = boot.state;

/** The live drill, or null when we are not in one. */
interface Session {
  deckId: string;
  queue: readonly string[];
  index: number;
  /** null = not answered yet; the drill can be resumed mid-queue on a re-render. */
  results: (boolean | null)[];
  /** Set once the learner has revealed a self-graded card, or answered a choice one. */
  revealed: boolean;
  /** Which choice was tapped, for the right/wrong colouring. */
  picked: number | null;
  /**
   * THE QUESTION IS PINNED WHEN IT IS ASKED, not recomputed on every render.
   *
   * `pickMode` reads the card's box, and grading an answer changes that box — so recomputing
   * after a tap turned "which piece is highlighted?" into a different question with a different
   * choice list, while `picked` still pointed into the old one. The card visibly changed under
   * the answer. What is shown must be what is graded, so it is built once and held.
   */
  question: Question | null;
}
let session: Session | null = null;

function persist(): void {
  if (!saveTrain(window.localStorage, state)) {
    notice(['Progress cannot be saved in this browser — the session will still work, but it will not be remembered.']);
  }
}

function notice(lines: string[]): void {
  if (lines.length === 0) { noticeBar.hidden = true; return; }
  noticeBar.hidden = false;
  noticeBar.innerHTML = lines.map((l) => `<p>${esc(l)}</p>`).join('');
}
notice(boot.notices);

// ── Routing ──────────────────────────────────────────────────────────────────

type Route =
  | { name: 'decks' }
  | { name: 'pieces' }
  | { name: 'sequence'; familyId: string }
  | { name: 'drill'; deckId: string };

const DEFAULT_SEQUENCE = 'gp-frame';

function parseRoute(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [head, arg] = raw.split('/');
  if (head === 'pieces') return { name: 'pieces' };
  if (head === 'sequence') return { name: 'sequence', familyId: arg && familyById(arg as FamilyId) ? arg : DEFAULT_SEQUENCE };
  if (head === 'drill' && arg && byId.has(arg)) return { name: 'drill', deckId: arg };
  return { name: 'decks' };
}

function go(hash: string): void {
  if (window.location.hash === hash) render();
  else window.location.hash = hash;
}

window.addEventListener('hashchange', () => {
  const r = parseRoute();
  // Leaving a drill abandons it rather than holding it open invisibly: a queue that survives
  // navigation would silently resume days later with a half-marked session.
  if (session && (r.name !== 'drill' || r.deckId !== session.deckId)) session = null;
  render();
  // Only on an actual navigation. Scrolling on every re-render would yank the page every time
  // an answer is revealed, which is exactly when a reader wants to stay where they are.
  window.scrollTo(0, 0);
});

// ── Shell ────────────────────────────────────────────────────────────────────

function tabs(active: 'decks' | 'pieces' | 'sequence'): string {
  const t: [string, string, string][] = [
    ['decks', '#/', 'Decks'],
    ['pieces', '#/pieces', 'Pieces'],
    ['sequence', `#/sequence/${DEFAULT_SEQUENCE}`, 'Sequence'],
  ];
  return `<div class="tabs"><div class="seg" role="tablist">${t
    .map(([k, href, label]) =>
      `<button role="tab" aria-selected="${k === active}" data-go="${href}">${label}</button>`)
    .join('')}</div></div>`;
}

function render(): void {
  const route = parseRoute();
  if (route.name === 'drill') renderDrill(route.deckId);
  else if (route.name === 'pieces') renderPieces();
  else if (route.name === 'sequence') renderSequence(route.familyId);
  else renderDecks();
}

// ── Deck list ────────────────────────────────────────────────────────────────

function masteryBar(deck: DeckSpec): string {
  const m = deckMastery(deck, progressFor(state, deck.id));
  const pct = (n: number) => (m.total === 0 ? 0 : Math.round((n / m.total) * 100));
  const label = m.known + m.learning === 0
    ? `${m.total} cards`
    : `${m.known} known · ${m.learning} learning · ${m.unseen} new`;
  return `<div class="stats">
      <span class="bar"><i class="k" style="width:${pct(m.known)}%"></i><i class="l" style="width:${pct(m.learning)}%"></i></span>
      <span>${esc(label)}</span>
    </div>`;
}

function deckTile(entry: DeckEntry): string {
  const tileFamily = entry.tileFamilyId ?? entry.familyId;
  const art = tileFamily ? deckArt(tileFamily, entry.tileHighlight) : null;
  return `<button class="deck" data-go="#/drill/${esc(entry.deck.id)}">
      <span class="tile${art ? '' : ' none'}">${art ?? '&#9670;'}</span>
      <span class="body">
        <h3>${esc(entry.deck.title)}</h3>
        <p class="blurb">${esc(entry.blurb)}</p>
        ${masteryBar(entry.deck)}
      </span>
    </button>`;
}

function renderDecks(): void {
  const groups: { label: string; entries: DeckEntry[] }[] = [];
  for (const e of DECKS) {
    const last = groups[groups.length - 1];
    if (last && last.label === e.groupLabel) last.entries.push(e);
    else groups.push({ label: e.groupLabel, entries: [e] });
  }
  app.innerHTML = `<div class="wrap">
      <div class="lead">
        <h1>Learn the trade</h1>
        <p>Every card here is generated from a real structure this toolkit can build — the piece,
           the stock it is cut from, where it goes and what holds it. Change nothing and drill;
           the deck already matches the drawing.</p>
      </div>
      ${tabs('decks')}
      ${groups.map((g) => `<h2 class="grouphead">${esc(g.label)}</h2>
        <div class="decks">${g.entries.map(deckTile).join('')}</div>`).join('')}
    </div>`;
}

// ── Drill ────────────────────────────────────────────────────────────────────

/** Per-card seed: stable for a given (deck, session, card), so a re-render never reshuffles. */
function cardSeed(deckId: string, sessionOrdinal: number, cardId: string): number {
  return (sessionSeed(deckId, sessionOrdinal) ^ fnv1a(cardId)) >>> 0;
}

function startSession(deckId: string): void {
  const entry = byId.get(deckId)!;
  const p = progressFor(state, deckId);
  const queue = buildSession(entry.deck, p, sessionSeed(deckId, p.session));
  session = { deckId, queue, index: 0, results: queue.map(() => null), revealed: false, picked: null, question: null };
}

/** The question for the card now on screen — built once per card, then held (see `question`). */
function currentQuestion(s: Session): Question | null {
  if (s.question) return s.question;
  const deck = byId.get(s.deckId)!.deck;
  const p = progressFor(state, s.deckId);
  const cardId = s.queue[s.index]!;
  s.question = buildQuestion(deck, cardId, p.cards[cardId], cardSeed(s.deckId, p.session, cardId));
  return s.question;
}

function artFor(card: CardSpec, deckId: string, width = 460, height = 320): string | null {
  return cardArt(card, { spec: null, deckId }, { width, height });
}

/** Card names are stored the way a carpenter says them (lower case); a heading gets a capital. */
const titleCase = (s: string): string => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

function factRow(f: CitedFact): string {
  // The source badge is the whole point of TR-2b: a Marine has to be able to tell "the manual
  // says" from "this drawing says" at a glance, without reading the citation.
  //
  // When a fact's text IS its citation — the plain "Reference" row, which has no schedule to
  // quote — printing the cite underneath repeats the same sentence twice. Say it once.
  const provenance = f.source === 'this-build'
    ? '<span class="mine">from this structure — not a doctrinal minimum</span>'
    : f.source === 'count'
      ? '<span class="mine">count in this structure</span>'
      : f.cite && f.cite !== f.text ? `<span class="cite">${esc(f.cite)}</span>` : '';
  return `<div class="fact"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.text)}${provenance}</span></div>`;
}

function cardBack(card: CardSpec): string {
  return `<div class="back">
      <div class="name">${esc(titleCase(card.back.name))}</div>
      <p class="plain">${esc(card.back.plain)}</p>
      <p class="where">${esc(card.back.whereItGoes)}</p>
      <div class="facts">${card.back.facts.map(factRow).join('')}</div>
      <p class="regime">${esc(card.back.regimeLine)}</p>
    </div>`;
}

const MODE_TAG: Record<QuizMode, string> = {
  'flip': 'Recall',
  'flip-reverse': 'Recall — reversed',
  'identify': 'Identify',
  'name-to-part': 'Point at it',
  'stage-order': 'Sequence',
};

function questionBody(q: Question, deckId: string, s: Session): string {
  const art = artFor(q.card, deckId);
  const artBlock = art
    ? `<div class="art">${art}</div>`
    : '<div class="art blank">No drawing for this piece — go by the description.</div>';

  if (q.mode === 'flip') {
    return `${artBlock}
      ${s.revealed ? cardBack(q.card) : ''}
      ${s.revealed
        ? `<div class="grade">
             <button class="btn miss" data-grade="0">Missed it</button>
             <button class="btn good" data-grade="1">Got it</button>
           </div>`
        : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-reveal="1">Show the answer</button></div>'}`;
  }

  if (q.mode === 'flip-reverse') {
    // Name first, drawing second — the direction you work in when someone tells you what to cut.
    return `<div class="back">
        <div class="name">${esc(q.card.back.name)}</div>
        <p class="plain">${esc(q.card.back.plain)}</p>
      </div>
      ${s.revealed ? artBlock : ''}
      ${s.revealed ? cardBack(q.card) : ''}
      ${s.revealed
        ? `<div class="grade">
             <button class="btn miss" data-grade="0">Missed it</button>
             <button class="btn good" data-grade="1">Got it</button>
           </div>`
        : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-reveal="1">Show me</button></div>'}`;
  }

  if (q.mode === 'name-to-part') {
    const choices = q.choices.map((c, i) => {
      const svg = artFor(c, deckId, 320, 230);
      const cls = s.picked === null ? '' : i === q.answer ? ' right' : i === s.picked ? ' wrong' : '';
      return `<button class="ans${cls}" data-pick="${i}"${s.picked === null ? '' : ' disabled'}>${svg ?? esc(c.back.name)}</button>`;
    }).join('');
    return `<div class="answers arts">${choices}</div>
      ${s.picked === null ? '' : cardBack(q.card)}
      ${s.picked === null ? '' : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-next="1">Next</button></div>'}`;
  }

  const choices = q.choices.map((c, i) => {
    const cls = s.picked === null ? '' : i === q.answer ? ' right' : i === s.picked ? ' wrong' : '';
    return `<button class="ans${cls}" data-pick="${i}"${s.picked === null ? '' : ' disabled'}>${esc(c)}</button>`;
  }).join('');
  return `${artBlock}
    <div class="answers">${choices}</div>
    ${s.picked === null ? '' : cardBack(q.card)}
    ${s.picked === null ? '' : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-next="1">Next</button></div>'}`;
}

function renderDrill(deckId: string): void {
  if (!session || session.deckId !== deckId) startSession(deckId);
  const s = session!;
  const entry = byId.get(deckId)!;

  if (s.queue.length === 0) {
    app.innerHTML = `<div class="done">
        <h2>${esc(entry.deck.title)}</h2>
        <p class="sub">Nothing is due yet. Come back after another session, or start this deck over.</p>
        <div class="row" style="margin-top:22px">
          <button class="btn" data-go="#/">Back to decks</button>
          <button class="btn quiet" data-reset="${esc(deckId)}">Start over</button>
        </div>
      </div>`;
    return;
  }

  if (s.index >= s.queue.length) { renderSummary(entry); return; }

  const q = currentQuestion(s);
  if (!q) { advance(); return; } // a stale card id — skip it rather than crash

  const pips = s.results.map((r, i) =>
    `<i class="${r === true ? 'hit' : r === false ? 'slip' : i === s.index ? 'now' : ''}"></i>`).join('');

  app.innerHTML = `<div class="drill">
      <div class="drillbar">
        <button class="btn quiet" data-go="#/">Done for now</button>
        <span class="count">${s.index + 1} / ${s.queue.length}</span>
      </div>
      <div class="pips">${pips}</div>
      <div class="card">
        <span class="modetag">${esc(MODE_TAG[q.mode])}</span>
        <div class="prompt">${esc(promptFor(q))}</div>
        ${questionBody(q, deckId, s)}
      </div>
    </div>`;
}

function grade(got: boolean, via: QuizMode): void {
  const s = session!;
  const cardId = s.queue[s.index]!;
  state = withProgress(state, s.deckId, mark(progressFor(state, s.deckId), cardId, got, via));
  s.results[s.index] = got;
  persist();
}

function advance(): void {
  const s = session!;
  s.index += 1;
  s.revealed = false;
  s.picked = null;
  s.question = null;
  if (s.index >= s.queue.length) {
    // Seal ONCE, at the end of the queue: the session ordinal is the scheduler's clock, and
    // bumping it mid-drill would make every card in this very queue instantly due again.
    state = withProgress(state, s.deckId, sealSession(progressFor(state, s.deckId)));
    persist();
  }
  render();
}

function renderSummary(entry: DeckEntry): void {
  const s = session!;
  const right = s.results.filter((r) => r === true).length;
  const m = deckMastery(entry.deck, progressFor(state, entry.deck.id));
  app.innerHTML = `<div class="done">
      <h2>${esc(entry.deck.title)}</h2>
      <div class="score">${right} / ${s.results.length}</div>
      <div class="sub">this session</div>
      <div class="tally">
        <div><b>${m.known}</b>known</div>
        <div><b>${m.learning}</b>learning</div>
        <div><b>${m.unseen}</b>new</div>
      </div>
      <div class="row">
        <button class="btn primary" data-again="${esc(entry.deck.id)}">Another round</button>
        <button class="btn" data-go="#/">Back to decks</button>
      </div>
      <p class="sub" style="margin-top:20px;font-size:12.5px">
        A card only counts as <b>known</b> once you have got it in a mode that could have caught a
        wrong answer — flipping a card over and telling yourself you knew it keeps it in
        <b>learning</b>.
      </p>
    </div>`;
}

// ── Pieces (the dictionary) ──────────────────────────────────────────────────

let pieceQuery = '';

/** Which shipped structures actually contain each role — the "where you'll meet it" column. */
const ROLE_HOMES: Map<string, string[]> = (() => {
  const out = new Map<string, string[]>();
  for (const f of shippedFamilies()) {
    if (f.id === 'custom') continue;
    for (const m of generateStructure(f.preset).members) {
      const list = out.get(m.role);
      if (list) { if (!list.includes(f.name)) list.push(f.name); }
      else out.set(m.role, [f.name]);
    }
  }
  return out;
})();

function renderPieces(): void {
  const q = pieceQuery.trim().toLowerCase();
  const rows = (Object.keys(PLAIN) as (keyof typeof PLAIN)[])
    .map((role) => ({ role, name: PLAIN[role], what: WHAT[role], homes: ROLE_HOMES.get(role) ?? [] }))
    .filter((r) => r.homes.length > 0) // a role no shipped structure emits is not yet a thing to learn
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.what.toLowerCase().includes(q) || r.role.toLowerCase().includes(q))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  app.innerHTML = `<div class="wrap">
      <div class="lead">
        <h1>Pieces</h1>
        <p>Every framing member this toolkit knows how to build, what it does, and which structures
           you will meet it in. Search a word you heard on site.</p>
      </div>
      ${tabs('pieces')}
      <input class="search" id="pq" type="search" placeholder="Search — “cripple”, “racking”, “header”…" value="${esc(pieceQuery)}" />
      ${rows.length === 0
        ? '<p class="empty">Nothing matches that.</p>'
        : `<div class="terms">${rows.map((r) => `<div class="term">
              <h3>${esc(r.name)}</h3>
              <span class="where">${esc(r.homes.length > 2 ? `${r.homes.length} structures` : r.homes.join(', '))}</span>
              <p>${esc(r.what)}</p>
            </div>`).join('')}</div>`}
    </div>`;

  const input = document.getElementById('pq') as HTMLInputElement | null;
  input?.addEventListener('input', () => {
    pieceQuery = input.value;
    const at = input.selectionStart;
    renderPieces();
    const next = document.getElementById('pq') as HTMLInputElement | null;
    next?.focus();
    if (at !== null) next?.setSelectionRange(at, at);
  });
}

// ── Sequence ─────────────────────────────────────────────────────────────────

function renderSequence(familyId: string): void {
  const family = familyById(familyId as FamilyId)!;
  const model = generateStructure(family.preset);
  const picks = shippedFamilies().filter((f) => f.id !== 'custom');
  app.innerHTML = `<div class="wrap">
      <div class="lead">
        <h1>Build sequence</h1>
        <p>The order a structure goes up, and why each step waits for the one before it. This is the
           app's own build order — it is how the model is assembled, not a numbered list out of a
           manual.</p>
      </div>
      ${tabs('sequence')}
      <div class="seqpick">${picks.map((f) =>
        `<button class="btn" aria-pressed="${f.id === familyId}" data-go="#/sequence/${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>
      <div class="stages">${model.stagePlan.map((s) => {
        // The structure as it stood at the end of this step, drawn at the finished building's
        // scale — the sequence is a thing you watch grow, not a list you read.
        const art = stageArt(familyId, s.ordinal);
        return `<div class="stage">
          <span class="n">${s.ordinal}</span>
          <div><h3>${esc(s.label)}</h3><p>${esc(s.detail ?? '')}</p></div>
          ${art ? `<span class="shot">${art}</span>` : '<span></span>'}
        </div>`;
      }).join('')}</div>
    </div>`;
}

// ── Events ───────────────────────────────────────────────────────────────────

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-go],[data-reveal],[data-grade],[data-pick],[data-next],[data-again],[data-reset]');
  if (!el) return;

  const goTo = el.dataset['go'];
  if (goTo) { go(goTo); return; }

  const again = el.dataset['again'];
  if (again) { startSession(again); render(); return; }

  const reset = el.dataset['reset'];
  if (reset) { state = resetDeck(state, reset); persist(); session = null; render(); return; }

  if (!session) return;
  const s = session;
  const q = currentQuestion(s);
  if (!q) return;

  if (el.dataset['reveal']) { s.revealed = true; render(); return; }
  if (el.dataset['next']) { advance(); return; }

  const gradeAttr = el.dataset['grade'];
  if (gradeAttr !== undefined && isSelfGraded(q.mode)) {
    grade(gradeAttr === '1', q.mode);
    advance();
    return;
  }

  const pick = el.dataset['pick'];
  if (pick !== undefined && s.picked === null && 'answer' in q) {
    s.picked = Number(pick);
    grade(s.picked === q.answer, q.mode);
    render();
  }
});

render();
