import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { decisionLabel, decisionTone } from '@/lib/decision';
import { FilterChips } from '@/components/ui/filter-chips';
import { Button } from '@/components/ui/button';
import type { QueueItem } from '@/lib/contract';
import { useQueue, type QueueFilter } from './useQueue';

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'open', label: 'Offen' },
  { value: 'done', label: 'Erledigt' },
  { value: 'all', label: 'Alle' },
];

const EMPTY: Record<QueueFilter, string> = {
  open: 'Keine offenen Hausübungen.',
  done: 'Noch keine erledigten Anfragen.',
  all: 'Keine Anfragen.',
};

const ROW = 'flex items-center gap-4 px-5 py-4';

/** How long an open item has been waiting — the triage cue ("review is async, but shouldn't sit for days"). */
function waitingSince(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `vor ${mins} Min.`;
  const rtf = new Intl.RelativeTimeFormat('de', { numeric: 'auto' });
  if (mins < 24 * 60) return rtf.format(-Math.round(mins / 60), 'hour');
  return rtf.format(-Math.round(mins / (24 * 60)), 'day');
}

/**
 * Review list. Each row is PSEUDONYMISED (handle + grade band + skill tags only — ARCHITECTURE §1a).
 * Offen = the actionable work queue (rows open the review screen; live-claimed rows show locked).
 * Erledigt/Alle = history; decided rows open the read-only detail. Cursor-paged via "Mehr laden".
 */
export function QueueScreen() {
  const [filter, setFilter] = useState<QueueFilter>('open');
  const { data, isPending, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useQueue(filter);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section>
      <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Status filtern" />

      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <ClipboardCheck className="mb-2 size-7" aria-hidden />
          <p>{EMPTY[filter]}</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
            {items.map((it) => (
              <li key={it.uploadId}>
                <QueueRow item={it} />
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

function QueueRow({ item }: { item: QueueItem }) {
  const open = item.decision === null; // undecided — the actionable state
  const inner = (
    <>
      <img
        src={item.imageUrl}
        alt=""
        className="size-14 shrink-0 rounded-md object-cover ring-1 ring-line"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {item.profileHandle} · <span className="text-ink-soft">{item.gradeBand}</span>
        </p>
        <p className="truncate text-sm text-ink-soft">
          {item.llmAnalysis.topic} · {item.skillTags.join(', ') || 'keine Tags'}
        </p>
      </div>
      {item.claimed && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-tint px-2.5 py-1 text-xs font-semibold text-amber">
          <Lock className="size-3" aria-hidden /> in Prüfung
        </span>
      )}
      {item.decision && (
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', decisionTone(item.decision))}>
          {decisionLabel(item.decision)}
        </span>
      )}
      <time className="hidden shrink-0 text-xs text-ink-soft sm:block" dateTime={item.reviewedAt ?? item.createdAt}>
        {open ? waitingSince(item.createdAt) : new Date(item.reviewedAt ?? item.createdAt).toLocaleDateString('de-AT')}
      </time>
      {!item.claimed && <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />}
    </>
  );

  // Open + unclaimed → the review screen. Decided → the read-only detail. Live-claimed → locked (no link).
  if (open && !item.claimed) {
    return (
      <Link to={`/review/${encodeURIComponent(item.uploadId)}`} className={cn(ROW, 'transition hover:bg-black/[0.02]')}>
        {inner}
      </Link>
    );
  }
  if (item.decision) {
    return (
      <Link to={`/history/${encodeURIComponent(item.uploadId)}`} className={cn(ROW, 'transition hover:bg-black/[0.02]')}>
        {inner}
      </Link>
    );
  }
  return <div className={cn(ROW, 'opacity-70')}>{inner}</div>;
}
