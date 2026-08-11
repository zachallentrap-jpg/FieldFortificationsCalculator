// WOODFRAME-1 engine — the FrameModel data model (docs/WOODFRAME1_3D_SYSTEM_DESIGN.md §1.1).
// The Member[] the generators emit is the SINGLE source of truth: the 3D scene, 2D drawings,
// cut list/BOM, and labor plan are all projections of this array — nothing downstream invents
// geometry. Pure types, no DOM, no three.js (SAP-1 engine discipline).

export type MemberRole =
  | 'sill' | 'girder' | 'post' | 'joist' | 'rimJoist' | 'bridging' | 'subfloor'
  | 'solePlate' | 'stud' | 'cripple' | 'jackStud' | 'kingStud' | 'header'
  | 'topPlate' | 'capPlate' | 'brace' | 'rafter' | 'ridge' | 'collarTie'
  | 'sheathingPanel' | 'roofPanel' | 'siding'
  // Foundation options (FM 5-426 foundations, PH pages) and framed-opening/stair teaching roles.
  | 'foundationWall' | 'footing' | 'slab'
  | 'trimmerJoist' | 'headerJoist' | 'tailJoist'
  | 'stringer' | 'tread'
  // ── WOODFRAME-2 additions (plan §3.6). Additive only: `siding` above is REUSED as the
  // plywood-siding role (TD8 — it had zero emitters), so no `sidingPanel` near-synonym
  // is minted. Roles land in the phase that emits them; the dictionary test (I-14) checks
  // emitted → PLAIN/WHAT, never the reverse, so declaring the vocabulary early is free.
  | 'sidingBoard' | 'batten' | 'buildingPaper'          // T2 coverings
  | 'purlin' | 'roofingCourse' | 'felt' | 'skid'        // T2 coverings / foundations
  | 'ridgeCap'                                          // the bent piece over a ridge or a hip
  | 'fascia'                                            // the board that closes an eave over the rafter tails
  | 'bargeBoard'                                        // the same board up a RAKE, closing a gable end
  | 'ponyStud' | 'rakeStud'                             // T2 shed roof (TD6)
  | 'railPost' | 'railTop' | 'railMid' | 'toeBoard'     // T4 railings (EM 385-1-1)
  | 'ladderRail' | 'ladderRung'                         // T4 access
  | 'towerLeg' | 'towerBrace' | 'girt' | 'capBeam' | 'deckPlank' // T4 tower / T6 platform
  | 'hipRafter' | 'jackRafter'                          // T4 pyramid cab, T8 hip
  | 'bentPost' | 'bentRafter' | 'bentCollar'            // T6 tent frames
  | 'screenFrame' | 'screenPanel'                       // T5 screen bands
  | 'doorBoard' | 'doorLedge' | 'doorBrace' | 'shutter' | 'riserBox' // T5 built openings
  | 'cribLog' | 'lagging' | 'ohcStringer' | 'ohcBlocking' | 'baffleWall' | 'soilGhost' // T7 bunker
  | 'hardware';                                          // T8 counted items

export type WallId = 'N' | 'S' | 'E' | 'W';

// FM 5-426 construction order (design doc §2.1) — the stage scrubber's spine.
export const STAGES = [
  { id: 1, name: 'Layout & foundation' },
  { id: 2, name: 'Sills & girders' },
  { id: 3, name: 'Floor joists & bridging' },
  { id: 4, name: 'Subfloor' },
  { id: 5, name: 'Wall framing' },
  { id: 6, name: 'Plates tied & braced' },
  { id: 7, name: 'Ceiling joists' },
  { id: 8, name: 'Rafters & ridge' },
  { id: 9, name: 'Roof sheathing' },
  { id: 10, name: 'Roofing' },
  { id: 11, name: 'Siding & exterior finish' },
] as const;
export type StageId = (typeof STAGES)[number]['id'];

