// Desktop layout (§11): three regions — inputs sidebar · drawings · specs/BOM rail.
import type { Parts } from './shell';

export function arrangeDesktop(p: Parts): string {
  return (
    '<main class="app-body layout-desktop">' +
    '<aside class="region controls-region">' + p.controls + '</aside>' +
    '<section class="region drawings-region">' + p.plan + p.section + p.iso + '</section>' +
    '<aside class="region rail">' + p.specs + p.bom + p.labor + p.validation + '</aside>' +
    '</main>'
  );
}
