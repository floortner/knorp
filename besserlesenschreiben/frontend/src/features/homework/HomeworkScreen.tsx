import { type ChangeEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, X } from 'lucide-react';
import { homeworkApi } from '@/lib/endpoints';
import { errorMessage } from '@/lib/api';
import type { HomeworkResult } from '@/lib/types';
import { useActiveProfile } from '@/features/profile/useMe';
import { Button } from '@/components/ui/button';

const POLL_MS = 5000;
const TERMINAL = new Set(['reviewed', 'rejected']);

/**
 * Homework "Foto & verbessern" (family realm, free). Upload-and-track only: the app never shows the LLM
 * draft and has no confirm/edit UI — a trained staff reviewer is the authoritative gate (SPEC §9).
 */
export function HomeworkScreen() {
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => homeworkApi.upload(profile!.id, file),
    onSuccess: (res) => setUploadId(res.uploadId),
  });

  const status = useQuery({
    queryKey: ['homework', uploadId],
    queryFn: () => homeworkApi.status(uploadId as string),
    enabled: Boolean(uploadId),
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : POLL_MS),
  });

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = ''; // allow re-picking the same file
  };

  const reset = () => {
    setUploadId(null);
    upload.reset();
  };

  return (
    <main className="bg-blobs min-h-dvh px-6 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-ink">Hausübung</h1>
          <button
            type="button"
            onClick={() => navigate('/app/lernen')}
            aria-label="Schließen"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-soft shadow-sm ring-1 ring-black/5"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {!uploadId && (
          <div className="space-y-5">
            <div className="rounded-card bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-teal/15 text-3xl" aria-hidden>
                📷
              </div>
              <h2 className="font-display text-lg font-bold text-ink">Foto & verbessern</h2>
              <p className="mt-2 text-ink-soft">
                Fotografiere eine Hausübung. Eine geschulte Fachkraft schaut sie sich an und passt die
                nächsten Übungen für {profile?.name ?? 'dein Kind'} an.
              </p>
              <p className="mt-2 text-xs text-ink-soft">
                Das Foto wird <strong>nicht automatisch</strong> ausgewertet, sondern von einer Person geprüft.
              </p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPick}
              className="hidden"
            />
            <Button size="lg" onClick={() => fileRef.current?.click()} disabled={upload.isPending || !profile}>
              <Camera className="h-5 w-5" aria-hidden /> {upload.isPending ? 'Wird hochgeladen …' : 'Foto auswählen'}
            </Button>

            {upload.isError && (
              <p role="alert" className="text-center text-sm text-orange-dark">
                {errorMessage(upload.error)}
              </p>
            )}
          </div>
        )}

        {uploadId && <StatusCard result={status.data} onAnother={reset} onHome={() => navigate('/app/lernen')} />}
      </div>
    </main>
  );
}

function StatusCard({
  result,
  onAnother,
  onHome,
}: {
  result?: HomeworkResult;
  onAnother: () => void;
  onHome: () => void;
}) {
  const status = result?.status;

  if (status === 'reviewed' && result?.reviewedAnalysis) {
    const a = result.reviewedAnalysis;
    return (
      <div className="space-y-4">
        <div className="rounded-card bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="font-display text-lg font-bold text-ink">✅ Geprüft: {a.topic}</p>
          <ul className="mt-3 space-y-1">
            {a.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-ink">
                <span aria-hidden>{it.correct ? '✅' : '✏️'}</span>
                <span>{it.prompt}</span>
              </li>
            ))}
          </ul>
          {a.suggestedFocus.length > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              Als Nächstes üben wir: {a.suggestedFocus.join(', ')}.
            </p>
          )}
        </div>
        <Button size="lg" onClick={onHome}>
          Weiter zu den Übungen
        </Button>
        <Button variant="ghost" size="lg" onClick={onAnother}>
          Noch ein Foto
        </Button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-card bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="text-4xl" aria-hidden>
            🙈
          </div>
          <p className="mt-3 text-ink">
            Das Foto konnte leider nicht verwendet werden. Versuch es mit einem klareren Bild noch einmal.
          </p>
        </div>
        <Button size="lg" onClick={onAnother}>
          Neues Foto
        </Button>
      </div>
    );
  }

  // pending_analysis | pending_review (or still loading) — one calm "in review" state for the family.
  return (
    <div className="rounded-card bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
      <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-teal/20 border-t-teal" aria-hidden />
      <p className="font-display text-lg font-bold text-ink">Wird von einer Fachkraft geprüft …</p>
      <p className="mt-2 text-ink-soft">
        Das dauert eine Weile – du wirst nicht aufgehalten. Die nächste passende Übung erscheint danach unter
        „Lernen".
      </p>
      <Button variant="ghost" size="lg" className="mt-5" onClick={onHome}>
        Zurück zu den Übungen
      </Button>
    </div>
  );
}
