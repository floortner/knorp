/**
 * Shared de-AT date/time formatting for the portal, pinned to the app's civil timezone
 * (Europe/Berlin) — the same clock the backend buckets by (common/dates.ts) and ProgressPanel's
 * week strip/heatmap use. Formatting in the browser's local zone instead would place a session under
 * the wrong day for a trainer on a non-Berlin machine.
 */
const BERLIN = 'Europe/Berlin';
const dateFmt = new Intl.DateTimeFormat('de-AT', { timeZone: BERLIN });
const timeFmt = new Intl.DateTimeFormat('de-AT', { timeZone: BERLIN, hour: '2-digit', minute: '2-digit' });

/** A calendar date, or an em dash for null (e.g. never-active). */
export const deDate = (iso: string | null): string => (iso ? dateFmt.format(new Date(iso)) : '—');

/** Wall-clock time (HH:MM) of an instant, in Berlin civil time. */
export const deTime = (iso: string): string => timeFmt.format(new Date(iso));

/** Berlin civil-day heading for a timeline group: "Heute" / "Gestern" / the date. */
export function dayHeading(iso: string): string {
  const day = dateFmt.format(new Date(iso));
  if (day === dateFmt.format(new Date())) return 'Heute';
  if (day === dateFmt.format(new Date(Date.now() - 24 * 60 * 60 * 1000))) return 'Gestern';
  return day;
}
