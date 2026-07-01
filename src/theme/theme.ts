// Theme (§12). Day (default) and Night (red/amber light-discipline). Applied via the root
// data-theme attribute (tokens.css swaps every custom property). Persisted to localStorage;
// first run follows prefers-color-scheme. No network, no dependency.

export type Theme = 'day' | 'night';
const KEY = 'sap1.theme';

export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode / storage disabled — theme still applies for the session */
  }
}

export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'day' || saved === 'night') return saved;
  } catch {
    /* ignore */
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) return 'night';
  return 'day';
}
