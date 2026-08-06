import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { deDate } from '@/lib/dates';
import type { StudentListItem } from '@/lib/contract';
import { useStudents } from './useStudents';

/**
 * The learner directory (ROADMAP §H1.3) — every student by name, for all trainers (known-trainer
 * model). An informational list, not a work queue: no badges, no urgency. Rows open the activity
 * detail (§H3.2).
 */
export function StudentsScreen() {
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useStudents();
  const students = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : students.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <GraduationCap className="mb-2 size-7" aria-hidden />
          <p>Noch keine Schüler.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-soft">
            {data?.pages[0]?.total ?? students.length} Schüler
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
            {students.map((s) => (
              <li key={s.profileId}>
                <StudentRow student={s} />
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="ghost" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StudentRow({ student }: { student: StudentListItem }) {
  return (
    <Link
      to={`/students/${encodeURIComponent(student.profileId)}`}
      className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02]"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {student.name} · <span className="text-ink-soft">Einheit {student.unit}</span>
        </p>
        {student.weakestSkills.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {student.weakestSkills.map((sk) => (
              <span
                key={sk.skill}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  sk.due ? 'bg-amber-tint text-amber' : 'bg-black/[0.04] text-ink-soft',
                )}
              >
                {sk.skill} {sk.correctPct}%
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="hidden shrink-0 text-right text-xs text-ink-soft sm:block">
        <p>Zuletzt aktiv {deDate(student.lastActive)}</p>
        <p>
          Sitzungen: {student.sessions7d} (7 T.) · {student.sessions30d} (30 T.)
        </p>
        <p>
          Serie {student.streakDays} {student.streakDays === 1 ? 'Tag' : 'Tage'} · {student.totalAttempts} Aufgaben
        </p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}
