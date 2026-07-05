import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Weekday strip. When `activity` is provided (Mon=0 … Sun=6 session counts), done days show a teal check. */
export function WeekStrip({ activity }: { activity?: number[] }) {
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  return (
    <ul className="flex justify-between" aria-label="Diese Woche">
      {DAYS.map((day, i) => {
        const done = activity ? (activity[i] ?? 0) > 0 : false;
        const isToday = i === todayIdx;
        return (
          <li key={day} className="flex flex-col items-center gap-1">
            <span className="text-xs text-ink-soft/70">{day}</span>
            <span
              aria-current={isToday ? 'date' : undefined}
              aria-label={done ? `${day}: geübt` : undefined}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full',
                done ? 'bg-teal text-white' : isToday ? 'bg-orange ring-2 ring-orange/30' : 'bg-black/[0.06]',
              )}
            >
              {done && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
