/** Total number of learning units in the app. Must match the backend's UNIT_CATALOG length. */
export const TOTAL_UNITS = 7;

/** Map buddy id → static asset path (no emotion); falls back to nepo. */
export function buddySrc(buddy: string): string {
  return ({ nepo: '/nepo.svg', stella: '/stella.svg' } as Record<string, string>)[buddy] ?? '/nepo.svg';
}

export type BuddyState = 'froehlich' | 'traurig' | 'ueberrascht' | 'cool';

/** Map buddy id + emotional state → monster-pets asset path. */
export function buddyStateSrc(buddy: string, state: BuddyState): string {
  const name = ({ nepo: 'nepo', stella: 'stella' } as Record<string, string>)[buddy] ?? 'nepo';
  return `/monster-pets/${name}-${state}.svg`;
}
