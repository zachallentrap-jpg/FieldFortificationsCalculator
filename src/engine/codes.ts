// Validation-code catalog (§9). Stable `code` strings + message templates + severity.
// validate.ts is the only module that fires these; keeping them here means a test can
// assert every code is reachable and that codes never silently change severity.

import type { Severity, ValidationIssue } from './types';

export interface CodeDef {
  code: string;
  severity: Severity;
  message: string;
}

const def = (code: string, severity: Severity, message: string): CodeDef => ({ code, severity, message });

export const CODES = {
  INVALID_POSITION: def('INVALID_POSITION', 'error', 'Unknown position type — using a default position.'),
  INVALID_SOIL: def('INVALID_SOIL', 'error', 'Unknown soil — using a default soil.'),
  INVALID_THREAT: def('INVALID_THREAT', 'error', 'Unknown threat — treated as no threat.'),
  INVALID_STANDARD: def('INVALID_STANDARD', 'error', 'Unknown standard — using deliberate.'),
  REVET_REQUIRED_SOIL: def(
    'REVET_REQUIRED_SOIL',
    'error',
    'This soil requires revetment but none is selected — walls will slough.',
  ),
  ROOF_ENGINEERED: def(
    'ROOF_ENGINEERED',
    'warning',
    'Overhead cover for this threat must be engineered by a qualified designer — no cover thickness is estimated.',
  ),
  ROOF_ENGINEERED_HASTY: def(
    'ROOF_ENGINEERED_HASTY',
    'warning',
    'An engineered roof is required while the standard is hasty — reassess time and resources.',
  ),
  EXCAV_HAND_HEAVY: def(
    'EXCAV_HAND_HEAVY',
    'advisory',
    'Hand-digging heavy or hard ground — consider machine assist.',
  ),
  COUNT_CLAMPED: def('COUNT_CLAMPED', 'advisory', 'Position count was clamped to the 1–999 range.'),
  TEAM_CLAMPED: def('TEAM_CLAMPED', 'advisory', 'Team size was clamped to the 1–50 range.'),
} as const;

export type CodeKey = keyof typeof CODES;

export function issue(def: CodeDef, extra?: string): ValidationIssue {
  return {
    severity: def.severity,
    code: def.code,
    message: extra ? def.message + ' ' + extra : def.message,
  };
}

// Every catalog entry, for the reachability test (§17 validate).
export function allCodes(): CodeDef[] {
  return Object.values(CODES);
}
