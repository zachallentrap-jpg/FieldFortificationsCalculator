// TIMBER-1 engine — cut list / BOM / labor projections of Member[] (design doc §5).
// Nothing here re-measures geometry: every number is an aggregation over the same members the
// 3D scene draws, so the scene and the paperwork can never disagree.

import type { Member, StageId } from './types';
import { STAGES } from './types';

// Nominal section board-feet per lineal foot (nominal w×d ÷ 12).
const BF_PER_LF: Record<string, number> = {
  '2x4': (2 * 4) / 12,
  '2x6': (2 * 6) / 12,
  '2x8': (2 * 8) / 12,
  '2x10': (2 * 10) / 12,
  '2x12': (2 * 12) / 12,
  '4x4': (4 * 4) / 12,
};

export interface CutLine {
  nominal: string;
  cutLengthIn: number; // rounded to 1/8"
  count: number;
  roles: string[]; // e.g. ["stud", "cripple"]
  memberIds: string[]; // BOM ↔ 3D linkage (design doc §4.1)
  boardFeet: number; // 0 for panels
}

export interface StageBom {
  stage: StageId;
  name: string;
  lines: CutLine[];
  boardFeet: number;
  panels: number;
  memberCount: number;
  manHours: number;
}

export interface BomSummary {
  stages: StageBom[]; // only stages that have members, in build order
  totalBoardFeet: number;
  totalPanels: number;
  totalMembers: number;
  totalManHours: number;
}

// Placeholder labor rates, man-hours per board-foot equivalent (FM 5-426 Table C-1 pending
// verification — design doc §8 keeps these DOCTRINE-UNVERIFIED and visibly footnoted).
const MH_PER_BF = 0.055; // (PH)
const MH_PER_PANEL = 0.5; // (PH)

const eighth = (inches: number): number => Math.round(inches * 8) / 8;

export function boardFeet(m: Member): number {
  const perLf = BF_PER_LF[m.nominal];
  return perLf ? (m.cutLength / 12) * perLf : 0;
}

export function cutList(members: Member[]): CutLine[] {
  const byKey = new Map<string, CutLine>();
  for (const m of members) {
    const len = eighth(m.cutLength);
    const key = `${m.nominal}|${len}`;
    let line = byKey.get(key);
    if (!line) {
      line = { nominal: m.nominal, cutLengthIn: len, count: 0, roles: [], memberIds: [], boardFeet: 0 };
      byKey.set(key, line);
    }
    line.count += 1;
    line.memberIds.push(m.id);
    if (!line.roles.includes(m.role)) line.roles.push(m.role);
    line.boardFeet += boardFeet(m);
  }
  return [...byKey.values()].sort(
    (a, b) => a.nominal.localeCompare(b.nominal) || b.cutLengthIn - a.cutLengthIn,
  );
}

export function bomSummary(members: Member[]): BomSummary {
  const stages: StageBom[] = [];
  for (const s of STAGES) {
    const ofStage = members.filter((m) => m.stage === s.id);
    if (ofStage.length === 0) continue;
    const lines = cutList(ofStage);
    const bf = lines.reduce((a, l) => a + l.boardFeet, 0);
    const panels = ofStage.filter((m) => m.nominal.includes('panel')).length;
    stages.push({
      stage: s.id,
      name: s.name,
      lines,
      boardFeet: bf,
      panels,
      memberCount: ofStage.length,
      manHours: bf * MH_PER_BF + panels * MH_PER_PANEL,
    });
  }
  return {
    stages,
    totalBoardFeet: stages.reduce((a, s) => a + s.boardFeet, 0),
    totalPanels: stages.reduce((a, s) => a + s.panels, 0),
    totalMembers: stages.reduce((a, s) => a + s.memberCount, 0),
    totalManHours: stages.reduce((a, s) => a + s.manHours, 0),
  };
}
