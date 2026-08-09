// Text alternative for the 3D model (design doc §11.4 a11y). The model is the centrepiece of this
// tool — it is what "watch it go up in order" means — and it is a WebGL canvas, which exposes no
// text of any kind. SAP-1's drawings each ship a <title>/<desc> pair; this pane had nothing, so
// the one thing showing the state of the build was silent to anyone not looking at it.
//
// Pure and DOM-free on purpose: woodframe-scene.ts grabs elements at module scope, so anything
// living there cannot be tested at all. The sentence describes the SAME members the scene draws
// (rebuild() places every member with stage ≤ current), so the two cannot drift apart.

import { STAGES, LAST_STAGE, type Member, type StageId } from './types';
import type { BuildingInput } from './frame';
// TIMBER-1's own copy of this sentence is gone: the two tools now head a blocking problem with one
// string, which is what the note here always asked for.
import { problemsHeading as sharedProblemsHeading } from '../doctrine/labels';

// What the model IS, before what step it is at. The description named the step and counted the
// members and never said what building this was — a screen-reader user scrubbing the whole sequence
// never learned it was a 20 × 16 ft hut with 8 ft walls and a 4:12 roof, though every one of those
// numbers is their own input and the collapsed design summary states them to a sighted user two
// lines above the canvas. SAP-1's drawing descriptions open with the position and its depth for
// exactly this reason.
//
// `input` is required rather than optional: a caller that omitted it would silently go back to
// describing "the frame".
function describeBuilding(b: BuildingInput): string {
  const roof = b.risePer12 > 0 ? `${b.risePer12}:12 roof` : 'flat roof';
  const n = b.openings.length;
  const openings = n === 0 ? 'no openings' : n === 1 ? '1 opening' : `${n} openings`;
  return `${b.lengthFt} × ${b.widthFt} ft frame, ${b.wallHeightFt} ft walls, ${roof}, ${openings}`;
}

export function describeModel(members: Member[], currentStage: StageId, input: BuildingInput): string {
  const def = STAGES.find((s) => s.id === currentStage);
  const total = members.length;
  const what = describeBuilding(input);
  if (!def) return `3D model of a ${what} — ${total} members.`;

  const standing = members.filter((m) => m.stage <= currentStage).length;
  const raised = members.filter((m) => m.stage === currentStage).length;
  const head = `3D model of a ${what}. Step ${currentStage} of ${LAST_STAGE}, ${stageText(def.id, members).name}.`;

  // Two different reasons a step raises nothing, and they must not read the same (see types.ts
  // STAGES.framed): a trade this tool does not model at all, versus a step that frames members on
  // other designs but happens to cut none on this one.
  if (!def.framed) {
    return `${head} This step is finish work TIMBER-1 does not model; the frame stands complete at ${total} members.`;
  }
  if (raised === 0) {
    return `${head} Nothing is cut at this step in this design; ${standing} of ${total} members are standing.`;
  }
  return `${head} ${standing} of ${total} members standing, ${raised} raised at this step.`;
}

export interface RailRow {
  id: StageId;
  name: string;
  phase: string;
  state: 'done' | 'on' | 'todo';
  meta: string;
}

// The build-order rail, one row per FM 5-426 step. Extracted here, next to describeModel and for
// the same reason: it decides what the sequence LOOKS like, and it lived where nothing could test
// it — where it had drifted into holding two different rules for one step.
//
// The rail marked a step complete only if that step had cut members, so on a slab-on-grade design
// (crawl space 0, a valid input) step 1 "Layout & foundation" framed nothing and never went green,
// however far the build advanced — the foundation step of a foundation-first sequence, permanently
// unstarted. The stage panel beside it said of the very same step "the work is still done". A step
// you have passed is done; whether it cut lumber is what `meta` is for, and the two are now
// separate questions answered in one place.
export function railRows(
  bomStages: { stage: StageId; memberCount: number; manHours: number }[],
  currentStage: StageId,
  hrs: (manHours: number) => string,
  membersForText: Member[] = [],
): RailRow[] {
  return STAGES.map((s) => {
    const row = bomStages.find((b) => b.stage === s.id);
    return {
      id: s.id,
      name: stageText(s.id, membersForText).name,
      phase: s.phase,
      state: s.id === currentStage ? 'on' : s.id < currentStage ? 'done' : 'todo',
      meta: row
        ? `${row.memberCount} pcs · ${row.manHours.toFixed(1)} MH · ${hrs(row.manHours)} hr`
        : s.framed
          ? 'nothing to cut here in this design'
          : 'finish work — not framed',
    };
  });
}

