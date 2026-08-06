import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FilterChips } from '@/components/ui/filter-chips';
import { Button } from '@/components/ui/button';
import { ProgressPanel } from '@/features/progress/ProgressPanel';
import { deDate, deTime, dayHeading } from '@/lib/dates';
import type { SessionSource, StudentAssignment, StudentSession } from '@/lib/contract';
import { ASSIGNMENT_LABEL, ASSIGNMENT_TONE } from '@/features/lectures/labels';
import { useStudent, useStudentAssignments, useStudentSessions } from './useStudents';
import { SOURCE_LABEL } from './labels';

type SourceFilter = SessionSource | 'all';

const FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'bank', label: 'Übungen' },
  { value: 'llm', label: 'KI-Übungen' },
  { value: 'homework', label: 'Hausübungen' },
  { value: 'assigned', label: 'Zugewiesen' },
];

const EMPTY: Record<SourceFilter, string> = {
  all: 'Noch keine Sitzungen.',
  bank: 'Noch keine Übungssitzungen.',
  llm: 'Noch keine KI-Übungen.',
  homework: 'Noch keine Hausübungen.',
  assigned: 'Noch keine zugewiesenen Übungen.',
};

/** The middle line of a session row: what happened, in calm factual terms. */
function sessionSummary(s: StudentSession): string {
  if (s.source === 'homework') return 'Hausübung geprüft';
  const items = `${s.itemsAnswered}/${s.itemsTotal} Aufgaben`;
  if (!s.completedAt) return items; // in progress / abandoned — no accuracy or duration yet
  // A completed session with no attempts has correctPct null: show items, not a misleading "0% richtig".
  const accuracy = s.correctPct !== null ? ` · ${s.correctPct}% richtig` : '';
  return `${items}${accuracy} · ${activeLabel(s.activeMs)}`;
}

/**
 * Engagement time (Σ attempt.timeMs), matching the session drill-down's "aktive Zeit" — NOT wall
 * clock, which would count a parked tab as an hour of practice.
 */
function activeLabel(activeMs: number): string {
  const mins = Math.round(activeMs / 60_000);
  return mins < 1 ? '< 1 Min. aktiv' : `${mins} Min. aktiv`;
}

/**
 * The student activity timeline (ROADMAP §H3.2): the ProgressPanel header plus every session,
 * newest-first, grouped by day, filterable by source. Calm and factual — an unfinished session is
 * information for the trainer's parent conversation, never a demerit ("never pressure at the student").
 */
export function StudentDetailScreen() {
  const { profileId = '' } = useParams();
  const [filter, setFilter] = useState<SourceFilter>('all');
  const student = useStudent(profileId);
  const assignments = useStudentAssignments(profileId);
  const sessions = useStudentSessions(profileId, filter === 'all' ? undefined : filter);
  const items = sessions.data?.pages.flatMap((p) => p.items) ?? [];

  // Group consecutive rows by civil day (already newest-first from the API).
  const groups: { label: string; sessions: StudentSession[] }[] = [];
  for (const s of items) {
    const label = dayHeading(s.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.sessions.push(s);
    else groups.push({ label, sessions: [s] });
  }

  return (
    <section>
      <Link to="/students" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Schüler
      </Link>

      {student.isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt …</p>
      ) : student.isError || !student.data ? (
        <p className="py-16 text-center text-danger">Schüler konnte nicht geladen werden.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h1 className="text-lg font-semibold text-ink">{student.data.name}</h1>
            <span className="text-sm text-ink-soft">Einheit {student.data.summary.unit}</span>
          </div>

          <div className="mb-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
            <ProgressPanel data={student.data} />
          </div>

          {/* All assignments incl. never-started OPEN ones — the timeline below only shows played sessions. */}
          <h2 className="mb-2 font-semibold text-ink">Zuweisungen</h2>
          {assignments.isPending ? (
            <p className="mb-6 text-sm text-ink-soft">Lädt …</p>
          ) : assignments.isError ? (
            <p className="mb-6 text-sm text-danger">Zuweisungen konnten nicht geladen werden.</p>
          ) : assignments.data.items.length === 0 ? (
            <p className="mb-6 text-sm text-ink-soft">Keine Zuweisungen.</p>
          ) : (
            <ul className="mb-6 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
              {assignments.data.items.map((a) => (
                <li key={a.assignmentId}>
                  <AssignmentRow profileId={profileId} assignment={a} />
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 font-semibold text-ink">Aktivität</h2>
          <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Nach Quelle filtern" />

          {sessions.isPending ? (
            <p className="py-10 text-center text-ink-soft">Lädt …</p>
          ) : sessions.isError ? (
            <p className="py-10 text-center text-danger">Sitzungen konnten nicht geladen werden.</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-ink-soft">{EMPTY[filter]}</p>
          ) : (
            <>
              {groups.map((g) => (
                <div key={g.label} className="mb-4">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{g.label}</h3>
                  <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
                    {g.sessions.map((s) => (
                      <li key={s.sessionId}>
                        <SessionRow profileId={profileId} session={s} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {sessions.hasNextPage && (
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    onClick={() => void sessions.fetchNextPage()}
                    disabled={sessions.isFetchingNextPage}
                  >
                    {sessions.isFetchingNextPage ? 'Lädt …' : 'Mehr laden'}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function AssignmentRow({ profileId, assignment: a }: { profileId: string; assignment: StudentAssignment }) {
  const outcome =
    a.status === 'completed' && a.correctPct !== null ? ` · ${a.correctPct}% richtig` : '';
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/lectures/${encodeURIComponent(a.lectureId)}`} className="font-medium text-ink hover:underline">
          {a.title}
        </Link>
        <p className="text-sm text-ink-soft">
          Version {a.version} · zugewiesen am {deDate(a.assignedAt)}
          {outcome}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', ASSIGNMENT_TONE[a.status])}>
        {ASSIGNMENT_LABEL[a.status]}
      </span>
      {a.sessionId && (
        <Link
          to={`/students/${encodeURIComponent(profileId)}/sessions/${encodeURIComponent(a.sessionId)}`}
          aria-label="Zur Sitzung"
          className="shrink-0 text-ink-soft transition hover:text-ink"
        >
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function SessionRow({ profileId, session: s }: { profileId: string; session: StudentSession }) {
  const inner = (
    <>
      <time className="w-12 shrink-0 text-sm text-ink-soft" dateTime={s.startedAt}>
        {deTime(s.startedAt)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{SOURCE_LABEL[s.source] ?? s.source}</p>
        <p className="text-sm text-ink-soft">{sessionSummary(s)}</p>
      </div>
      {s.abandoned && (
        // Deliberately neutral (not amber/danger): factual context, never pressure at the student.
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-ink-soft">
          nicht abgeschlossen
        </span>
      )}
      {s.attemptCount > 0 && <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />}
    </>
  );

  const row = 'flex items-center gap-4 px-5 py-3';
  if (s.attemptCount === 0) return <div className={row}>{inner}</div>;
  return (
    <Link
      to={`/students/${encodeURIComponent(profileId)}/sessions/${encodeURIComponent(s.sessionId)}`}
      className={cn(row, 'transition hover:bg-black/[0.02]')}
    >
      {inner}
    </Link>
  );
}
