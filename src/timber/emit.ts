// TIMBER-2 — the shared member emitter (plan §3.2, C-1/C-2/C-8).
//
// Every subsystem builds members through this, which buys three things uniformly instead of
// per-module:
//
//   C-2 stable ids   `<prefix>-<role>-<NN>`, counted per role within a prefix. The prefixes
//                    are reserved per scope (FL/S/N/E/W/RF for a building's story 0, L2-* for
//                    a second story, TW tower, PL platform…) so ids stay unique across a model
//                    however many subsystems contributed to it.
//   C-3 stage-agnostic  the emitter is TOLD its stage ordinal by the family generator. No
//                    subsystem knows that decking is stage 4 in a building and stage 3 on a
//                    platform — that is exactly the coupling the stage plan removed.
//   C-8 metadata     `grade`, `nailing` and `doctrineRef` are never optional. A member with no
//                    citation is a number with no provenance, which is the one thing this
//                    tool must not produce.

import type { Member, MemberRole, StageId } from './types';
import { DRESSED } from './types';
import { LUMBER, IN_PER_FT } from './doctrine';

export interface EmitOptions {
  /** Feet. Converted to the inches `Member.cutLength` carries. */
  cutLengthFt: number;
  position: [number, number, number];
  rotation: [number, number, number];
  stage: number;
  nailing: string;
  doctrineRef: string;
  actual?: { w: number; d: number };
  wall?: Member['wall'];
  grade?: string;
  angles?: Member['angles'];
}

export interface Emitter {
  (role: MemberRole, nominal: string, opts: EmitOptions): Member;
  readonly members: Member[];
  /** Sequential id the NEXT emit of this role would take (for cross-references). */
  peek(role: MemberRole): string;
}

export function makeEmitter(prefix: string, sink?: Member[]): Emitter {
  const members: Member[] = sink ?? [];
  const counters: Partial<Record<MemberRole, number>> = {};

  const idFor = (role: MemberRole, n: number): string => `${prefix}-${role}-${String(n).padStart(2, '0')}`;

  const emit = ((role: MemberRole, nominal: string, opts: EmitOptions): Member => {
    const n = (counters[role] = (counters[role] ?? 0) + 1);
    const member: Member = {
      id: idFor(role, n),
      role,
      nominal,
      // A nominal missing from DRESSED would render at 2x4 size and bill zero board-feet.
      // The dictionary test (I-14) asserts this fallback is unreachable in real output.
      actual: opts.actual ?? DRESSED[nominal] ?? DRESSED['2x4']!,
      cutLength: opts.cutLengthFt * IN_PER_FT,
      position: opts.position,
      rotation: opts.rotation,
      stage: opts.stage as StageId,
      grade: opts.grade ?? (LUMBER.defaultGrade.value as string),
      nailing: opts.nailing,
      doctrineRef: opts.doctrineRef,
      ...(opts.wall ? { wall: opts.wall } : {}),
      ...(opts.angles ? { angles: opts.angles } : {}),
    };
    members.push(member);
    return member;
  }) as Emitter;

  Object.defineProperty(emit, 'members', { get: () => members });
  (emit as { peek: (r: MemberRole) => string }).peek = (role) => idFor(role, (counters[role] ?? 0) + 1);
  return emit;
}
