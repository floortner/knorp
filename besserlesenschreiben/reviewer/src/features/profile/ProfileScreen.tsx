import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, X } from 'lucide-react';
import { staffAuthApi } from '@/lib/endpoints';
import { ApiError } from '@/lib/api';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLE_LABEL = { reviewer: 'Fachkraft', admin: 'Administrator:in' } as const;

/**
 * The reviewer's OWN profile: display name (editable — it's what colleagues see in the top bar),
 * login email and role (both admin-provisioned, read-only), and when the access was created.
 * Audit trail is deferred to the OTel build-out (ROADMAP §E observability).
 */
export function ProfileScreen() {
  const { reviewer } = useStaffAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const rename = useMutation({
    mutationFn: (name: string) => staffAuthApi.updateMe(name),
    onSuccess: (me) => {
      qc.setQueryData(['staff-me'], me); // the top-bar name comes from this cache — update it in place
      setEditing(false);
    },
  });

  if (!reviewer) return <p className="py-16 text-center text-ink-soft">Lädt …</p>;

  const startEdit = () => {
    setDraft(reviewer.name);
    rename.reset();
    setEditing(true);
  };
  const save = () => {
    const name = draft.trim();
    if (!name || name === reviewer.name) return setEditing(false);
    rename.mutate(name);
  };

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="mb-4 text-lg font-semibold text-ink">Mein Profil</h1>

      <div className="divide-y divide-line rounded-card bg-surface shadow-sm ring-1 ring-line">
        <Row label="Anzeigename">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') setEditing(false);
                }}
                maxLength={60}
                autoFocus
                aria-label="Anzeigename"
                disabled={rename.isPending}
                className="w-56"
              />
              <button
                type="button"
                aria-label="Namen speichern"
                disabled={!draft.trim() || rename.isPending}
                onClick={save}
                className="rounded-md p-1.5 text-teal-dark hover:bg-teal-tint disabled:opacity-40"
              >
                <Check className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Abbrechen"
                disabled={rename.isPending}
                onClick={() => setEditing(false)}
                className="rounded-md p-1.5 text-ink-soft hover:bg-black/5"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{reviewer.name}</span>
              <Button variant="ghost" size="sm" aria-label="Namen ändern" onClick={startEdit}>
                <Pencil className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </Row>

        <Row label="Anmelde-E-Mail">
          <span className="text-ink">{reviewer.email}</span>
        </Row>

        <Row label="Rolle">
          <span className="rounded-full bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-dark">
            {ROLE_LABEL[reviewer.role]}
          </span>
        </Row>

        <Row label="Zugang seit">
          <span className="text-ink">
            {new Date(reviewer.createdAt).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </Row>
      </div>

      {rename.isError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {rename.error instanceof ApiError ? rename.error.message : 'Name konnte nicht gespeichert werden.'}
        </p>
      )}

      <p className="mt-4 text-xs text-ink-soft">
        E-Mail und Rolle werden administrativ vergeben. Bei Änderungswünschen wende dich an die Administration.
      </p>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 px-5 py-3">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </div>
  );
}
