import { ArrowRight, Check, Lock } from 'lucide-react';
import type { Unit } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { unitIcon } from './unitIcon';

export function UnitCard({
  unit,
  onStart,
  starting,
}: {
  unit: Unit;
  onStart: (unit: number) => void;
  starting: boolean;
}) {
  const Icon = unitIcon(unit.unit);
  const isCurrent = unit.status === 'current';
  const isLocked = unit.status === 'locked';

  return (
    <article
      className={cn(
        'flex items-center gap-4 rounded-card p-4 shadow-sm ring-1 transition',
        isCurrent ? 'bg-white ring-orange/40' : 'bg-white/60 ring-black/5',
        isLocked && 'opacity-60',
      )}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: unit.theme.iconBg, color: unit.theme.iconColor }}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="font-display font-bold text-ink">{unit.title}</h3>
        <p className="truncate text-sm text-ink-soft">
          {isCurrent ? 'Bereit – jetzt üben!' : isLocked ? 'Noch gesperrt' : 'Abgeschlossen'}
        </p>
        {isCurrent && (
          <div className="mt-2 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
              <span className="block h-full w-0 bg-teal" />
            </span>
            <span className="text-xs text-ink-soft/70">0 / {unit.itemCount} Übungen</span>
          </div>
        )}
      </div>

      {isCurrent ? (
        <Button size="sm" onClick={() => onStart(unit.unit)} disabled={starting} aria-label={`${unit.title} üben`}>
          {starting ? '…' : 'Üben'} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.04] text-ink-soft/60">
          {isLocked ? <Lock className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4 text-teal" aria-hidden />}
        </span>
      )}
    </article>
  );
}
