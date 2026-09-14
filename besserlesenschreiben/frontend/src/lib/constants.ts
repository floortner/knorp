/**
 * Freely selectable learn buddies (monster mascots from Planet Knorp — base figure + 4 emotional states
 * each, served from /monster-pets/; master source art + catalog live at repo-root `assets/` — see
 * `assets/manifest.json`). Ids must match the backend's buddy enum (profiles.dto.ts). Array order is
 * the CI's canonical monster order (drives the picker grids in onboarding + Profil); Nepo + Stella lead.
 */
export const BUDDIES = [
  { id: 'nepo', name: 'Nepo' },
  { id: 'stella', name: 'Stella' },
  { id: 'junior', name: 'Junior' },
  { id: 'jax', name: 'Jax' },
  { id: 'li', name: 'Li' },
  { id: 'charly', name: 'Charly' },
  { id: 'bruno', name: 'Bruno' },
  { id: 'greta', name: 'Greta' },
] as const;

/**
 * REWARD pets — earned by completing tasks, NOT freely selectable (the backend buddy enum rejects
 * them) and not yet shown anywhere in the UI: the earn mechanic and their locked-picker slots land
 * with the D5 badges milestone. Pets have a base figure + `jubel`/`schlaf` POSES (no emotional
 * states), so they render via their base asset. The assets-v2 brand package also pairs each pet
 * with a buddy as its "Begleiter" (Nepo+Bo, Stella+Axi, Junior+Leo, Jax+Echo — `assets/manifest.json`),
 * a D5 hook that isn't wired up yet.
 */
export const REWARD_PETS = [
  { id: 'bo', name: 'Bo' },
  { id: 'axi', name: 'Axi' },
  { id: 'leo', name: 'Leo' },
  { id: 'echo', name: 'Echo' },
] as const;

export type BuddyId = (typeof BUDDIES)[number]['id'];

const BUDDY_IDS = new Set<string>(BUDDIES.map((b) => b.id));
const PET_IDS = new Set<string>(REWARD_PETS.map((p) => p.id));
const KNOWN = new Set<string>([...BUDDY_IDS, ...PET_IDS]);

/** Buddy/pet id → base (neutral) figure. Unknown ids (e.g. a retired buddy on an old profile) → Nepo. */
export function buddySrc(buddy: string): string {
  return KNOWN.has(buddy) ? `/monster-pets/${buddy}.svg` : '/nepo.svg';
}

export type BuddyState = 'froehlich' | 'traurig' | 'ueberrascht' | 'cool';

/**
 * Map buddy id + emotional state → asset path. Buddies have the 4 mood variants; pets have only poses,
 * so they fall back to their base figure. Unknown ids fall back to Nepo (keeps a retired buddy from 404ing).
 */
export function buddyStateSrc(buddy: string, state: BuddyState): string {
  if (BUDDY_IDS.has(buddy)) return `/monster-pets/${buddy}-${state}.svg`;
  if (PET_IDS.has(buddy)) return `/monster-pets/${buddy}.svg`;
  return `/monster-pets/nepo-${state}.svg`;
}

/** Weekly practice-goal presets — shared by onboarding (first pick) and /profil (editing). */
export const GOALS = [
  { value: 3, label: '3× pro Woche', hint: 'locker' },
  { value: 5, label: '5× pro Woche', hint: 'normal' },
  { value: 7, label: '7× pro Woche', hint: 'sportlich' },
] as const;
