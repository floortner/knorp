import { Flame, Star } from 'lucide-react';
import { BMark } from '@/components/Logo';

/** Home top bar: who's playing + this profile's streak and total stars. */
export function TopBar({
  name,
  streakDays,
  stars,
  jokerAvailable,
}: {
  name: string;
  streakDays: number;
  stars: number;
  jokerAvailable: boolean;
}) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BMark className="h-9 w-9" />
        <span className="font-display text-lg font-bold text-ink">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {streakDays > 0 && (
          <StreakPill streakDays={streakDays} jokerAvailable={jokerAvailable} />
        )}
        <Pill icon={<Star className="h-4 w-4 text-gold" aria-hidden />} value={stars} label="Sterne" />
      </div>
    </header>
  );
}

function StreakPill({ streakDays, jokerAvailable }: { streakDays: number; jokerAvailable: boolean }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-ink shadow-sm ring-1 ring-hairline"
      aria-label={`${streakDays} Tage in Folge${jokerAvailable ? ', Joker verfügbar' : ''}`}
    >
      <Flame className="h-4 w-4 text-orange" aria-hidden />
      {streakDays}
      {jokerAvailable && (
        <span className="text-gold" aria-hidden title="Joker verfügbar">◆</span>
      )}
    </span>
  );
}

function Pill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-ink shadow-sm ring-1 ring-hairline"
      aria-label={`${value} ${label}`}
    >
      {icon}
      {value}
    </span>
  );
}
