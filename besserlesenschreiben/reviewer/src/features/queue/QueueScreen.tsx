import { Link } from 'react-router-dom';
import { ArrowRight, Inbox } from 'lucide-react';
import { useQueue } from './useQueue';

/** The pending-review list. Each row is PSEUDONYMISED (handle + grade band + skill tags only —
 *  ARCHITECTURE §1a); the full image + draft open in the review screen. */
export function QueueScreen() {
  const { data, isPending, isError, error } = useQueue();

  if (isPending) {
    return <p className="py-16 text-center text-ink-soft">Lädt Warteschlange …</p>;
  }
  if (isError) {
    return (
      <p className="py-16 text-center text-danger">
        Warteschlange konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
      </p>
    );
  }

  const items = data.items;

  return (
    <section>
      {items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <Inbox className="mb-2 size-7" aria-hidden />
          <p>Keine offenen Hausübungen. 🎉</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          {items.map((it) => (
            <li key={it.uploadId}>
              <Link
                to={`/review/${encodeURIComponent(it.uploadId)}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-black/[0.02]"
              >
                <img
                  src={it.imageUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-md object-cover ring-1 ring-line"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">
                    {it.profileHandle} · <span className="text-ink-soft">{it.gradeBand}</span>
                  </p>
                  <p className="truncate text-sm text-ink-soft">
                    {it.llmAnalysis.topic} · {it.skillTags.join(', ') || 'keine Tags'}
                  </p>
                </div>
                <time className="hidden shrink-0 text-xs text-ink-soft sm:block" dateTime={it.createdAt}>
                  {new Date(it.createdAt).toLocaleDateString('de-AT')}
                </time>
                <ArrowRight className="size-4 shrink-0 text-ink-soft" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
