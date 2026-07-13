/**
 * Static unit catalogue (titles, focus, theme colours, drilled exercise types, teaching intro). Server-owned,
 * the source for `GET /units`. Per-profile `status` and live `itemCount` are computed in the service — only
 * the editorial metadata lives here.
 *
 * The Vokaltraining progression (7 units) was dropped along with its word lists and training types — the
 * sequence is being redesigned from scratch. Empty until the new unit catalogue is authored.
 */
export interface UnitMeta {
  unit: number;
  title: string;
  subtitle: string;
  focus: string;
  exerciseTypes: string[];
  intro: string;
  theme: { iconBg: string; iconColor: string };
}

export const UNIT_CATALOG: readonly UnitMeta[] = [];

/** Per-profile unit status: unlocked-and-past = done, the unlocked edge = current, beyond = locked. */
export function unitStatus(unit: number, unlockedUnit: number): 'locked' | 'current' | 'done' {
  if (unit < unlockedUnit) return 'done';
  if (unit === unlockedUnit) return 'current';
  return 'locked';
}
