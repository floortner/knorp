import { cn } from '@/lib/cn';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Weekday strip with today highlighted. Per-day activity/streak marks arrive with progress (M6) —
 * until then this only marks today, rather than faking completion (golden rule 4).
 */
export function WeekStrip() {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  return (
    <ul className="flex justify-between" aria-label="Diese Woche">
      {DAYS.map((day, i) => (
        <li key={day} className="flex flex-col items-center gap-1">
          <span className="text-xs text-ink-soft/70">{day}</span>
          <span
            aria-current={i === todayIdx ? 'date' : undefined}
            className={cn(
              'h-7 w-7 rounded-full',
              i === todayIdx ? 'bg-orange ring-2 ring-orange/30' : 'bg-black/[0.06]',
            )}
          />
        </li>
      ))}
    </ul>
  );
}
