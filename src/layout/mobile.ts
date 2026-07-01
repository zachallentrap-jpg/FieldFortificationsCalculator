// Mobile layout (§11): single scroll column, a sticky summary bar, drawings full-width and
// stacked, tables as cards, and the controls in a bottom-sheet opened by a thumb-reachable
// button (≥44px targets). main.ts toggles the sheet's data-open.
import type { Parts } from './shell';

export function arrangeMobile(p: Parts): string {
  return (
    '<main class="app-body layout-mobile">' +
    p.summary +
    '<section class="region drawings-region">' + p.plan + p.section + p.three + '</section>' +
    '<section class="region rail">' + p.specs + p.bom + p.labor + p.validation + '</section>' +
    '<button class="fab" type="button" data-action="sheet-toggle" aria-expanded="false">Edit inputs</button>' +
    '<div class="bottom-sheet" data-open="false" aria-hidden="true"><div class="sheet-handle" aria-hidden="true"></div>' +
    '<div class="sheet-scroll">' + p.controls + '</div></div>' +
    '</main>'
  );
}
