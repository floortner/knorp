import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudents } from '@/features/students/useStudents';
import { useLectureMutations } from './useLectures';

/**
 * Pick students (from the learner directory) and assign the lecture. Re-assigning someone is a
 * counted no-op server-side, reported as "übersprungen" — the dialog can't get it wrong.
 */
export function AssignDialog({ lectureId, onClose }: { lectureId: string; onClose: () => void }) {
  const students = useStudents();
  const { assign } = useLectureMutations(lectureId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // The directory is paged at 50 — drain every page so the picker really is the whole directory
  // (a truncated picker would silently hide students past the first page).
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = students;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all = students.data?.pages.flatMap((p) => p.items) ?? [];
  const needle = search.trim().toLowerCase();
  const shown = needle ? all.filter((s) => s.name.toLowerCase().includes(needle)) : all;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    assign.mutate(
      { profileIds: [...selected] },
      {
        onSuccess: (r) => {
          setResult(
            `${r.assigned} zugewiesen${r.skipped > 0 ? `, ${r.skipped} übersprungen (bereits zugewiesen — auch eine offene ältere Version zählt)` : ''}.`,
          );
          setSelected(new Set());
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-ink">Lektion zuweisen</h2>

        {students.isPending ? (
          <p className="py-8 text-center text-ink-soft">Lädt …</p>
        ) : all.length === 0 ? (
          <p className="py-8 text-center text-ink-soft">Noch keine Schüler.</p>
        ) : (
          <>
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nach Name suchen …"
              aria-label="Schüler suchen"
              className="mb-3"
            />
            {isFetchingNextPage && <p className="mb-2 text-xs text-ink-soft">Lädt weitere Schüler …</p>}
            {shown.length === 0 ? (
              <p className="mb-4 py-6 text-center text-sm text-ink-soft">Kein Schüler mit diesem Namen.</p>
            ) : (
          <ul className="mb-4 max-h-80 divide-y divide-line overflow-y-auto rounded-card ring-1 ring-line">
            {shown.map((s) => (
              <li key={s.profileId}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-black/[0.02]">
                  <input
                    type="checkbox"
                    checked={selected.has(s.profileId)}
                    onChange={() => toggle(s.profileId)}
                    className="size-4 accent-teal"
                  />
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="text-sm text-ink-soft">Einheit {s.unit}</span>
                </label>
              </li>
            ))}
          </ul>
            )}
          </>
        )}

        {result && (
          <p role="status" className="mb-3 text-sm text-good">
            {result}
          </p>
        )}
        {assign.error instanceof ApiError && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {assign.error.message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Schließen
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || assign.isPending}>
            {assign.isPending ? 'Wird zugewiesen …' : `Zuweisen (${selected.size})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
