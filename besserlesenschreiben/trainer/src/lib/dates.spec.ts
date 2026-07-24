import { describe, it, expect } from 'vitest';
import { deDate, deTime } from './dates';

describe('date formatting (Europe/Berlin, not browser-local)', () => {
  // 23:30Z in July (CEST, UTC+2) is 01:30 the NEXT civil day in Berlin. A browser-local formatter on
  // any zone west of Berlin would show the 25th; the app must agree with the backend's Berlin bucketing.
  it('buckets an instant by the Berlin civil day regardless of the runner timezone', () => {
    expect(deDate('2026-07-25T23:30:00.000Z')).toMatch(/^26\./); // 26th in Berlin, not the 25th
  });

  it('formats the wall-clock time in Berlin', () => {
    expect(deTime('2026-07-25T23:30:00.000Z')).toBe('01:30');
  });

  it('renders null dates as an em dash', () => {
    expect(deDate(null)).toBe('—');
  });
});