export interface Member {
  id: string; // stable: "S-stud-014"
  role: MemberRole;
  nominal: string; // "2x4", "2x10", "6x8 built-up(3)", "4x8 panel"
  actual: { w: number; d: number }; // dressed inches (FM 5-426 Table 2-1): w = thickness, d = face width
  cutLength: number; // inches, exact (incl. angle allowances)
  angles?: { plumbCut?: number; seatCut?: number; miter?: number };
  // Member CENTER in feet; building origin at the front-left sill corner (front = south wall).
  position: [x: number, y: number, z: number];
  // Euler radians, order 'YXZ' (yaw about world Y first). Canonical member frame matches the
  // lumber prop: length along local X, face width along local Y, thickness along local Z.
  rotation: [rx: number, ry: number, rz: number];
  stage: StageId;
  wall?: WallId;
  grade: string; // "No. 2 common" default per FM 5-426
  nailing: string; // e.g. "2-16d toenail ea end"
  doctrineRef: string; // page cite, e.g. "FM 5-426 Table 6-2, p.6-17"
  count?: number; // for instanced identical members
  /**
   * How much of `cutLength` is BEARING rather than span — both ends together, in inches.
   *
   * A span table row is a clear span between bearings and a cut length is not: a doorway header is
   * cut to the rough opening plus a jack stud at each side, a beam over an open bay runs post
   * centreline to post centreline with half a post under each end (and a whole post at the ends of
   * the run, which is why this is a TOTAL and not a per-end figure), and a bunker's entrance header
   * lands on jamb timbers that are neither. The span checker cannot read that off the role — every
   * one of them is a `header` — so the member that was cut says what it was cut to bear on.
   *
   * Absent means the doorway shape (a jack stud at each side), which is what the frozen wall
   * generator cuts and what `spans.ts` falls back to. Omitted from the emitted member when the
   * emitter does not set it, so nothing in the frozen branch's output moves.
   */
  bearingTotalIn?: number;
}

// Dressed sizes, inches (FM 5-426 Table 2-1 values for common dimension lumber).
// w = thickness, d = face width. WOODFRAME-2 §3.6 adds the sizes the new families cut from;
// every nominal any generator emits must resolve HERE — the `{1.5, 3.5}` fallback in the
// emitters is unreachable in generated output, and a test asserts it (I-14).
//
// TWO DEDUCTIONS, NOT ONE, AND THE SIZE DECIDES WHICH. Softwood dresses by nominal − 1/2 in up
// to a 6-in face and nominal − 3/4 in at 8 in and over — but that second, larger deduction is a
// DIMENSION-LUMBER rule. A TIMBER (nominal 5 in and thicker in its least dimension) is surfaced
// green and dresses by 1/2 in on every face, so an 8-in timber face is 7 1/2 in where an 8-in
// dimension-lumber face is 7 1/4. The two timber rows here carry the timber deduction, which is
// what the bunker cribbing, the bunker cap, the overhead stringers and the tower mudsill are cut
// from — the LS-tagged members in the table.
//
// AND THE BILL FOLLOWS. Only the RATE is nominal: `BF_PER_LF` is a nominal section, so a stick of
// 8x8 costs the same board feet per foot whatever it dresses to. The LENGTHS are not — a piece
// cut to fit between two members is cut to their dressed faces, so each of the crib bunker's 18
// overhead blocks is cut 14.556 IN between 7 1/2-in stringers where it would be 14.833 in between
// 7 1/4-in ones, and the bunker's board-foot total moves with it. A dressed size is a geometry
// number that reaches the BOM through the cut list; treating it as decoration is how it gets
// edited casually.
// `test/woodframe2-dressed.test.ts` asserts the deduction rule across every row rather than these
// two, and pins the blocking's cut to the rule rather than to a literal.
export const DRESSED: Record<string, { w: number; d: number }> = {
  '1x2': { w: 0.75, d: 1.5 },
  '1x3': { w: 0.75, d: 2.5 },
  '1x4': { w: 0.75, d: 3.5 },
  '1x6': { w: 0.75, d: 5.5 },
  '1x8': { w: 0.75, d: 7.25 },
  '1x10': { w: 0.75, d: 9.25 },
  '2x2': { w: 1.5, d: 1.5 },
  '2x4': { w: 1.5, d: 3.5 },
  '2x6': { w: 1.5, d: 5.5 },
  '2x8': { w: 1.5, d: 7.25 },
  '2x10': { w: 1.5, d: 9.25 },
  '2x12': { w: 1.5, d: 11.25 },
  '4x4': { w: 3.5, d: 3.5 },
  '4x6': { w: 3.5, d: 5.5 },
  '6x6': { w: 5.5, d: 5.5 },
  '6x8': { w: 5.5, d: 7.5 },
  '8x8': { w: 7.5, d: 7.5 },
};
