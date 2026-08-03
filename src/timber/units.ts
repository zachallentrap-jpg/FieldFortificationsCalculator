// TIMBER-2 — how a length is written down.
//
// Lifted out of the studio when the trainer needed it: a deck compiler that had to import the
// UI to format a number would drag the DOM into a module that is supposed to run under `node
// --test`. One pure function, no imports, everything that prints a length calls it.
//
// Eighths, because that is the finest mark on a framing square and the resolution a saw cut is
// actually laid out to. Rounding to eighths BEFORE splitting feet from inches is what stops
// 11.999" printing as `0'-11 8/8"`.

export function fmtFtIn(inches: number): string {
  const eighths = Math.round(inches * 8);
  const ft = Math.floor(eighths / 96);
  let rem = eighths - ft * 96;
  const inch = Math.floor(rem / 8);
  rem -= inch * 8;
  const frac = rem === 0 ? '' : rem % 4 === 0 ? ' 1/2' : rem % 2 === 0 ? ` ${rem / 2}/4` : ` ${rem}/8`;
  return `${ft}'-${inch}${frac}"`;
}
