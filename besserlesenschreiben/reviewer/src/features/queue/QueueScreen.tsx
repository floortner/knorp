import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';
import { decisionLabel, decisionTone } from '@/lib/decision';
import { FilterChips } from '@/components/ui/filter-chips';
import type { QueueItem } from '@/lib/contract';
import { useQueue, type QueueFilter } from './useQueue';

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: 'open', label: 'Offen' },
  { value: 'done', label: 'Erledigt' },
  { value: 'all', label: 'Alle' },
];

const EMPTY: Record<QueueFilter, string> = {
  open: 'Keine offenen Hausübungen. 🎉',
  done: 'Noch keine erledigten Anfragen.',
  all: 'Keine Anfragen.',
};

const ROW = 'flex items-center gap-4 px-5 py-4';

/** Review list. Each row is PSEUDONYMISED (handle + grade band + skill tags only — ARCHITECTURE §1a).
 *  The Offen tab is the actionable work queue (rows open the review screen); Erledigt/Alle are read-only. */
export function QueueScreen() {
  const [filter, setFilter] = useState<QueueFilter>('open');
  const { data, isPending, isError, error } = useQueue(filter);

  return (
    <section>
      <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Status filtern" />

      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : data.items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <Inbox className="mb-2 size-7" aria-hidden />
          <p>{EMPTY[filter]}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          {data.items.map((it) => (
            <li key={it.uploadId}>
              <QueueRow item={it} actionable={filter === 'open'} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QueueRow({ item, actionable }: { item: QueueItem; actionable: boolean }) {
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
      {item.decision && (
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', decisionTone(item.decision))}>
          {decisionLabel(item.decision)}
        </span>
      )}
      <time className="hidden shrink-0 text-xs text-ink-soft sm:block" dateTime={item.reviewedAt ?? item.createdAt}>
        {new Date(item.reviewedAt ?? item.createdAt).toLocaleDateString('de-AT')}
      </time>
      {actionable && <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />}
    </>
  );

  // Only the actionable (Offen) list opens the review screen; Erledigt/Alle are read-only history.
  return actionable ? (
    <Link to={`/review/${encodeURIComponent(item.uploadId)}`} className={cn(ROW, 'transition hover:bg-black/[0.02]')}>
      {inner}
    </Link>
  ) : (
    <div className={ROW}>{inner}</div>
  );
}
