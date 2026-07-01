// Diagnostics (§14). A fully offline snapshot: app/schema/doctrine versions, placeholder
// counts, and the last error. Powers the diagnostics panel so a user (or bug report) can see
// exactly what state the app is in — with no network call.

import { APP_VERSION, SCHEMA_VERSION, DOCTRINE_VERSION } from '../version';
import { counts } from '../doctrine/registry';

export interface Diagnostics {
  appVersion: string;
  schemaVersion: number;
  doctrineVersion: number;
  placeholders: { total: number; remaining: number; safetyCriticalRemaining: number };
  lastError: string | null;
  online: false; // SAP-1 makes no network calls, ever
}

export function collectDiagnostics(lastError: string | null): Diagnostics {
  const c = counts();
  return {
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    doctrineVersion: DOCTRINE_VERSION,
    placeholders: { total: c.total, remaining: c.placeholder, safetyCriticalRemaining: c.safetyCriticalRemaining },
    lastError,
    online: false,
  };
}

export function diagnosticsText(d: Diagnostics): string {
  return (
    'SAP-1 ' + d.appVersion + ' · schema ' + d.schemaVersion + ' · doctrine ' + d.doctrineVersion + '\n' +
    'Placeholders: ' + d.placeholders.remaining + ' / ' + d.placeholders.total +
    ' (safety-critical: ' + d.placeholders.safetyCriticalRemaining + ')\n' +
    'Last error: ' + (d.lastError ?? 'none') + '\n' +
    'Network: offline by design'
  );
}
