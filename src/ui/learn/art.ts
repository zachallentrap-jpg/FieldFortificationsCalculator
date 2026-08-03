// 1371 LEARNING — card art.
//
// The front of a card is the STRUCTURE, drawn, with one piece picked out in orange. It is the
// same SVG projector the picker uses (`thumbnailFor`), which means the art cannot drift from
// the model: it IS the model, drawn. No image files, no build step, nothing for the offline
// gate to find.
//
// Two rules make the art teach rather than decorate:
//
//   THE WHOLE STRUCTURE IS ALWAYS DRAWN. An early pass clipped the drawing to the stage the
//   piece goes in, on the theory that a rafter reads better against an open frame. It does not:
//   the foundation card then showed twenty-one orange sticks floating on grey with nothing to
//   locate them against, which is a shape to memorize rather than a piece to recognize. The
//   drawing is a wireframe, so nothing occludes anything — a footing under a finished building
//   is still perfectly visible, and now it is visibly UNDER A BUILDING.
//
//   THE VIEW NEVER MOVES. Every card in a deck is drawn from the same angle at the same scale,
//   so flipping through them reads as one building being pointed at, not thirteen photographs.

import { familyById, type FamilyId } from '../../timber/catalog';
import { thumbnailCached, type ThumbOptions } from '../../timber/thumbnails';
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
export function cardArt(card: CardSpec, source: ArtSource, opts: ThumbOptions = {}): string | null {
  if (card.front.art.kind === 'svg') return card.front.art.svg;
  const scene = card.front.art.scene;
  const resolved = specFor(scene, source);
  if (!resolved) return null;
  const ids = new Set(scene.memberIds);
  const width = opts.width ?? 420;
  const height = opts.height ?? 300;
  // Cache key carries everything that changes the bytes. Getting this wrong shows one card's
  // highlight on another card, which looks exactly like a scheduler bug and is not one.
  const key = `learn:${resolved.key}:${card.id}:${width}x${height}`;
  return thumbnailCached(key, resolved.spec, {
    width,
    height,
    human: false, // at card size the scale figure reads as another piece to identify
    highlight: ids,
    ...opts,
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
