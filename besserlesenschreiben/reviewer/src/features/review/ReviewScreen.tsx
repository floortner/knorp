import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import type { HomeworkAnalysis, QueuePage } from '@/lib/contract';
import { ApiError } from '@/lib/api';
import { reviewApi } from '@/lib/endpoints';
import { useStaffAuth } from '@/features/auth/auth-context';
import { ProgressPanel } from '@/features/progress/ProgressPanel';
import { useQueueProgress } from '@/features/queue/useQueue';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageLightbox } from '@/components/ui/image-lightbox';
import { AnalysisEditor } from './AnalysisEditor';
import { useClaim, useQueueItem, useSubmitReview } from './useReview';

/**
 * The review screen — two-pane LANDSCAPE (homework image | editable analysis), the core staff task
 * (ARCHITECTURE §11). Claims the item on mount; the reviewer corrects the LLM draft into the
 * authoritative verdict, then approves (as-is or corrected) or rejects (confirmed, never one-tap).
 * Desktop/tablet, not mobile. Keyed by uploadId so "Speichern & weiter" gets a clean slate per item.
 */
export function ReviewScreen() {
  const { uploadId = '' } = useParams();
  return <ReviewItem key={uploadId} uploadId={uploadId} />;
}

function ReviewItem({ uploadId }: { uploadId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: item, isPending, isError } = useQueueItem(uploadId);
  const claim = useClaim();
  const submit = useSubmitReview(uploadId);
  const { reviewer } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';

  const [draft, setDraft] = useState<HomeworkAnalysis | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const progress = useQueueProgress(uploadId, isAdmin && showProgress);

  // Another reviewer holds a live lease (claim 409) → read-only: no edits, no verdict from here.
  const claimConflict = claim.error instanceof ApiError && claim.error.status === 409;

  // Claim the item + seed the editable draft once the item is known.
  useEffect(() => {
    if (item && draft === null) {
      setDraft(structuredClone(item.llmAnalysis));
      claim.mutate(uploadId);
    }
  }, [item, draft, claim, uploadId]);

  // Release the claim when leaving without a verdict (fire-and-forget; a no-op after submit/takeover),
  // so an abandoned item goes straight back to the queue instead of waiting out the 15-min lease.
  useEffect(() => {
    return () => {
      void reviewApi.release(uploadId).catch(() => {});
    };
  }, [uploadId]);

  const dirty = useMemo(
    () => (item && draft ? JSON.stringify(draft) !== JSON.stringify(item.llmAnalysis) : false),
    [draft, item],
  );

  // Unsaved-corrections guard: warn on tab close/refresh while the draft differs from the LLM analysis.
  // (In-app, the back link below confirms; a submit clears `dirty` concerns by design.)
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const confirmLeave = (e: MouseEvent) => {
    if (dirty && !window.confirm('Änderungen an der Analyse verwerfen?')) e.preventDefault();
  };

  if (isPending) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;
  if (isError || !item) {
    return (
      <div className="py-16 text-center text-ink-soft">
        <p>Diese Hausübung ist nicht (mehr) in der Warteschlange.</p>
        <Link to="/queue" className="mt-2 inline-block text-teal-dark hover:underline">
          Zurück zur Warteschlange
        </Link>
      </div>
    );
  }

  /** After a verdict, jump straight to the next pickable open item (queue-tool flow); else the queue. */
  function goNext() {
    const page = qc.getQueryData<QueuePage>(['staff-queue', 'open']);
    const next = page?.items.find((i) => i.uploadId !== uploadId && !i.claimed);
    navigate(next ? `/review/${encodeURIComponent(next.uploadId)}` : '/queue', { replace: true });
  }

  async function send(decision: 'approve' | 'reject') {
    if (!draft) return;
    const body =
      decision === 'reject'
        ? { decision: 'rejected' as const, notes: notes.trim() || undefined }
        : {
            decision: (dirty ? 'corrected' : 'approved') as 'corrected' | 'approved',
            reviewedAnalysis: draft,
            notes: notes.trim() || undefined,
          };
    await submit.mutateAsync(body);
    goNext();
  }

  const submitErr = submit.error instanceof ApiError ? submit.error.message : null;
  const busy = submit.isPending || claimConflict;

  return (
    <section>
      <Link
        to="/queue"
        onClick={confirmLeave}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Warteschlange
      </Link>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-lg font-semibold text-ink">{item.profileHandle}</h1>
        <span className="text-sm text-ink-soft">{item.gradeBand}</span>
        {claimConflict && (
          <span className="rounded bg-amber-tint px-2 py-0.5 text-xs font-medium text-amber">
            Wird bereits von einer anderen Fachkraft geprüft — nur Ansicht
          </span>
        )}
      </div>

      {/* Admin-only learner progress — pseudonymised context for grading (rule 10: handle, never a name). */}
      {isAdmin && (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={() => setShowProgress((v) => !v)} aria-expanded={showProgress}>
            {showProgress ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            Lernfortschritt
          </Button>
          {showProgress && (
            <div className="mt-2 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
              {progress.isPending ? (
                <p className="text-sm text-ink-soft">Lädt Fortschritt …</p>
              ) : progress.isError ? (
                <p className="text-sm text-danger">Fortschritt konnte nicht geladen werden.</p>
              ) : progress.data ? (
                <ProgressPanel data={progress.data} />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Two-pane landscape: image | analysis (stacks only on small/portrait, which is out of scope). */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ImageLightbox src={item.imageUrl} alt="Hausübung" />

        <div className="flex flex-col gap-4">
          {draft && <AnalysisEditor value={draft} onChange={setDraft} disabled={busy} />}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink-soft">
              Kommentar ans Kind (optional — erscheint im Chat unter dem Foto)
            </span>
            <Textarea
              rows={2}
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. Toll gemacht! Achte beim nächsten Mal auf die Wortwiederholungen."
            />
          </label>

          {submitErr && <p className="text-sm text-danger">{submitErr}</p>}

          {confirmingReject ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-danger">Wirklich ablehnen?</span>
              <Button variant="ghost" onClick={() => setConfirmingReject(false)} disabled={busy}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={() => void send('reject')} disabled={busy}>
                Ja, ablehnen
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="good" onClick={() => void send('approve')} disabled={busy}>
                {dirty ? 'Korrigiert übernehmen' : 'Bestätigen'}
              </Button>
              <Button variant="danger" onClick={() => setConfirmingReject(true)} disabled={busy}>
                Ablehnen
              </Button>
              <span className="text-xs text-ink-soft">
                {dirty ? 'Du hast die KI-Analyse geändert.' : 'Unverändert gegenüber der KI-Analyse.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
