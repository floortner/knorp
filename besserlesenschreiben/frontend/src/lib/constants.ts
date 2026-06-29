/** Total number of learning units in the app. Must match the backend's UNIT_CATALOG length. */
export const TOTAL_UNITS = 7;

/** Map buddy id → asset path; falls back to nepo. */
export function buddySrc(buddy: string): string {
  return ({ nepo: '/nepo.svg', stella: '/stella.svg' } as Record<string, string>)[buddy] ?? '/nepo.svg';
}
