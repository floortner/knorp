import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { SessionResponse } from '@/lib/types';
import { LessonRunner } from '@/features/exercises/LessonRunner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Button } from '@/components/ui/button';

/**
 * Lesson screen: takes the bank session handed over from /lernen and runs it through the renderers
 * + telemetry pipeline (M5). A deep-link/refresh without a session in nav state returns to the home tab.
 *
 * The runner is wrapped in its own ErrorBoundary: a single malformed exercise (or renderer throw)
 * drops back to a friendly card and lets the student leave the lesson, without blanking the whole app.
 */
export function LessonScreen() {
  const navigate = useNavigate();
  const session = (useLocation().state as { session?: SessionResponse } | null)?.session;

  if (!session) return <Navigate to="/app/lernen" replace />;

  return (
    <section className="pt-2">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => navigate('/app/lernen')}
          aria-label="Lektion verlassen"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm ring-1 ring-black/5"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ErrorBoundary
        fallback={() => (
          <div className="mt-10 flex flex-col items-center text-center">
            <div className="text-6xl" aria-hidden>
              🐙
            </div>
            <h2 className="font-display mt-4 text-xl font-bold text-ink">Diese Übung hat gehakt</h2>
            <p className="mt-2 max-w-xs text-ink-soft">Dein Fortschritt ist gespeichert. Such dir eine neue Übung aus!</p>
            <Button className="mt-8" size="lg" onClick={() => navigate('/app/lernen')}>
              Zurück zu den Übungen
            </Button>
          </div>
        )}
      >
        <LessonRunner session={session} />
      </ErrorBoundary>
    </section>
  );
}
