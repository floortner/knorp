import { describe, it, expect } from 'vitest';
import { startOfUtcDay, utcDayDiff, utcDateKey, startOfUtcWeek } from './dates';

describe('date helpers', () => {
  it('startOfUtcDay floors to midnight UTC', () => {
    expect(startOfUtcDay(new Date('2026-06-25T13:45:00Z')).toISOString()).toBe('2026-06-25T00:00:00.000Z');
  });

  it('utcDayDiff counts whole days (yesterday→today = 1)', () => {
    expect(utcDayDiff(new Date('2026-06-24T23:00:00Z'), new Date('2026-06-25T01:00:00Z'))).toBe(1);
    expect(utcDayDiff(new Date('2026-06-25T01:00:00Z'), new Date('2026-06-25T23:00:00Z'))).toBe(0);
  });

  it('utcDateKey returns a YYYY-MM-DD key', () => {
    expect(utcDateKey(new Date('2026-06-25T13:45:00Z'))).toBe('2026-06-25');
  });

  it('startOfUtcWeek returns Monday 00:00 UTC', () => {
    // 2026-06-25 is a Thursday → week starts Monday 2026-06-22
    expect(startOfUtcWeek(new Date('2026-06-25T13:45:00Z')).toISOString()).toBe('2026-06-22T00:00:00.000Z');
    // Sunday belongs to the week that started the previous Monday
    expect(startOfUtcWeek(new Date('2026-06-28T10:00:00Z')).toISOString()).toBe('2026-06-22T00:00:00.000Z');
  });
});
