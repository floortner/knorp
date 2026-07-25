import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { LectureItemInput, LectureUpsertBody } from '@/lib/contract';
import { useLecture, useLectureMutations } from './useLectures';

// The single authoring type while §F redesigns the exercise union; §H2 grows this per type.
const EMPTY_ITEM: LectureItemInput = {
  type: 'placeholder',
  prompt: '',
  options: ['', ''],
  answer: '',
  praise: 'Super gemacht!',
  skillTags: ['placeholder'],
};

/**
 * Compose or edit a DRAFT lecture (ROADMAP §H1): Titel + Merksatz + simple single-choice items.
 * Publishing freezes it (the backend enforces immutability); the server's solvability gate (422)
 * is surfaced inline per item — an unanswerable item can never be saved.
 */
export function LectureEditorScreen() {
  const { lectureId } = useParams();
  const isNew = lectureId === undefined;
  const navigate = useNavigate();
  const existing = useLecture(lectureId ?? '');
  const { create, update } = useLectureMutations(lectureId);

  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [items, setItems] = useState<LectureItemInput[]>([{ ...EMPTY_ITEM }]);
  const [seeded, setSeeded] = useState(false);

  // Seed the form once from an existing draft (options/answer live in the wire item payloads).
  useEffect(() => {
    if (isNew || seeded || !existing.data) return;
    setTitle(existing.data.title);
    setIntro(existing.data.intro);
    setItems(
      existing.data.items.map((it) => ({
        type: 'placeholder',
        prompt: it.prompt,
        options: [...it.options],
        answer: it.answer,
        praise: it.praise,
        skillTags: it.skillTags as LectureItemInput['skillTags'],
      })),
    );
    setSeeded(true);
  }, [isNew, seeded, existing.data]);

  const setItem = (i: number, patch: Partial<LectureItemInput>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const body = (): LectureUpsertBody => ({
    title: title.trim(),
    intro: intro.trim(),
    items: items.map((it) => ({
      ...it,
      prompt: it.prompt.trim(),
      options: it.options.map((o) => o.trim()).filter(Boolean),
      answer: it.answer.trim(),
      praise: it.praise.trim(),
    })),
  });

  // Saving always lands on the detail screen — that's where "Veröffentlichen" (and assigning) lives.
  const save = () => {
    const mutation = isNew ? create : update;
    mutation.mutate(body(), {
      onSuccess: (lecture) => navigate(`/lectures/${encodeURIComponent(lecture.lectureId)}`, { replace: true }),
    });
  };

  const err = create.error ?? update.error;
  const apiErr = err instanceof ApiError ? err : null;
  /** The server's 422 detail path (`items.N.field`) for one item row, if any. */
  const itemError = (i: number): string | null => {
    const detail = apiErr?.details?.find((d) => d.field.startsWith(`items.${i}.`));
    if (!detail) return null;
    return detail.field.endsWith('.answer')
      ? 'Die richtige Antwort muss eine der Antwortmöglichkeiten sein.'
      : detail.issue;
  };

  const busy = create.isPending || update.isPending;
  const valid =
    title.trim() !== '' &&
    intro.trim() !== '' &&
    items.length > 0 &&
    items.every((it) => it.prompt.trim() && it.answer.trim() && it.options.filter((o) => o.trim()).length >= 2);

  if (!isNew && existing.isPending) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;
  if (!isNew && (existing.isError || existing.data?.status === 'published')) {
    return (
      <div className="py-16 text-center text-ink-soft">
        <p>Diese Lektion kann nicht bearbeitet werden.</p>
        <Link to="/lectures" className="mt-2 inline-block text-teal-dark hover:underline">
          Zurück zu den Lektionen
        </Link>
      </div>
    );
  }

  return (
    <section className="max-w-3xl">
      <Link to="/lectures" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lektionen
      </Link>

      <h1 className="mb-4 text-lg font-semibold text-ink">{isNew ? 'Neue Lektion' : 'Lektion bearbeiten'}</h1>

      <div className="space-y-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">Titel</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="z. B. Dehnungs-h entdecken" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-soft">
            Merksatz (erscheint als Lernkarte vor der ersten Aufgabe)
          </span>
          <Textarea
            rows={2}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            disabled={busy}
            placeholder="Merke: Das stumme h macht den Selbstlaut davor lang."
          />
        </label>

        <h2 className="pt-2 font-semibold text-ink">Aufgaben</h2>
        {items.map((it, i) => (
          <div key={i} className="space-y-3 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink-soft">Aufgabe {i + 1}</p>
              {items.length > 1 && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-4" aria-hidden /> Entfernen
                </Button>
              )}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-soft">Frage</span>
              <Input value={it.prompt} onChange={(e) => setItem(i, { prompt: e.target.value })} disabled={busy} placeholder="Welches Wort hat ein Dehnungs-h?" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-soft">Antwortmöglichkeiten (eine pro Zeile, mind. 2)</span>
              <Textarea
                rows={3}
                value={it.options.join('\n')}
                onChange={(e) => setItem(i, { options: e.target.value.split('\n') })}
                disabled={busy}
                placeholder={'fahren\nfallen\nfangen'}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink-soft">Richtige Antwort</span>
                <Input value={it.answer} onChange={(e) => setItem(i, { answer: e.target.value })} disabled={busy} placeholder="fahren" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink-soft">Lob nach richtiger Antwort</span>
                <Input value={it.praise} onChange={(e) => setItem(i, { praise: e.target.value })} disabled={busy} />
              </label>
            </div>
            {itemError(i) && (
              <p role="alert" className="text-sm text-danger">
                {itemError(i)}
              </p>
            )}
          </div>
        ))}

        <Button variant="ghost" disabled={busy || items.length >= 12} onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          <Plus className="size-4" aria-hidden /> Aufgabe hinzufügen
        </Button>

        {apiErr && !apiErr.details?.length && (
          <p role="alert" className="text-sm text-danger">
            {apiErr.message}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button disabled={busy || !valid} onClick={save}>
            {busy ? 'Speichert …' : 'Als Entwurf speichern'}
          </Button>
        </div>
      </div>
    </section>
  );
}
