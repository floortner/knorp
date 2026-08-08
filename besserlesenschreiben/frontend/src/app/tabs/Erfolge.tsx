import { Flame, Star } from 'lucide-react';
import { useActiveProfile } from '@/features/profile/useMe';
import { useProgress } from '@/features/progress/useProgress';
import { Heatmap, AchievementCard, WeekBars } from '@/features/progress/components';
import { ErrorRetry } from '@/app/components/ErrorRetry';

export function Erfolge() {
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);

  if (!profile || progress.isLoading) return <Note>Lädt …</Note>;
  if (progress.isError) return <ErrorRetry error={progress.error} onRetry={() => void progress.refetch()} />;
  const p = progress.data!;

  return (
    <div className="space-y-5">
      <AchievementCard league={p.league} />
      <div className="grid grid-cols-2 gap-3">
        {p.streakDays > 0 ? (
          <StreakStat streakDays={p.streakDays} jokerAvailable={p.jokerAvailable} />
        ) : (
          <WarmRestart />
        )}
        <Stat icon={<Star className="h-5 w-5 text-gold" />} value={p.stars} label="Sterne gesamt" />
      </div>
      <WeekBars weekly={p.weeklyActivity} />
      <Heatmap days={p.monthlyHeatmap} />
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-hairline">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-display text-2xl font-bold text-ink">{value}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{label}</p>
    </div>
  );
}

function StreakStat({ streakDays, jokerAvailable }: { streakDays: number; jokerAvailable: boolean }) {
  return (
    <div className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-hairline">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-orange" aria-hidden />
        <span className="font-display text-2xl font-bold text-ink">{streakDays}</span>
        {jokerAvailable && (
          <span className="text-gold" aria-hidden title="Joker verfügbar">◆</span>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-soft">Tage in Folge</p>
      {jokerAvailable && (
        <p className="mt-1 text-xs text-gold-text">1 Joker verfügbar</p>
      )}
    </div>
  );
}

function WarmRestart() {
  return (
    <div className="rounded-card bg-teal-tint/60 p-4">
      <p className="font-display text-lg font-bold text-teal-text">🌱</p>
      <p className="mt-1 text-sm font-medium text-ink">Heute neu starten!</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center font-medium text-ink-soft">{children}</p>;
}
