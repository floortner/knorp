import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { cn } from '@/lib/cn';
import { deDate } from '@/lib/dates';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import type { AssignmentStatus, LectureAssignment } from '@/lib/contract';
import { useLecture, useLectureAssignments, useLectureMutations } from './useLectures';
import { AssignDialog } from './AssignDialog';
import { ASSIGNMENT_LABEL, STATUS_LABEL } from './labels';

type AssignmentFilter = AssignmentStatus | 'all';

const FILTERS: { value: AssignmentFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Offen' },
  { value: 'started', label: 'Begonnen' },
  { value: 'completed', label: 'Erledigt' },
];

const STATUS_TONE: Record<AssignmentStatus, string> = {
  open: 'bg-black/[0.04] text-ink-soft',
  started: 'bg-teal-tint text-teal-dark',
  completed: 'bg-good-tint text-good',
};

/**
 * One lecture from the content library (ROADMAP §H1/§I3): the Merksatz + items read-only (exactly
 * what the student sees), the assign action, and the per-student assignment table with outcome
 * rollups across all versions (§H3.4 — abandoned/never-started visible, calmly, never as
 * "overdue"). Completed rows link to the per-session drill-down. Editing happens in the repo's
 * content/ directory, not here; drafts (status: draft in the file) are visible but unassignable.
 */
export function LectureDetailScreen() {
  const { lectureId = '' } = useParams();
  const lecture = useLecture(lectureId);
  const assignments = useLectureAssignments(lectureId);
  const { withdraw } = useLectureMutations(lectureId);
  const [assignOpen, setAssignOpen] = useState(false);
  const [filter, setFilter] = useState<AssignmentFilter>('all');

  if (lecture.isPending) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;
  if (lecture.isError || !lecture.data) {
    return (
      <div className="py-16 text-center text-ink-soft">
        <p>Diese Lektion wurde nicht gefunden.</p>
        <Link to="/lectures" className="mt-2 inline-block text-teal-dark hover:underline">
          Zurück zu den Lektionen
        </Link>
      </div>
    );
  }

  const l = lecture.data;
  const isDraft = l.status === 'draft';
  const rows = (assignments.data?.items ?? []).filter((a) => filter === 'all' || a.status === filter);

  return (
    <section>
      <Link to="/lectures" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lektionen
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-ink">{l.title}</h1>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            isDraft ? 'bg-black/[0.04] text-ink-soft' : 'bg-good-tint text-good',
          )}
        >
          {STATUS_LABEL[l.status]}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Version {l.version} · aus der Content-Bibliothek · {l.itemCount}{' '}
        {l.itemCount === 1 ? 'Aufgabe' : 'Aufgaben'} · zuletzt geändert {deDate(l.updatedAt)}
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => setAssignOpen(true)} disabled={isDraft}>
          <Send className="size-4" aria-hidden /> Zuweisen
        </Button>
        {isDraft && (
          <p className="text-sm text-ink-soft">
            Entwurf — in der Datei auf <code>status: published</code> setzen, um zuweisen zu können.
          </p>
        )}
      </div>

      {withdraw.error instanceof ApiError && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {withdraw.error.message}
        </p>
      )}

      {/* The Merksatz + read-only items — what the student will see. */}
      <div className="mb-6 rounded-card bg-teal-tint/50 p-4 text-sm text-ink">
        <p className="font-medium">{l.intro}</p>
      </div>
      <ol className="mb-8 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
        {l.items.map((it, i) => (
          <li key={it.id} className="flex gap-4 px-5 py-3">
            <span className="w-6 shrink-0 pt-0.5 text-sm text-ink-soft">{i + 1}.</span>
            <div>
              <p className="font-medium text-ink">{it.prompt}</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {it.options.map((o) => (
                  <span
                    key={o}
                    className={cn(
                      'rounded px-2 py-0.5 text-sm',
                      o === it.answer ? 'bg-good-tint font-medium text-good' : 'bg-black/[0.04] text-ink-soft',
                    )}
                  >
                    {o}
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mb-2 font-semibold text-ink">Zuweisungen</h2>
      <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Nach Status filtern" />

      {assignments.isPending ? (
        <p className="py-8 text-center text-ink-soft">Lädt …</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-ink-soft">
          {filter === 'all' ? 'Noch niemandem zugewiesen.' : 'Keine Zuweisungen mit diesem Status.'}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          {rows.map((a) => (
            <li key={a.assignmentId}>
              <AssignmentRow
                assignment={a}
                withdrawing={withdraw.isPending}
                onWithdraw={(id) => withdraw.mutate(id)}
              />
            </li>
          ))}
        </ul>
      )}

      {assignOpen && <AssignDialog lectureId={lectureId} onClose={() => setAssignOpen(false)} />}
    </section>
  );
}

function AssignmentRow({
  assignment: a,
  withdrawing,
  onWithdraw,
}: {
  assignment: LectureAssignment;
  withdrawing: boolean;
  onWithdraw: (assignmentId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">{a.name}</p>
        <p className="text-sm text-ink-soft">
          zugewiesen am {deDate(a.assignedAt)}
          {a.status === 'completed' &&
            ` · ${a.itemsAnswered}/${a.itemsTotal} Aufgaben${a.correctPct !== null ? ` · ${a.correctPct}% richtig` : ''}`}
        </p>
      </div>
      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_TONE[a.status])}>
        {ASSIGNMENT_LABEL[a.status]}
      </span>
      {a.status === 'completed' && a.sessionId ? (
        <Link
          to={`/students/${encodeURIComponent(a.profileId)}/sessions/${encodeURIComponent(a.sessionId)}`}
          className="inline-flex shrink-0 items-center gap-1 text-sm text-teal-dark hover:underline"
        >
          Details <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : (
        <Button variant="ghost" size="sm" disabled={withdrawing} onClick={() => onWithdraw(a.assignmentId)}>
          Zurückziehen
        </Button>
      )}
    </div>
  );
}
