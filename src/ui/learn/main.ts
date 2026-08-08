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

import { allDecks, type DeckEntry, type DeckStyle } from '../../timber/train/decks';
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
import { printPaperDeck } from './paper';
import { printStagePoster, printWorksheet } from './handouts';
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

/**
 * THE FANNED STACK. A deck of cards should look like a deck of cards.
 *
 * The three faces are real card fronts — three actual pieces from the deck, drawn by the same
 * projector the drill uses — so the tile is a sample of the contents rather than an icon of a
 * deck. Fanning them is the whole visual difference between "a picture of a building" and
 * "cards you can go through", and the owner asked for it by name.
 */
function fanTile(entry: DeckEntry, spread = 0): string {
  const scenes = entry.deck.cards.filter((c) => c.front.art.kind === 'scene');
  if (scenes.length === 0) return '<span class="fan none">&#9670;</span>';
  // Three cards spread across the deck rather than the first three, and offset per deck, so the
  // two tiles on the page are visibly two different decks instead of the same card twice.
  const picks = [0.14, 0.47, 0.81]
    .map((f) => scenes[Math.min(scenes.length - 1, Math.floor((f + spread) * scenes.length) % scenes.length)]!);
  const faces = picks.map((c, i) => {
    const art = cardArt(c, { spec: null, deckId: entry.deck.id }, { width: 300, height: 210, context: 0.8 });
    return `<span class="face f${i}">${art ?? ''}</span>`;
  }).join('');
  return `<span class="fan" aria-hidden="true">${faces}</span>`;
}

