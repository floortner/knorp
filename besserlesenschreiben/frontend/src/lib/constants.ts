/** Total number of learning units in the app. Must match the backend's UNIT_CATALOG length. */
export const TOTAL_UNITS = 7;

/**
 * All selectable buddies (monster-pets mascots — 4 emotional states each in /monster-pets/).
 * Ids must match the backend's buddy enum (profiles.dto.ts). Nepo + Stella lead (the original pair).
 */
export const BUDDIES = [
  { id: 'nepo', name: 'Nepo' },
  { id: 'stella', name: 'Stella' },
  { id: 'charly', name: 'Charly' },
  { id: 'echo', name: 'Echo' },
  { id: 'inky', name: 'Inky' },
  { id: 'jax', name: 'Jax' },
  { id: 'junior', name: 'Junior' },
  { id: 'li', name: 'Li' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'puff', name: 'Puff' },
  { id: 'rudolph', name: 'Rudolph' },
  { id: 'theo', name: 'Theo' },
] as const;

export type BuddyId = (typeof BUDDIES)[number]['id'];

const KNOWN = new Set<string>(BUDDIES.map((b) => b.id));

/** Buddy id → default (neutral/happy) asset. Root svgs where they exist, else the fröhlich state. */
export function buddySrc(buddy: string): string {
  const root: Record<string, string> = { nepo: '/nepo.svg', stella: '/stella.svg', pixel: '/pixel.svg' };
  if (root[buddy]) return root[buddy];
  return KNOWN.has(buddy) ? `/monster-pets/${buddy}-froehlich.svg` : '/nepo.svg';
}

export type BuddyState = 'froehlich' | 'traurig' | 'ueberrascht' | 'cool';

/** Map buddy id + emotional state → monster-pets asset path. */
export function buddyStateSrc(buddy: string, state: BuddyState): string {
  const name = KNOWN.has(buddy) ? buddy : 'nepo';
  return `/monster-pets/${name}-${state}.svg`;
}
