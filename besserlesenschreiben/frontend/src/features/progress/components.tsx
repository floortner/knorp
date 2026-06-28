import type { Progress } from '@/lib/types';
import { cn } from '@/lib/cn';

type League = Progress['league'];
type Skill = Progress['skillBreakdown'][number];

const TIER_LABEL: Record<string, string> = { bronze: 'Bronze', silber: 'Silber', gold: 'Gold' };
const NEXT_TIER: Record<string, string | undefined> = { bronze: 'Silber', silber: 'Gold', gold: undefined };
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** League standing: current tier + progress toward the next (SPEC §2 /liga). */
export function LeagueCard({ league }: { league: League }) {
  const next = NEXT_TIER[league.tier];
  return (
    <div className="rounded-card bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
      <p className="text-sm text-ink-soft">Deine Liga</p>
      <p className="mt-1 font-display text-2xl font-bold text-amber-500">
        {TIER_LABEL[league.tier] ?? league.tier}-Liga
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        {league.starsWeek} Sterne diese Woche
        {next && league.starsToNext > 0 && ` · noch ${league.starsToNext} bis zur ${next}-Liga`}
      </p>
    </div>
  );
}

/** Stars/attempts per day over the rolling last 7 days (index 6 = today). */
export function WeekBars({ weekly }: { weekly: number[] }) {
  const max = Math.max(1, ...weekly);
  const now = new Date();
  return (
    <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 text-sm font-semibold text-ink">Diese Woche</p>
      <div className="flex items-end justify-between gap-2" style={{ height: 88 }}>
        {weekly.map((count, i) => {
          const d = new Date(now);
          d.setDate(now.getDate() - (weekly.length - 1 - i));
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span
                className={cn('w-full rounded-md', count > 0 ? 'bg-teal' : 'bg-black/[0.06]')}
                style={{ height: `${Math.max(6, (count / max) * 64)}px` }}
                title={`${count}`}
              />
              <span className="text-[10px] text-ink-soft/70">{WEEKDAYS[d.getDay()]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 30-day activity heatmap (oldest first). */
export function Heatmap({ days }: { days: Progress['monthlyHeatmap'] }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="mb-3 text-sm font-semibold text-ink">Letzte 30 Tage</p>
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <span
            key={d.date}
            title={`${d.date}: ${d.count}`}
            className={cn('aspect-square rounded-[4px]', heatColor(d.count))}
          />
        ))}
      </div>
    </div>
  );
}

function heatColor(count: number): string {
  if (count <= 0) return 'bg-black/[0.06]';
  if (count <= 2) return 'bg-teal/30';
  if (count <= 4) return 'bg-teal/60';
  return 'bg-teal';
}

/** Per-skill mastery rows, weakest first (already sorted by the backend). */
export function SkillBreakdown({ skills }: { skills: Skill[] }) {
  if (skills.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-soft">Noch keine Übungsdaten.</p>;
  }
  return (
    <div className="space-y-3">
      {skills.map((s) => (
        <div key={s.skill} className="rounded-card bg-white p-3 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-ink">{s.skill}</span>
            <span className="flex items-center gap-2 text-sm text-ink-soft">
              {s.due && <span className="rounded-full bg-orange/15 px-2 py-0.5 text-xs text-orange-dark">fällig</span>}
              {s.correctPct}%
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <span className="block h-full rounded-full bg-teal" style={{ width: `${s.correctPct}%` }} />
            </span>
            <span className="text-xs text-ink-soft/70">{s.attempts}×</span>
          </div>
        </div>
      ))}
    </div>
  );
}
