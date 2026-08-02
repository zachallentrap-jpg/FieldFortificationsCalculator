// ResolvedTheme (blueprint §4.4, I8): renderers take CONCRETE hex, and the string
// written to an exported file is the same string drawn on screen — no CSS variables
// exist anywhere in render output, so the exported-SVG-renders-black class (v1 §6C)
// has nothing to happen with. The artifact gate asserts no `var(` in any SvgDoc.

export interface ResolvedTheme {
  readonly paper: string;
  readonly ink: string;        // primary linework/text
  readonly inkMuted: string;
  readonly earth: string;      // cut-earth fill
  readonly earthDark: string;
  readonly grade: string;      // grade-line stroke
  readonly dimension: string;  // dimension lines/text
  readonly tokenBox: string;   // unfilled-token chip fill
  readonly warn: string;       // watermark / banner red
  readonly enemy: string;      // enemy band (pure K black by doctrine of §3.3)
}

export const LIGHT: ResolvedTheme = {
  paper: '#ffffff',
  ink: '#1a1c1e',
  inkMuted: '#5b6167',
  earth: '#e8dcc8',
  earthDark: '#c9b895',
  grade: '#4a4f54',
  dimension: '#8a4b0f',
  tokenBox: '#f3e8d2',
  warn: '#b3261e',
  enemy: '#000000',
};
