import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { decisionLabel, decisionTone } from '@/lib/decision';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { AnalysisEditor } from './AnalysisEditor';
import { useHistoryItem } from './useReview';

/**
 * Read-only detail of a DECIDED review (audit convenience): the homework photo, the authoritative
 * verdict (or the LLM draft when it was rejected — reject applies nothing), the decision and the
 * student-visible comment. Same two-pane layout as the review screen, nothing editable.
 */
export function HistoryScreen() {
  const { uploadId = '' } = useParams();
  const { data: item, isPending, isError } = useHistoryItem(uploadId);

  if (isPending) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;
  if (isError || !item || !item.decision) {
    return (
      <div className="py-16 text-center text-ink-soft">
        <p>Diese erledigte Anfrage wurde nicht gefunden.</p>
        <Link to="/queue" className="mt-2 inline-block text-teal-dark hover:underline">
          Zurück zur Warteschlange
        </Link>
      </div>
    );
  }

  const rejected = item.decision === 'rejected';

  return (
    <section>
      <Link to="/queue" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Warteschlange
      </Link>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-lg font-semibold text-ink">{item.profileHandle}</h1>
        <span className="text-sm text-ink-soft">{item.gradeBand}</span>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', decisionTone(item.decision))}>
          {decisionLabel(item.decision)}
        </span>
        {item.reviewedAt && (
          <time className="text-xs text-ink-soft" dateTime={item.reviewedAt}>
            geprüft am {new Date(item.reviewedAt).toLocaleDateString('de-AT')}
          </time>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ImageLightbox src={item.imageUrl} alt="Hausübung" />

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-ink-soft">
            {rejected ? 'KI-Analyse (abgelehnt — nichts wurde übernommen)' : 'Übernommene Analyse'}
          </p>
          <AnalysisEditor value={item.reviewedAnalysis ?? item.llmAnalysis} onChange={() => {}} disabled />

          {item.notes && (
            <div className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
              <p className="text-sm font-medium text-ink-soft">Kommentar an den Schüler</p>
              <p className="mt-1 text-sm text-ink">{item.notes}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
