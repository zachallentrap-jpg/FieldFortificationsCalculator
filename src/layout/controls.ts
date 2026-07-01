// Input controls (§11, §12) generated from the doctrine tables — option lists come straight
// from Object.entries of the registries, so the UI can never offer a value the engine doesn't
// know (referential integrity is structural, not hand-maintained). Every control has an
// accessible <label>; a single delegated change handler in main.ts reads data-field.

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

function toggleCtrl(field: keyof Inputs, label: string, checked: boolean): string {
  const id = 'f-' + field;
  return (
    '<label class="ctrl toggle" for="' + id + '">' +
    '<input type="checkbox" id="' + id + '" data-field="' + esc(String(field)) + '"' + (checked ? ' checked' : '') + '>' +
    '<span class="ctrl-label">' + esc(label) + '</span></label>'
  );
}

function numberCtrl(field: keyof Inputs, label: string, value: number, min: number, max: number): string {
  const id = 'f-' + field;
  return (
    '<label class="ctrl" for="' + id + '"><span class="ctrl-label">' + esc(label) + '</span>' +
    '<input type="number" inputmode="numeric" id="' + id + '" data-field="' + esc(String(field)) + '"' +
    ' value="' + value + '" min="' + min + '" max="' + max + '" step="1"></label>'
  );
}

const UNIT_OPTS: Opt[] = [{ value: 'imperial', label: 'Imperial (ft-in)' }, { value: 'metric', label: 'Metric (m)' }];

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
    '<select id="f-threat-class" data-action="threat-class">' + classOptions + '</select></label>';

  const disabled = cls === 'none';
  const munOptions = disabled
    ? '<option>— none —</option>'
    : munitionsByClass(cls)
        .map((m) => '<option value="' + esc(m.id) + '"' + (m.id === inputs.threat ? ' selected' : '') + '>' + esc(m.label) + '</option>')
        .join('');
  const munSelect =
    '<label class="ctrl" for="f-threat"><span class="ctrl-label">Caliber / round</span>' +
    '<select id="f-threat" data-field="threat"' + (disabled ? ' disabled' : '') + '>' + munOptions + '</select>' +
    '<span class="ctrl-hint">Size drives cover thickness, standoff &amp; roof.</span></label>';
  return classSelect + munSelect;
}

export function controlsHtml(inputs: Inputs): string {
  return (
    '<form class="controls" aria-label="Position inputs" autocomplete="off">' +
    '<fieldset><legend>Position</legend>' +
    selectCtrl('positionType', 'Type', optionsFrom(positions), inputs.positionType) +
    selectCtrl('standard', 'Standard', optionsFrom(standards), inputs.standard, 'Hasty → deliberate → reinforced') +
    selectCtrl('soil', 'Soil', optionsFrom(soils), inputs.soil) +
    threatCtrl(inputs) +
    selectCtrl('revetment', 'Revetment', optionsFrom(revetments), inputs.revetment) +
    '</fieldset>' +
    '<fieldset><legend>Features</legend>' +
    toggleCtrl('overheadCover', 'Overhead cover', inputs.overheadCover) +
    toggleCtrl('sump', 'Grenade sump(s)', inputs.sump) +
    toggleCtrl('firingStep', 'Firing step', inputs.firingStep) +
    toggleCtrl('camouflage', 'Camouflage', inputs.camouflage) +
    toggleCtrl('machineAssist', 'Machine assist (dig)', inputs.machineAssist) +
    '</fieldset>' +
    '<fieldset><legend>Scale &amp; units</legend>' +
    numberCtrl('count', 'Positions', inputs.count, 1, 999) +
    numberCtrl('teamSize', 'Team size', inputs.teamSize, 1, 50) +
    selectCtrl('unit', 'Units', UNIT_OPTS, inputs.unit) +
    '</fieldset>' +
    '</form>'
  );
}
