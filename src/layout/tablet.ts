// Tablet layout (§11, likely the primary field device): split view — collapsible controls
// beside the canvas, plan & section side-by-side, panels below. Glove-friendly targets.
import type { Parts } from './shell';

export function arrangeTablet(p: Parts): string {
  return (
    '<main class="app-body layout-tablet">' +
    '<aside class="region controls-region">' + p.controls + '</aside>' +
    '<section class="region canvas-region">' +
    '<div class="drawings-row">' + p.plan + p.section + '</div>' +
    '<div class="iso-row">' + p.three + '</div>' +
    '<div class="panels-row">' + p.specs + p.bom + p.labor + p.validation + '</div>' +
    '</section>' +
    '</main>'
  );
}
