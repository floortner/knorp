import { Flame, Star } from 'lucide-react';
import { useActiveProfile } from '@/features/profile/useMe';
import { useProgress } from '@/features/progress/useProgress';
import { Heatmap, LeagueCard, WeekBars } from '@/features/progress/components';
import { ErrorRetry } from '@/app/components/ErrorRetry';

export function Liga() {
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);

  if (!profile || progress.isLoading) return <Note>Lädt …</Note>;
  if (progress.isError) return <ErrorRetry error={progress.error} onRetry={() => void progress.refetch()} />;
  const p = progress.data!;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold text-ink">Liga</h1>
      <LeagueCard league={p.league} />
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Flame className="h-5 w-5 text-orange" />} value={p.streakDays} label="Tage in Folge" />
        <Stat icon={<Star className="h-5 w-5 text-amber-400" />} value={p.stars} label="Sterne gesamt" />
      </div>
      <WeekBars weekly={p.weeklyActivity} />
      <Heatmap days={p.monthlyHeatmap} />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-display text-2xl font-bold text-ink">{value}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center font-medium text-ink-soft">{children}</p>;
}
