// TIMBER-1 engine — foundation + floor generators (design doc §1.2 foundation.ts/floor.ts),
// stages 1–4. Pure: inputs + doctrine constants in, Member[] out.
//
// Vertical datum: y = 0 is the TOP OF SUBFLOOR (walls stand on it, floor structure hangs
// below, posts run down to grade). Everything derives from dressed sizes so a lumber change
// re-stacks the whole section.
//
// ponytail: girder is sized as a fixed built-up 3-2x10 and joists as 2x8 @ input spacing —
// the Table 6-1 load-area method and Table 6-2 span checks bolt on here later as pure
// functions that pick `girderNominal`/`joistNominal` instead of these constants.

import type { Member, MemberRole, StageId } from './types';
import { DRESSED } from './types';

const FT = 12;

export interface FloorInput {
  lengthFt: number; // building X
  widthFt: number; // building Z (joist span direction)
  joistSpacingIn: 16 | 24;
  crawlFt?: number; // grade to sill bottom (post height at perimeter), default 1.5
}

export interface FloorLevels {
  subfloorTop: number; // = 0 by definition
  joistTop: number;
  sillTop: number;
  gradeY: number; // where the ground plane sits
}

export function floorLevels(input: FloorInput): FloorLevels {
  const panelT = 0.75 / FT; // 3/4" subfloor
  const joistD = DRESSED['2x8']!.d / FT;
  const sillT = DRESSED['2x6']!.w / FT;
  const joistTop = -panelT;
  const sillTop = joistTop - joistD;
  const gradeY = sillTop - sillT - (input.crawlFt ?? 1.5);
  return { subfloorTop: 0, joistTop, sillTop, gradeY };
}

