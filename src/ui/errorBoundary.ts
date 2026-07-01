// Error boundary (§14). Wraps the pure compute + the render functions so any unexpected throw
// becomes a recoverable in-app state (no white screen). The caller shows the message and the
// diagnostics panel; the last error is also surfaced in diagnostics.

import { compute } from '../engine/compute';
import type { Inputs, Result } from '../engine/types';

export type Safe<T> = { ok: true; value: T } | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function safeCompute(inputs: Inputs): Safe<Result> {
  try {
    return { ok: true, value: compute(inputs) };
  } catch (e) {
    return { ok: false, error: 'Compute failed: ' + message(e) };
  }
}

export function safeRender(fn: (r: Result) => string, result: Result, label: string): Safe<string> {
  try {
    return { ok: true, value: fn(result) };
  } catch (e) {
    return { ok: false, error: label + ' render failed: ' + message(e) };
  }
}

// A minimal, dependency-free error card (SVG-free HTML) for when a render itself fails.
export function errorCardHtml(error: string): string {
  const safe = error.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return (
    '<div role="alert" style="padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--ink)">' +
    '<strong>Something went wrong drawing this view.</strong>' +
    '<p style="color:var(--ink-soft);font-size:12px;margin:6px 0 0">' + safe + '</p>' +
    '<p style="color:var(--ink-soft);font-size:12px;margin:6px 0 0">Your inputs are safe. Adjust a value or open Diagnostics.</p>' +
    '</div>'
  );
}
