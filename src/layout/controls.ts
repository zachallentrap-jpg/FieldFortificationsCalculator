// Input controls (§11, §12) generated from the doctrine tables — option lists come straight
// from Object.entries of the registries, so the UI can never offer a value the engine doesn't
// know (referential integrity is structural, not hand-maintained). Every control has an
// accessible <label> AND a one-line plain-language hint — the master vocabulary (parapet,
// revetment, sump, standard...) still appears, but nobody has to already know the jargon to
// use the form. A single delegated change handler in main.ts reads data-field.

import { positions } from '../doctrine/positions';
import { soils } from '../doctrine/soils';
import { standards } from '../doctrine/standards';
import { revetments } from '../doctrine/materials';
import { threatClasses, munitionsByClass, threatClassOf } from '../doctrine/protection';
import type { Inputs } from '../engine/types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface Opt {
  value: string;
  label: string;
}

function optionsFrom(table: Record<string, { label: string }>): Opt[] {
  return Object.entries(table).map(([value, row]) => ({ value, label: row.label }));
}

function selectCtrl(field: keyof Inputs, label: string, opts: Opt[], current: string, hint?: string): string {
  const id = 'f-' + field;
  const options = opts
    .map((o) => '<option value="' + esc(o.value) + '"' + (o.value === current ? ' selected' : '') + '>' + esc(o.label) + '</option>')
    .join('');
  return (
    '<label class="ctrl" for="' + id + '"><span class="ctrl-label">' + esc(label) + '</span>' +
    '<select id="' + id + '" data-field="' + esc(String(field)) + '">' + options + '</select>' +
    (hint ? '<span class="ctrl-hint">' + esc(hint) + '</span>' : '') +
    '</label>'
  );
}

function toggleCtrl(field: keyof Inputs, label: string, checked: boolean, hint: string): string {
  const id = 'f-' + field;
  return (
    '<label class="ctrl toggle" for="' + id + '">' +
    '<span class="toggle-row"><input type="checkbox" id="' + id + '" data-field="' + esc(String(field)) + '"' + (checked ? ' checked' : '') + '>' +
    '<span class="ctrl-label">' + esc(label) + '</span></span>' +
    '<span class="ctrl-hint">' + esc(hint) + '</span>' +
    '</label>'
  );
}

function numberCtrl(field: keyof Inputs, label: string, value: number, min: number, max: number, hint: string): string {
  const id = 'f-' + field;
  return (
    '<label class="ctrl" for="' + id + '"><span class="ctrl-label">' + esc(label) + '</span>' +
    '<input type="number" inputmode="numeric" id="' + id + '" data-field="' + esc(String(field)) + '"' +
    ' value="' + value + '" min="' + min + '" max="' + max + '" step="1">' +
    '<span class="ctrl-hint">' + esc(hint) + '</span>' +
    '</label>'
  );
}

const UNIT_OPTS: Opt[] = [{ value: 'imperial', label: 'Feet & inches' }, { value: 'metric', label: 'Meters' }];

// Two-level threat: class → specific caliber/round. The class select (data-action) filters
// the caliber select (data-field="threat"); only the munition id is stored in inputs.
function threatCtrl(inputs: Inputs): string {
  const cls = threatClassOf(inputs.threat);
  const classOpts: Opt[] = [{ value: 'none', label: 'None' }, ...threatClasses.map((c) => ({ value: c.id, label: c.label }))];
  const classOptions = classOpts
    .map((o) => '<option value="' + esc(o.value) + '"' + (o.value === cls ? ' selected' : '') + '>' + esc(o.label) + '</option>')
    .join('');
  const classSelect =
    '<label class="ctrl" for="f-threat-class"><span class="ctrl-label">Threat class</span>' +
    '<select id="f-threat-class" data-action="threat-class">' + classOptions + '</select>' +
    '<span class="ctrl-hint">What kind of weapon you’re protecting against.</span></label>';

  const disabled = cls === 'none';
  const munOptions = disabled
    ? '<option>— none —</option>'
    : munitionsByClass(cls)
        .map((m) => '<option value="' + esc(m.id) + '"' + (m.id === inputs.threat ? ' selected' : '') + '>' + esc(m.label) + '</option>')
        .join('');
  const munSelect =
    '<label class="ctrl" for="f-threat"><span class="ctrl-label">Caliber / round</span>' +
    '<select id="f-threat" data-field="threat"' + (disabled ? ' disabled' : '') + '>' + munOptions + '</select>' +
    '<span class="ctrl-hint">A bigger weapon needs thicker cover and more roof clearance.</span></label>';
  return classSelect + munSelect;
}

export function controlsHtml(inputs: Inputs): string {
  return (
    '<form class="controls" aria-label="Position inputs" autocomplete="off">' +
    '<fieldset><legend>What you’re building</legend>' +
    selectCtrl('positionType', 'Type', optionsFrom(positions), inputs.positionType, 'The kind of fighting position or defensive spot.') +
    selectCtrl(
      'standard',
      'Standard',
      optionsFrom(standards),
      inputs.standard,
      'Time vs. protection: hasty = fast, less protection. Reinforced = slowest, most protection.',
    ) +
    selectCtrl('soil', 'Soil', optionsFrom(soils), inputs.soil, 'What you’re digging into — changes how hard the dig is.') +
    threatCtrl(inputs) +
    selectCtrl('revetment', 'Revetment', optionsFrom(revetments), inputs.revetment, 'Holds the dirt walls back so they don’t cave in.') +
    '</fieldset>' +
    '<fieldset><legend>Extra features</legend>' +
    toggleCtrl('overheadCover', 'Roof overhead', inputs.overheadCover, 'Adds a roof for protection from above.') +
    toggleCtrl('sump', 'Grenade catch-pit (sump)', inputs.sump, 'A low spot where a thrown grenade rolls away from you.') +
    toggleCtrl('firingStep', 'Step to shoot from', inputs.firingStep, 'So you can see and shoot over the front wall.') +
    toggleCtrl('camouflage', 'Camouflage', inputs.camouflage, 'Makes the position harder to spot.') +
    toggleCtrl('machineAssist', 'Use machinery to dig', inputs.machineAssist, 'Faster than digging it all by hand.') +
    '</fieldset>' +
    '<fieldset><legend>How many, and units</legend>' +
    numberCtrl('count', 'How many positions', inputs.count, 1, 999, 'How many of this position you’re building.') +
    numberCtrl('teamSize', 'Crew size', inputs.teamSize, 1, 50, 'How many people are digging and building.') +
    selectCtrl('unit', 'Show measurements in', UNIT_OPTS, inputs.unit, 'Only changes how numbers are shown, not the design.') +
    '</fieldset>' +
    '</form>'
  );
}