export function generateFloor(input: FloorInput): Member[] {
  const members: Member[] = [];
  const L = input.lengthFt;
  const W = input.widthFt;
  const lv = floorLevels(input);
  const counters: Partial<Record<MemberRole, number>> = {};

  const emit = (
    role: MemberRole,
    nominal: string,
    cutLenFt: number,
    position: [number, number, number],
    rotation: [number, number, number],
    stage: StageId,
    extras?: Partial<Member>,
  ): void => {
    const n = (counters[role] = (counters[role] ?? 0) + 1);
    members.push({
      id: `FL-${role}-${String(n).padStart(2, '0')}`,
      role,
      nominal,
      actual: DRESSED[nominal] ?? { w: 1.5, d: 3.5 },
      cutLength: cutLenFt * FT,
      position,
      rotation,
      stage,
      grade: 'No. 2 common',
      nailing: extras?.nailing ?? '16d common (PH)',
      doctrineRef: extras?.doctrineRef ?? 'FM 5-426 ch. 6 (PH page)',
      ...extras,
    });
  };

  const sillT = DRESSED['2x6']!.w / FT;
  const sillBottom = lv.sillTop - sillT;
  const joistD = DRESSED['2x8']!.d / FT;
  const girderD = DRESSED['2x10']!.d / FT;
  const t = 1.5 / FT;

  // ── Stage 1: posts on footers. Perimeter posts under the sills at ≤8 ft spacing plus
  // corners; girder posts under the center girder line (z = W/2), sized to reach grade.
  const postLen = sillBottom - lv.gradeY;
  const postCount = Math.max(2, Math.ceil(L / 8) + 1);
  const postAt = (x: number, z: number, len: number, yBase: number): void =>
    emit('post', '4x4', len, [x, yBase + len / 2, z], [0, 0, Math.PI / 2], 1, {
      doctrineRef: 'FM 5-426 post & footer spacing 6-10 ft (PH page)',
    });
  for (let i = 0; i < postCount; i++) {
    const x = (i / (postCount - 1)) * L;
    postAt(x, 0, postLen, lv.gradeY); // front sill line
    postAt(x, W, postLen, lv.gradeY); // rear sill line
  }
  const girderBottom = lv.joistTop - joistD - girderD + joistD; // girder top carries joists at sill top
  const girderPostLen = lv.sillTop - girderD - lv.gradeY;
  for (let i = 0; i < postCount; i++) {
    const x = (i / (postCount - 1)) * L;
    postAt(x, W / 2, girderPostLen, lv.gradeY);
  }
  void girderBottom;

  // ── Stage 2: sills (2x6 flat along front/rear post lines) + center girder (built-up 3-2x10
  // on edge, top flush with the sills so joists bear level across all three lines).
  for (const z of [0, W]) {
    emit('sill', '2x6', L, [L / 2, lv.sillTop - sillT / 2, z], [-Math.PI / 2, 0, 0], 2, {
      nailing: 'anchor/drift per post cap (PH)',
    });
  }
  for (const lat of [-t, 0, t]) {
    emit('girder', '2x10', L, [L / 2, lv.sillTop - girderD / 2, W / 2 + lat], [0, 0, 0], 2, {
      nominal: '2x10',
      doctrineRef: 'FM 5-426 Table 6-1 built-up girder (PH: fixed 3-2x10, load-area method pending)',
      nailing: '16d @ 16" staggered, both faces (PH)',
    });
  }

  // ── Stage 3: joists (2x8 on edge spanning front-to-rear over the girder) + rim joists +
  // bridging (>8 ft span each side of girder → one row per bay if needed).
  const oc = input.joistSpacingIn / FT;
  const joistY = lv.joistTop - joistD / 2;
  const joistXs: number[] = [];
  for (let x = t / 2; x < L - t / 2 - 0.01; x += oc) joistXs.push(x);
  joistXs.push(L - t / 2);
  for (const x of joistXs) {
    emit('joist', '2x8', W, [x, joistY, W / 2], [0, -Math.PI / 2, 0], 3, {
      nailing: '3-16d toenail ea bearing (PH)',
      doctrineRef: 'FM 5-426 Table 6-2 joist span (PH: 2x8 fixed, span check pending)',
    });
  }
  for (const z of [0, W]) {
    emit('rimJoist', '2x8', L, [L / 2, joistY, z], [0, 0, 0], 3, { nailing: '3-16d ea joist end (PH)' });
  }
  // Bridging: each half-span bay (girder splits W) gets one row when longer than 8 ft.
  for (const zMid of [W / 4, (3 * W) / 4]) {
    if (W / 2 <= 8) break;
    for (let i = 0; i < joistXs.length - 1; i++) {
      emit('bridging', '2x4', oc - t, [(joistXs[i]! + joistXs[i + 1]!) / 2, joistY, zMid], [0, 0, 0], 3, {
        nailing: '2-8d ea end (PH)',
        doctrineRef: 'FM 5-426: bridging row per span >8 ft (PH page)',
      });
    }
  }

  // ── Stage 4: subfloor panels, 4x8 laid across the joists, courses staggered half a panel.
  const panelT = 0.75 / FT;
  const rows = Math.ceil(W / 4);
  for (let r = 0; r < rows; r++) {
    const zC = Math.min(r * 4 + 2, W - 2);
    const stagger = r % 2 === 1 ? 4 : 0;
    const xs: number[] = [];
    if (stagger > 0) xs.push(stagger / 2);
    for (let x = stagger + 4; x <= L - 0.01; x += 8) xs.push(x);
    if ((L - stagger) % 8 > 0.01) xs.push(L - ((L - stagger) % 8) / 2);
    for (const xC of xs) {
      const wPanel = Math.min(8, 2 * Math.min(xC, L - xC));
      emit('subfloor', '4x8 panel', wPanel, [xC, -panelT / 2, zC], [-Math.PI / 2, 0, 0], 4, {
        actual: { w: 0.75, d: 48 },
        nailing: '8d @ 6" edges / 12" field (PH)',
        doctrineRef: 'FM 5-426 subfloor, staggered joints (PH page)',
      });
    }
  }

  return members;
}
