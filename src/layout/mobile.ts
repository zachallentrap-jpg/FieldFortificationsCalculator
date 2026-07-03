// Mobile layout (§11): single scroll column, a sticky summary bar, drawings full-width and
// stacked, tables as cards, and the controls in a bottom-sheet. The trigger button lives in the
// shared bottom toolbar (shell.ts bottomToolbar()), not here — this just owns the sheet itself.
// main.ts toggles the sheet's data-open.
import type { Parts } from './shell';

// sheetOpen is baked directly into the initial markup — NOT hardcoded false and corrected by
// main.ts's applySheet() after the fact. The whole shell re-renders on every input change
// (innerHTML swap), and three-viewer.ts's resize path reads clientWidth/clientHeight while
// re-attaching the canvas; that read forces the browser to flush the freshly-inserted sheet's
// default closed position (transform: translateY(100%)) as an actually-painted frame BEFORE
// applySheet() later corrects data-open to "true" — so with the old hardcoded-false markup, the
// sheet's 220ms open transition visibly replayed on every single dropdown/input change while it
// was open. Starting the node already in the right state means there's never a wrong state to
// force-paint in between.
export function arrangeMobile(p: Parts, sheetOpen: boolean): string {
  return (
    '<main class="app-body layout-mobile">' +
    p.summary +
    '<section class="region drawings-region">' + p.plan + p.section + p.three + '</section>' +
    '<section class="region rail">' + p.specs + p.bom + p.labor + p.validation + '</section>' +
    // The trigger sits BEHIND the open sheet (z-index), so it is not a usable close control once
    // the sheet covers it — closing is by design gesture-only: tap the backdrop, or swipe the
    // handle down past the dismiss threshold (see main.ts). Escape still closes it for keyboard
    // users.
    '<div class="sheet-backdrop" data-open="' + sheetOpen + '" data-action="sheet-toggle" aria-hidden="true"></div>' +
    '<div class="bottom-sheet" data-open="' + sheetOpen + '" aria-hidden="' + !sheetOpen + '" role="dialog" aria-label="Edit inputs">' +
    '<div class="sheet-header"><div class="sheet-handle" data-action="sheet-drag-handle" aria-hidden="true"></div></div>' +
    '<div class="sheet-scroll">' + p.controls + '</div></div>' +
    '</main>'
  );
}
