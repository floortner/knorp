/**
 * Date helpers for FSRS scheduling and progress windows.
 *
 * Civil-day/week bucketing (streak, daily caps, the Mo–So week strip, the "diese Woche" ring, the
 * heatmap, the joker week) is done in the app's fixed timezone **Europe/Berlin**, NOT UTC. The product
 * is single-region (German children, hosted in Frankfurt), so "today" must mean the child's local day:
 * a session at 01:15 local Tuesday is Tuesday, even though it is still Monday in UTC. Bucketing in UTC
 * mis-credited such early-morning sessions to the previous day (the week strip showed Mo done / Di todo).
 *
 * `daysAgo` stays a pure rolling N×24h window (timezone-independent) — it only bounds range queries.
 */

const DAY_MS = 86_400_000;
const APP_TZ = 'Europe/Berlin';

/** Wall-clock calendar parts of instant `d` in APP_TZ. */
function appParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(d)) if (part.type !== 'literal') p[part.type] = part.value;
  const hour = Number(p.hour) % 24; // some ICU builds emit '24' for midnight
  return { year: +p.year, month: +p.month, day: +p.day, hour, minute: +p.minute, second: +p.second };
}

/** APP_TZ offset in ms (east of UTC) at instant `d`, i.e. wall-clock-as-UTC − `d`. */
function appOffsetMs(d: Date): number {
  const p = appParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (d.getTime() - d.getMilliseconds());
}

/** Midnight (00:00 local) of the APP_TZ day containing `d`, as the corresponding UTC instant. */
export function startOfAppDay(d: Date): Date {
  const p = appParts(d);
  const wallMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  // Convert wall-clock midnight to a real instant, then correct once for the DST-transition edge
  // (the offset at midnight can differ from the offset at `d`).
  const inst = wallMidnightAsUtc - appOffsetMs(d);
  return new Date(wallMidnightAsUtc - appOffsetMs(new Date(inst)));
}

/** A Date `n` days before `now` (exact 24h multiples; used for "last N days" range queries). */
export function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * DAY_MS);
}

/** Whole civil-day difference `b − a` in APP_TZ (e.g. yesterday→today = 1); DST-safe. */
export function appDayDiff(a: Date, b: Date): number {
  const pa = appParts(a);
  const pb = appParts(b);
  const da = Date.UTC(pa.year, pa.month - 1, pa.day);
  const db = Date.UTC(pb.year, pb.month - 1, pb.day);
  return Math.round((db - da) / DAY_MS);
}

/** `YYYY-MM-DD` key for the APP_TZ civil day of `d` (heatmap buckets). */
export function appDateKey(d: Date): string {
  const p = appParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Monday 00:00 (local) of the ISO week containing `now`, in APP_TZ, as a UTC instant. */
export function startOfAppWeek(now: Date): Date {
  const p = appParts(now);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // Sun=0 … Sat=6 for the civil date
  const mondayOffset = (dow + 6) % 7; // Mon=0 … Sun=6
  // Noon UTC of the civil Monday sits safely inside that Berlin day regardless of DST → floor it.
  return startOfAppDay(new Date(Date.UTC(p.year, p.month - 1, p.day - mondayOffset, 12)));
}