function heroDeck(entry: DeckEntry, spread = 0): string {
  const m = deckMastery(entry.deck, progressFor(state, entry.deck.id));
  return `<button class="hero" data-go="#/drill/${esc(entry.deck.id)}">
      ${fanTile(entry, spread)}
      <span class="body">
        <span class="kicker">${entry.style === 'name' ? 'Flashcards' : 'Go deeper'}</span>
        <h3>${esc(entry.deck.title)}</h3>
        <p class="blurb">${esc(entry.blurb)}</p>
        ${masteryBar(entry.deck)}
        <span class="cta">${m.known + m.learning === 0 ? 'Start' : 'Continue'} &rarr;</span>
      </span>
    </button>`;
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
  // GENERAL FIRST, AND ON ITS OWN. Flashcards used to be a fourteen-tile grid in which the deck
  // that teaches the vocabulary — the one everybody should open first — was one tile among
  // thirteen buildings. What a person wants on arriving is the trade, not a structure they may
  // never build; the specific decks are still here, below, for the night before you build one.
  const general = DECKS.filter((d) => d.kind === 'general');
  const structures = DECKS.filter((d) => d.kind === 'structure');

  const groups: { label: string; entries: DeckEntry[] }[] = [];
  for (const e of structures) {
    const last = groups[groups.length - 1];
    if (last && last.label === e.groupLabel) last.entries.push(e);
    else groups.push({ label: e.groupLabel, entries: [e] });
  }

  app.innerHTML = `<div class="wrap">
      <div class="lead">
        <h1>Learn the trade</h1>
        <p>Every card is generated from a real structure this toolkit can build, and the picture on
           the front is that structure at the moment the piece goes in. Nothing here is stock
           photography — it is the drawing, zoomed in on the thing being named.</p>
      </div>
      ${tabs('decks')}
      <div class="heroes">${general.map((d, i) => heroDeck(d, i * 0.33)).join('')}</div>
      <div class="split">
        <h2 class="grouphead">Drill one structure</h2>
        <p class="groupsub">Every piece in one specific building, in the order it goes up — what you
          run through the night before you build it.</p>
      </div>
      ${groups.map((g) => `<h3 class="subhead">${esc(g.label)}</h3>
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

/**
 * The answer side.
 *
 * A 'name' deck's back is the NAME, big, and one sentence of what it does. That is the entire
 * card: you looked at a hip rafter, you said "hip rafter", you flip it and you are right. Piling
 * the stock, the cut length, the nailing schedule and a citation under it turns a two-second
 * check into a paragraph to read, and a deck you have to read is a deck nobody finishes.
 * Everything that got cut is still one tap away in the pieces dictionary, and it is all on the
 * 'full' deck's back — which is what that deck is FOR.
 */
function cardBack(card: CardSpec, style: DeckStyle = 'full'): string {
  if (style === 'name') {
    return `<div class="back plain-back">
        <div class="name big">${esc(titleCase(card.back.name))}</div>
        <p class="plain">${esc(card.back.plain)}</p>
      </div>`;
  }
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

function questionBody(q: Question, deckId: string, s: Session, style: DeckStyle): string {
  const art = artFor(q.card, deckId);
  const artBlock = art
    ? `<div class="art">${art}</div>`
    : '<div class="art blank">No drawing for this piece — go by the description.</div>';

  if (q.mode === 'flip') {
    // A CARD. Not a form with a picture on it.
    //
    // It had a mode tag, a printed instruction, and a full-width blue "Show the answer" button —
    // three pieces of chrome around a flashcard whose entire interface is the card. You look at
    // the picture, you say the name, you turn it over. So the card turns on a CLICK, anywhere,
    // and carries nothing on its face but the piece and the highlight.
    //
    // Both faces are always in the DOM and the container rotates: rendering the back only after
    // the flip would mean animating in something that was not there, and the browser has no way
    // to tween that. `backface-visibility` hides whichever side is pointing away.
    return `<div class="flipcard${s.revealed ? ' turned' : ''}" data-flip="1" role="button" tabindex="0"
              aria-label="${flipAria(s.revealed)}">
        <div class="inner">
          <div class="side front">${artBlock}</div>
          <div class="side back-face">${cardBack(q.card, style)}</div>
        </div>
      </div>
      <div class="flipcontrols">${flipControlsHtml(s.revealed)}</div>`;
  }

  if (q.mode === 'flip-reverse') {
    // Name first, drawing second — the direction you work in when someone tells you what to cut.
    // The turn goes the other way here: the answer IS the picture, so it arrives clean.
    return `<div class="back">
        <div class="name">${esc(q.card.back.name)}</div>
        <p class="plain">${esc(q.card.back.plain)}</p>
      </div>
      ${s.revealed ? artBlock : ''}
      ${s.revealed && style === 'full' ? cardBack(q.card, style) : ''}
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
      return `<button class="ans${cls}" data-pick="${i}"${s.picked === null ? '' : ' disabled'}>${svg ?? esc(c.back.name)}<kbd class="anskey">${i + 1}</kbd></button>`;
    }).join('');
    return `<div class="answers arts">${choices}</div>
      ${s.picked === null ? '' : cardBack(q.card, style)}
      ${s.picked === null ? '' : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-next="1">Next</button></div>'}`;
  }

  const choices = q.choices.map((c, i) => {
    const cls = s.picked === null ? '' : i === q.answer ? ' right' : i === s.picked ? ' wrong' : '';
    return `<button class="ans${cls}" data-pick="${i}"${s.picked === null ? '' : ' disabled'}>${esc(c)}<kbd class="anskey">${i + 1}</kbd></button>`;
  }).join('');
  return `${artBlock}
    <div class="answers">${choices}</div>
    ${s.picked === null ? '' : cardBack(q.card, style)}
    ${s.picked === null ? '' : '<div class="grade" style="grid-template-columns:1fr"><button class="btn primary wide" data-next="1">Next</button></div>'}`;
}

const flipAria = (revealed: boolean): string =>
  revealed ? 'Showing the answer. Click to turn the card back.' : 'Click to turn the card over.';

/**
 * The controls UNDER a flip card: the grade pair once it is turned, a hint until then. Kept in
 * one function because the flip swaps them in place — see `toggleFlip`.
 */
function flipControlsHtml(revealed: boolean): string {
  return revealed
    ? `<div class="grade">
         <button class="btn miss" data-grade="0">Missed it<kbd>1</kbd></button>
         <button class="btn good" data-grade="1">Got it<kbd>2</kbd></button>
       </div>`
    : '<p class="turnhint">Tap the card to turn it over<span class="kbdhint"> — or press Space</span></p>';
}

/**
 * Turn the card over IN PLACE — the one interaction in the drill that must not re-render.
 *
 * The first cut of the flip called `render()`, which rebuilds `app.innerHTML` with `.turned`
 * already present — and a CSS transition cannot tween an element that is CREATED in its end
 * state, so the marquee interaction of the whole trainer silently never animated: the card
 * snapped. Toggling the class on the LIVE node is what makes the turn a turn, and it also
 * keeps scroll position and keyboard focus (the card keeps being the focused element), which
 * a full re-render was quietly throwing away every time.
 */
function toggleFlip(): void {
  const s = session;
  if (!s) return;
  const card = app.querySelector<HTMLElement>('.flipcard');
  const controls = app.querySelector<HTMLElement>('.flipcontrols');
  if (!card || !controls) { s.revealed = !s.revealed; render(); return; }
  s.revealed = !s.revealed;
  card.classList.toggle('turned', s.revealed);
  card.setAttribute('aria-label', flipAria(s.revealed));
  controls.innerHTML = flipControlsHtml(s.revealed);
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
          <button class="btn" data-print="${esc(deckId)}">Print the deck</button>
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
      <div class="card${q.mode === 'flip' ? ' card--flip' : ''}">
        ${q.mode === 'flip' ? '' : `<span class="modetag">${esc(MODE_TAG[q.mode])}</span>
        <div class="prompt">${esc(promptFor(q))}</div>`}
        ${questionBody(q, deckId, s, entry.style)}
      </div>
    </div>`;
  // Focus lands on the card itself, so Space works for the WHOLE session — the innerHTML swap
  // between cards otherwise dropped focus on <body> and stranded a keyboard user at the top of
  // the document after every single answer.
  app.querySelector<HTMLElement>('.flipcard')?.focus({ preventScroll: true });
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
  // THE MISSES ARE THE LESSON. A bare score tells you how the session went; the three pieces
  // you blanked on, shown by picture and name one more time, are the only part worth carrying
  // out of the room — and re-seeing them immediately is itself a rehearsal. The scheduler will
  // bring them back anyway; this is the free extra look while they still sting.
  const missed = s.queue
    .map((id, i) => (s.results[i] === false ? entry.deck.cards.find((c) => c.id === id) : undefined))
    .filter((c): c is CardSpec => !!c);
  const recap = missed.length === 0 ? '' : `<div class="recap">
      <h3>Worth another look</h3>
      <div class="recaps">${missed.map((c) => {
        const art = cardArt(c, { spec: null, deckId: entry.deck.id }, { width: 200, height: 130, context: 0.8 });
        return `<div class="recapcard">${art ? `<span class="mini">${art}</span>` : ''}<span class="rname">${esc(titleCase(c.back.name))}</span></div>`;
      }).join('')}</div>
    </div>`;
  app.innerHTML = `<div class="done">
      <h2>${esc(entry.deck.title)}</h2>
      <div class="score">${right} / ${s.results.length}</div>
      <div class="sub">this session</div>
      <div class="tally">
        <div><b>${m.known}</b>known</div>
        <div><b>${m.learning}</b>learning</div>
        <div><b>${m.unseen}</b>new</div>
      </div>
      ${recap}
      <div class="row">
        <button class="btn primary" data-again="${esc(entry.deck.id)}">Another round</button>
        <button class="btn" data-print="${esc(entry.deck.id)}">Print the deck</button>
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
      <!-- The two handouts belong HERE rather than on the deck list: both are about one
           structure, and this is the screen where a person has already chosen one. -->
      <div class="handouts">
        <button class="btn" data-worksheet="${esc(familyId)}">Print a label-the-diagram sheet</button>
        <button class="btn" data-poster="${esc(familyId)}">Print this sequence as a poster</button>
        <p class="hint">The worksheet prints with an answer key on the second page. Both carry the
          structure's own citation line, so a sheet handed to somebody says where it came from.</p>
      </div>
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

/**
 * The whole drill from the keyboard, without hunting for focus:
 *
 *   SPACE / ENTER   turn the card over (and back — a second look is free)
 *   1 / ArrowLeft   missed it          2 / ArrowRight   got it
 *
 * The grade keys work from anywhere in the drill, not only with the card focused, because a
 * full re-render between cards used to drop focus on <body> and strand a keyboard user at the
 * top of the document. Real buttons keep their native activation: Space with a button focused
 * is that button's press, never intercepted.
 */
app.addEventListener('keydown', (ev) => {
  const s = session;
  const q = s?.question;
  if (!s || !q) return;
  const t = ev.target as HTMLElement;
  if (t.closest('input, select, textarea')) return;

  if (!isSelfGraded(q.mode)) {
    // Choice modes: the number keys ARE the answer buttons, and once answered, Space moves on.
    // Routed through the real buttons' click() so the keyboard can never take a path the
    // pointer could not.
    if (s.picked === null && /^[1-9]$/.test(ev.key)) {
      const btn = app.querySelectorAll<HTMLButtonElement>('[data-pick]')[Number(ev.key) - 1];
      if (btn) { ev.preventDefault(); btn.click(); }
    } else if (s.picked !== null && (ev.key === ' ' || ev.key === 'Enter') && !t.closest('button')) {
      ev.preventDefault();
      app.querySelector<HTMLButtonElement>('[data-next]')?.click();
    }
    return;
  }

  if (ev.key === '1' || ev.key === 'ArrowLeft' || ev.key === '2' || ev.key === 'ArrowRight') {
    if (!s.revealed) return; // grading an unseen answer is not a thing
    ev.preventDefault();
    grade(ev.key === '2' || ev.key === 'ArrowRight', q.mode);
    advance();
    return;
  }
  if ((ev.key === ' ' || ev.key === 'Enter') && !t.closest('button')) {
    ev.preventDefault();
    if (q.mode === 'flip') toggleFlip();
    else { s.revealed = !s.revealed; render(); }
  }
});

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-go],[data-reveal],[data-flip],[data-grade],[data-pick],[data-next],[data-again],[data-reset],[data-print],[data-worksheet],[data-poster]');
  if (!el) return;

  const goTo = el.dataset['go'];
  if (goTo) { go(goTo); return; }

  const again = el.dataset['again'];
  if (again) { startSession(again); render(); return; }

  const print = el.dataset['print'];
  if (print) {
    const e = byId.get(print)!;
    void printPaperDeck(e.deck, e.tileFamilyId ?? e.familyId);
    return;
  }

  const worksheet = el.dataset['worksheet'];
  if (worksheet) {
    // The structure's OWN deck supplies the pieces and their plain names, so a worksheet can
    // never label something the flashcards do not teach.
    const entry = DECKS.find((d) => d.familyId === worksheet);
    if (!entry || !printWorksheet(worksheet, entry.deck)) {
      notice(['This browser would not open a print frame — try Save as PDF from the browser menu.']);
    }
    return;
  }

  const poster = el.dataset['poster'];
  if (poster) {
    if (!printStagePoster(poster)) {
      notice(['This browser would not open a print frame — try Save as PDF from the browser menu.']);
    }
    return;
  }

  const reset = el.dataset['reset'];
  if (reset) { state = resetDeck(state, reset); persist(); session = null; render(); return; }

  if (!session) return;
  const s = session;
  const q = currentQuestion(s);
  if (!q) return;

  if (el.dataset['reveal']) { s.revealed = true; render(); return; }
  // Turning the card is not answering it: the grade is still the learner's to give, so a flip
  // toggles and nothing is recorded until they say whether they had it.
  if (el.dataset['flip']) { toggleFlip(); return; }
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
