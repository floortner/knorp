import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { deDate } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import type { LectureListItem } from '@/lib/contract';
import { useLectures } from './useLectures';
import { STATUS_LABEL } from './labels';

/**
 * The Lektionen list (ROADMAP §H1) — every trainer's authored lectures, newest-updated first,
 * with per-status assignment counts. The entry point of the teaching console.
 */
export function LecturesScreen() {
  const navigate = useNavigate();
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useLectures();
  const lectures = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink">Lektionen</h1>
        <Button onClick={() => navigate('/lectures/new')}>
          <Plus className="size-4" aria-hidden /> Neue Lektion
        </Button>
      </div>

      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : lectures.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <BookOpen className="mb-2 size-7" aria-hidden />
          <p>Noch keine Lektionen.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
            {lectures.map((l) => (
              <li key={l.lectureId}>
                <LectureRow lecture={l} />
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

function LectureRow({ lecture: l }: { lecture: LectureListItem }) {
  const c = l.assignmentCounts;
  return (
    <Link
      to={`/lectures/${encodeURIComponent(l.lectureId)}`}
      className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02]"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
          {l.title}
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              l.status === 'published' ? 'bg-good-tint text-good' : 'bg-black/[0.04] text-ink-soft',
            )}
          >
            {STATUS_LABEL[l.status]}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          {l.itemCount} {l.itemCount === 1 ? 'Aufgabe' : 'Aufgaben'} · von {l.authorName}
          {c.open + c.started + c.completed > 0 &&
            ` · Offen ${c.open} · Begonnen ${c.started} · Erledigt ${c.completed}`}
        </p>
      </div>
      <time className="hidden shrink-0 text-xs text-ink-soft sm:block" dateTime={l.updatedAt}>
        {deDate(l.updatedAt)}
      </time>
      <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}
