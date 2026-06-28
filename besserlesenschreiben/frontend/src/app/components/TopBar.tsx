import { Flame, Star } from 'lucide-react';
import { BMark } from '@/components/Logo';

/** Home top bar: who's playing + this profile's streak and total stars. */
export function TopBar({ name, streakDays, stars }: { name: string; streakDays: number; stars: number }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <BMark className="h-9 w-9" />
        <span className="font-display text-lg font-bold text-ink">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Pill icon={<Flame className="h-4 w-4 text-orange" aria-hidden />} value={streakDays} label="Tage in Folge" />
        <Pill icon={<Star className="h-4 w-4 text-amber-400" aria-hidden />} value={stars} label="Sterne" />
      </div>
    </header>
  );
}

function Pill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span
      className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ink shadow-sm ring-1 ring-black/5"
      aria-label={`${value} ${label}`}
    >
      {icon}
      {value}
    </span>
  );
}
