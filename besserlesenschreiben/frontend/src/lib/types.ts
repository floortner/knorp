/**
 * Wire types mirroring `../backend/SPEC.md §6`. Hand-written stopgap until `npm run gen:api`
 * generates them from the backend OpenAPI — keep in lockstep with the contract (AGENTS rule 1).
 */

export interface Profile {
  id: string;
  name: string;
  buddy: string;
  goalPerWeek: number;
  soundOn: boolean;
  dyslexicFont: boolean;
  fontScale: number;
  stars: number;
  streakDays: number;
  unlockedUnit: number;
  createdAt: string;
}

export interface Me {
  account: { id: string; email: string };
  profiles: Profile[];
}

export type UnitStatus = 'locked' | 'current' | 'done';

export interface Unit {
  unit: number;
  title: string;
  subtitle: string;
  focus: string;
  exerciseTypes: string[];
  itemCount: number;
  status: UnitStatus;
  theme: { iconBg: string; iconColor: string };
}

/** A served exercise. Fully typed as the discriminated union when the renderers land (M5). */
export interface SessionItem {
  id: string;
  type: string;
  skillTags: string[];
  audioUrl: string | null;
  [field: string]: unknown;
}

export interface SessionResponse {
  sessionId: string;
  profileId: string;
  unit: number;
  generatedAt: string;
  items: SessionItem[];
}
