import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { deDate, deTime } from '@/lib/dates';
import { useSessionDetail } from './useStudents';
import { SOURCE_LABEL } from './labels';

const secondsLabel = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// Homework attempts store a POSITIONAL index in attemptNo (1..N over distinct items, all itemId=null)
// to satisfy the (session_id, item_id, attempt_no) unique index — it is NOT a retry count there.
// Retry badges only make sense where attemptNo really counts re-tries (bank/llm sessions).
const hasRetries = (source: string) => source !== 'homework';

/**
 * Question-by-question session review (ROADMAP §H3.2): every attempt in answer order — prompt, the
 * student's answer (tinted by correctness), the expected answer when wrong, retry markers, timing.
 * This is the trainer's ground truth for the next authored lecture and the parent conversation.
 */
export function SessionDetailScreen() {
  const { profileId = '', sessionId = '' } = useParams();
  const { data, isPending, isError } = useSessionDetail(profileId, sessionId);

  if (isPending) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-ink-soft">
        <p>Diese Sitzung wurde nicht gefunden.</p>
        <Link to={`/students/${encodeURIComponent(profileId)}`} className="mt-2 inline-block text-teal-dark hover:underline">
          Zurück zur Aktivität
        </Link>
      </div>
    );
  }

  return (
    <section>
      <Link
        to={`/students/${encodeURIComponent(profileId)}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> {data.name}
      </Link>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-lg font-semibold text-ink">{SOURCE_LABEL[data.source] ?? data.source}</h1>
        <span className="text-sm text-ink-soft">
          {deDate(data.startedAt)}, {deTime(data.startedAt)}
        </span>
        {data.correctPct !== null && <span className="text-sm text-ink-soft">{data.correctPct}% richtig</span>}
        {data.activeMs > 0 && <span className="text-sm text-ink-soft">aktive Zeit {secondsLabel(data.activeMs)}</span>}
      </div>

      {data.attempts.length === 0 ? (
        <p className="py-10 text-center text-ink-soft">Keine Antworten aufgezeichnet.</p>
      ) : (
        <ol className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          {data.attempts.map((a, i) => (
            <li key={a.attemptId} className="flex gap-4 px-5 py-3">
              <span className="w-6 shrink-0 pt-0.5 text-sm text-ink-soft">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">{a.prompt}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 text-sm font-medium',
                      a.isCorrect ? 'bg-good-tint text-good' : 'bg-danger-tint text-danger',
                    )}
                  >
                    {a.given || '—'}
                  </span>
                  {!a.isCorrect && a.expected !== '' && (
                    <span className="text-sm text-ink-soft">Richtig wäre: {a.expected}</span>
                  )}
                  {hasRetries(data.source) && a.attemptNo > 1 && (
                    <span className="rounded-full bg-amber-tint px-2 py-0.5 text-xs font-medium text-amber">
                      {a.attemptNo}. Versuch
                    </span>
                  )}
                  {a.timeMs > 0 && <span className="text-xs text-ink-soft">{secondsLabel(a.timeMs)}</span>}
                </p>
                {a.skillTags.length > 0 && (
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {a.skillTags.map((t) => (
                      <span key={t} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-ink-soft">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
