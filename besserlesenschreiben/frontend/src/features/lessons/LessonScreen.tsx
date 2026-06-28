import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { SessionResponse } from '@/lib/types';
import { LessonRunner } from '@/features/exercises/LessonRunner';

/**
 * Lesson screen: takes the bank session handed over from /lernen and runs it through the renderers
 * + telemetry pipeline (M5). A deep-link/refresh without a session in nav state returns to the home tab.
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
      <LessonRunner session={session} />
    </section>
  );
}
