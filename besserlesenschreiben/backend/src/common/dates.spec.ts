import { describe, it, expect } from 'vitest';
import { startOfAppDay, appDayDiff, appDateKey, startOfAppWeek } from './dates';

// Civil day/week bucketing is Europe/Berlin (CEST = UTC+2 in June). 00:00 local June 25 is 22:00Z June 24.
describe('date helpers (Europe/Berlin civil days)', () => {
  it('startOfAppDay floors to local midnight', () => {
    expect(startOfAppDay(new Date('2026-06-25T13:45:00Z')).toISOString()).toBe('2026-06-24T22:00:00.000Z');
    // 23:15Z Mon = 01:15 local Tuesday → floors to Tuesday 00:00 local (22:00Z Mon).
    expect(startOfAppDay(new Date('2026-06-22T23:15:00Z')).toISOString()).toBe('2026-06-22T22:00:00.000Z');
  });

  it('appDayDiff counts whole local days', () => {
    // 23:15Z Mon = 01:15 local Tue, 12:00Z Tue = 14:00 local Tue → same local day → 0.
    expect(appDayDiff(new Date('2026-06-22T23:15:00Z'), new Date('2026-06-23T12:00:00Z'))).toBe(0);
    // 14:00 local Mon → 14:00 local Tue → 1.
    expect(appDayDiff(new Date('2026-06-22T12:00:00Z'), new Date('2026-06-23T12:00:00Z'))).toBe(1);
  });

  it('appDateKey returns the local YYYY-MM-DD key', () => {
    expect(appDateKey(new Date('2026-06-25T13:45:00Z'))).toBe('2026-06-25');
    expect(appDateKey(new Date('2026-06-22T23:15:00Z'))).toBe('2026-06-23'); // 01:15 local Tuesday
  });

  it('startOfAppWeek returns Monday 00:00 local', () => {
    // 2026-06-25 is a Thursday → week starts Monday 2026-06-22 (00:00 local = 22:00Z Sun 21st).
    expect(startOfAppWeek(new Date('2026-06-25T13:45:00Z')).toISOString()).toBe('2026-06-21T22:00:00.000Z');
    // Sunday belongs to the week that started the previous Monday.
    expect(startOfAppWeek(new Date('2026-06-28T10:00:00Z')).toISOString()).toBe('2026-06-21T22:00:00.000Z');
  });
});
