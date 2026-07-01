// Help drawer (§12) — plain-language explanation of every input, offline. Ties to USER_GUIDE.md.
function item(term: string, def: string): string {
  return '<dt>' + term + '</dt><dd>' + def + '</dd>';
}

export function helpHtml(): string {
  return (
    '<div class="help"><h2>How to use SAP-1</h2>' +
    '<p class="help-warn">Everything here runs on <strong>illustrative placeholder data</strong>. Numbers marked (PH) are not authoritative — confirm each against current pubs before any field use.</p>' +
    '<dl>' +
    item('Type', 'The doctrinal position: one/two-man fighting positions, crew-served, vehicle defilade, mortar pit, bunker/OP-CP. Each has fixed geometry and features.') +
    item('Standard', 'Hasty → deliberate → reinforced. Scales depth, cover, and labor — a hasty position is faster and shallower; reinforced is deeper with more protection.') +
    item('Soil', 'Drives dig difficulty and wall slope. Some soils doctrinally force revetment regardless of your toggle.') +
    item('Threat', 'Selects the protection model. Contact-burst and shaped-charge roofs are flagged out to a qualified engineer — the app never invents a roof thickness for them.') +
    item('Revetment', 'Wall retention: sandbag facing, pickets & wire, corrugated metal, or timber/plywood. Adds materials and labor.') +
    item('Overhead cover', 'Adds an earth-on-stringers roof where the threat allows it. Turns into an ENGINEERED-ROOF flag for contact-burst / shaped-charge.') +
    item('Grenade sump(s)', 'Adds the position’s doctrinal sumps (a place a grenade rolls into). Positions that define zero sumps add none.') +
    item('Firing step', 'Draws a firing step/ledge in the section. Crew-served positions carry a structural firing platform regardless.') +
    item('Camouflage / Machine assist', 'Camouflage adds net area; machine assist reduces excavation labor.') +
    item('Positions / Team size', 'Count of positions to build and the crew size — drive total man-hours and elapsed time.') +
    item('Units', 'Display only. All math is in feet; switching imperial/metric never changes the result, only how it reads.') +
    item('Tap a number', 'Any value with an underline opens its derivation — the exact formula, its operands, and which are placeholders.') +
    '</dl></div>'
  );
}