// Carpenter-readable names for the framing roles. These existed in woodframe-scene.ts and were
// used by exactly ONE of the three surfaces that print a role: the member card said "rim joist"
// while the on-screen cut list and the PRINTED build plan both wrote the raw identifier —
// `rimJoist`, `solePlate`, `topPlate`, `jackStud` — in the Use column a carpenter reads while
// cutting. The names were right there and two surfaces dropped them.
//
// Moved here for the same reason railRows was: woodframe-scene.ts grabs DOM at module scope, so
// nothing living there can be tested, which is how two of its three consumers drifted.
const ROLE_PLAIN: Record<string, string> = {
  post: 'post', sill: 'sill', girder: 'girder (built-up)', joist: 'joist', rimJoist: 'rim joist',
  bridging: 'bridging', subfloor: 'subfloor panel', solePlate: 'sole plate', stud: 'stud',
  cripple: 'cripple', jackStud: 'jack stud (trimmer)', kingStud: 'king stud',
  header: 'header', topPlate: 'top plate', capPlate: 'cap plate (double top)',
  rafter: 'rafter', ridge: 'ridge board', collarTie: 'collar tie', roofPanel: 'roof sheathing panel',
  brace: 'brace', sheathingPanel: 'wall sheathing panel', siding: 'siding',
};

// A role the map has not caught up with splits on its camelCase hump rather than reaching paper as
// an identifier: 'someNewRole' reads "some new role". Wrong-but-readable beats right-but-cryptic on
// a document someone is cutting lumber from.
export function roleLabel(role: string): string {
  return ROLE_PLAIN[role] ?? role.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

// The step's name and instruction, resolved against what this design actually frames — the same
// audit SAP-1's stage table got. Two rows named work a given design does not do:
//
//   • "Layout & foundation / set piers to grade" — with crawl space 0 the sills sit at grade and
//     NO piers are cut, so the one step every build starts with described work that isn't there;
//   • "Floor joists & bridging / add rim joists and bridging" — bridging is only framed where a
//     joist span exceeds 8 ft (width ≥ 20 ft), so the default 16 ft hut was told to add bridging
//     that appears in no cut list, at no spacing, nowhere in the model.
//
// Keyed on the members themselves, not on the inputs that produced them, so the instruction cannot
// disagree with the cut list printed under it. Every other row's text holds on every design: where
// a step names a member framed at ANOTHER step ("girders on their posts", "joists across the
// girders", ceiling joists stopping "the rafters" spreading) it is telling the crew what the work
// bears on, which is instruction, not a claim about this step's own cut list.
export function stageText(id: StageId, members: Member[]): { name: string; does: string } {
  const def = STAGES.find((s) => s.id === id);
  if (!def) return { name: '', does: '' };
  const has = (role: string): boolean => members.some((m) => m.role === role);

  if (def.id === 1 && !has('post')) {
    return {
      name: 'Layout',
      does: 'Stake the building lines and square the corners — the sills sit at grade, so there are no piers to set.',
    };
  }
  if (def.id === 3 && !has('bridging')) {
    return { name: 'Floor joists', does: 'Hang joists across the girders; add rim joists.' };
  }
  // A third case the two above do not cover, and that `framed` cannot express: a step that frames
  // PART of what it names. Step 6 cuts its cap plates on every design and its braces on none —
  // `brace` is a declared role that nothing in the generator ever emits — so the member-keyed audit
  // above passed it (the step does frame something) while the crew was told to brace walls whose
  // brace stock appears in no cut list, at no length, in no 3D. Unlike bridging this is not
  // design-dependent, so the instruction is NOT dropped: bracing walls plumb before the roof loads
  // them is real work, and deleting the line would make the sequence worse, not more honest. What
  // was missing is the disclosure the rest of the app already gives for work it does not model.
  // Deliberately does not name the bracing TYPE (erection bracing vs let-in) — that is a doctrine
  // claim, and no leaf backs it.
  if (def.id === 6 && !has('brace')) {
    return { name: def.name, does: 'Lap the double top plate across corners; brace the walls plumb — bracing is not in the cut list.' };
  }
  return { name: def.name, does: def.does };
}

// How a blocking design problem is headed. TIMBER-1's printed sheet already said "Fix before
// building — 2 problems"; the on-screen panel showed the same sentences run together with no
// framing at all, so the surface a user edits against was the mildest statement of a design that
// cannot be framed — the same gap SAP-1's validation panel had. One string, both surfaces.
export function problemsHeading(count: number): string {
  return sharedProblemsHeading(count);
}
