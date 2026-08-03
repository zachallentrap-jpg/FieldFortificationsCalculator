// 1371 LEARNING — card art.
//
// The front of a card is a PICTURE of the piece, in the structure, at the stage it goes in —
// drawn from the engine's own `Member[]` by `portraitFor`. It cannot drift from the model,
// because it IS the model, drawn. No image files, no build step, nothing for the offline gate
// to find.
//
// WHAT THIS REPLACED, and why. The first version drew the whole structure as line art with the
// subject stroked orange, on the reasoning that a piece needs its building around it to be
// recognisable. The reasoning was right and the picture was wrong: every card came out as the
// same flat orange wireframe of the same building, the subject one stroke among four hundred,
// and the owner's description of it was "a weird red whatever". You cannot learn to recognise a
// hip rafter from a diagram of a roof.
//
// Three things fix it, and all three matter:
//
//   SOLID.   Filled, shaded, occluded. Lumber reads as lumber and a piece in front hides the
//            piece behind it, which is most of what makes a drawing look like a thing.
//   ZOOMED.  The frame closes on the subject and keeps enough of its neighbours to place it.
//            You look at a hip rafter landing on a plate, not at a roof from across the yard.
//   STAGED.  Drawn as the structure stood when that piece went in. A girt against an open frame
//            is legible; the same girt behind finished siding is not there at all.
//
// The view angle never changes, so flipping through a deck still reads as one building being
// pointed at rather than as thirty unrelated photographs.

import { familyById, type FamilyId } from '../../timber/catalog';
import { thumbnailCached, type ThumbOptions } from '../../timber/thumbnails';
import { portraitCached, type PortraitOptions } from '../../timber/portrait';
import type { CardSpec, SceneHighlight } from '../../timber/train/core';
import type { StructureSpec } from '../../timber/spec';

export interface ArtSource {
  /** The deck's own structure, used when a highlight does not name one. */
  spec: StructureSpec | null;
  deckId: string;
}

function specFor(scene: SceneHighlight, fallback: ArtSource): { spec: StructureSpec; key: string } | null {
  const id = scene.source ?? fallback.deckId;
  const family = familyById(id as FamilyId);
  if (family) return { spec: family.preset, key: family.id };
  if (fallback.spec) return { spec: fallback.spec, key: fallback.deckId };
  return null;
}

/**
 * A card's front, as an SVG string. Returns null when the deck's structure cannot be resolved —
 * the caller shows the card's name instead of inventing a picture, because a placeholder
 * drawing on a card that asks "which piece is this?" is worse than no drawing.
 */
export function cardArt(card: CardSpec, source: ArtSource, opts: PortraitOptions = {}): string | null {
  if (card.front.art.kind === 'svg') return card.front.art.svg;
  const scene = card.front.art.scene;
  const resolved = specFor(scene, source);
  if (!resolved) return null;
  // ONE PIECE IS MARKED, not every member of the role.
  //
  // The compiler hands a card every member that shares its role, and marking them all was the
  // obvious thing to do — it shows that a stud is one of a rank. In a picture it is a disaster:
  // sixteen red X-braces in a tower bay come out as a red thicket with no single piece in it,
  // and the question "what is this piece" has no THIS to point at. The count is on the card's
  // own facts ("identical members: 16"), which is where a number belongs anyway.
  const first = scene.memberIds[0];
  const ids = new Set(first ? [first] : scene.memberIds);
  const width = opts.width ?? 420;
  const height = opts.height ?? 300;
  const context = opts.context ?? 1;
  // The stage the piece goes in, so the card shows the building it was actually installed into.
  // `stageOrdinal` is the compiler's, and it is the same number the sequence screen uses.
  const stageMax = opts.stageMax ?? scene.stageOrdinal;
  // Cache key carries everything that changes the bytes. Getting this wrong shows one card's
  // subject on another card, which looks exactly like a scheduler bug and is not one.
  const key = `learn:${resolved.key}:${card.id}:${width}x${height}:s${stageMax}:c${context}`;
  return portraitCached(key, resolved.spec, {
    width, height, context, stageMax,
    ...opts,
    focus: ids,
  });
}

/**
 * The structure as it stood at the end of one stage — the sequence screen's "watch it go up".
 * Every frame is drawn at the FULL structure's scale (the finished building sets the box), so
 * the stages read as one building growing rather than as five drawings that keep resizing.
 */
export function stageArt(familyId: string, ordinal: number, width = 240, height = 150): string | null {
  const family = familyById(familyId as FamilyId);
  if (!family) return null;
  const svg = thumbnailCached(`learn:stage:${familyId}:${ordinal}:${width}x${height}`, family.preset, {
    width,
    height,
    human: false,
    stageMax: ordinal,
  });
  // A stage can legitimately put nothing on the ground — the guard shack's "Layout & foundation"
  // is string lines and a level, and its skids do not go down until the next step. An empty grey
  // box beside that row reads as a rendering failure; no box reads as "nothing standing yet",
  // which is the truth.
  return svg.includes('<path d="M') ? svg : null;
}

/** The deck-list tile: the whole structure, optionally with a few pieces picked out. */
export function deckArt(familyId: string, highlight?: readonly string[], width = 260, height = 170): string | null {
  const family = familyById(familyId as FamilyId);
  if (!family) return null;
  const mark = highlight && highlight.length > 0 ? new Set(highlight) : undefined;
  return thumbnailCached(
    `learn:tile:${familyId}:${mark ? `h${highlight!.length}` : 'plain'}:${width}x${height}`,
    family.preset,
    { width, height, ...(mark ? { highlight: mark } : {}) },
  );
}
