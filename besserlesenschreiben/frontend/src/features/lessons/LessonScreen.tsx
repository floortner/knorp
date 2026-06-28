import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { SessionResponse } from '@/lib/types';
import { Button } from '@/components/ui/button';

/**
 * Lesson runner placeholder (milestone 3 ends at "session fetch"). Confirms a bank session was
 * generated and handed over; the 12 exercise renderers + telemetry land in milestones 4–5.
 */
export function LessonScreen() {
  const navigate = useNavigate();
  const session = (useLocation().state as { session?: SessionResponse } | null)?.session;

  // Deep-linked or refreshed without a session in nav state → back to the home tab.
  if (!session) return <Navigate to="/app/lernen" replace />;

  return (
    <section className="space-y-6 py-4">
      <Button variant="link" className="px-0" onClick={() => navigate('/app/lernen')}>
        <ArrowLeft className="h-4 w-4" aria-hidden /> Zurück
      </Button>

      <div className="flex flex-col items-center gap-3 rounded-card bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-tint text-teal-dark">
          <Sparkles className="h-7 w-7" aria-hidden />
        </span>
        <p className="font-display text-xl font-bold text-ink">Einheit {session.unit} bereit</p>
        <p className="text-ink-soft">
          {session.items.length} Übungen geladen — die Übungen folgen in Meilenstein 5.
        </p>
      </div>
    </section>
  );
}
