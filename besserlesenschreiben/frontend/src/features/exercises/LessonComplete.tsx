import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { SessionComplete } from '@/lib/types';
import { Button } from '@/components/ui/button';

const LEAGUE_LABEL: Record<string, string> = { bronze: 'Bronze', silber: 'Silber', gold: 'Gold' };

/** Reward screen shown when every item in a session is solved (SPEC §3 — fanfare on complete). */
export function LessonComplete({ result, pending }: { result?: SessionComplete; pending: boolean }) {
  const navigate = useNavigate();

  return (
    <section className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="text-6xl" role="img" aria-label="Geschafft">
        🎉
      </div>
      <img src="/nepo.svg" alt="" className="h-24" />
      <h1 className="font-display text-2xl font-bold text-ink">Geschafft!</h1>

      {pending && <p className="text-ink-soft">Sterne werden gezählt …</p>}

      {result && (
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center justify-center gap-2 rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
            <Star className="h-6 w-6 text-amber-400" aria-hidden />
            <span className="font-display text-xl font-bold text-ink">+{result.starsAwarded} Sterne</span>
          </div>
          <p className="text-ink-soft">
            {result.streakDays} {result.streakDays === 1 ? 'Tag' : 'Tage'} in Folge ·{' '}
            {LEAGUE_LABEL[result.league.tier] ?? result.league.tier}-Liga
          </p>
        </div>
      )}

      <Button size="lg" className="mt-2 max-w-xs" onClick={() => navigate('/app/lernen')}>
        Weiter
      </Button>
    </section>
  );
}
