import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search, ShieldAlert, Users } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { FilterChips } from '@/components/ui/filter-chips';
import { Input } from '@/components/ui/input';
import { ProgressPanel } from '@/features/progress/ProgressPanel';
import { cn } from '@/lib/cn';
import type { AccountStatus, AdminUser } from '@/lib/contract';
import { useUsers, useUserActions, useUserProgress } from './useUsers';

const FILTERS: { value: AccountStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Wartet auf Freigabe' },
  { value: 'active', label: 'Aktiv' },
  { value: 'deactivated', label: 'Deaktiviert' },
  { value: 'all', label: 'Alle' },
];

const STATUS_BADGE: Record<AccountStatus, string> = {
  pending: 'bg-amber-tint text-amber',
  active: 'bg-good-tint text-good',
  deactivated: 'bg-danger-tint text-danger',
};
const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Wartet',
  active: 'Aktiv',
  deactivated: 'Deaktiviert',
};

/**
 * User administration (admin only; backend SPEC §6, ARCHITECTURE §1b). Shows real family emails + account
 * lifecycle — the owner's approval/control surface, deliberately separate from the pseudonymised queue.
 * Backend enforces `role='admin'` (403 otherwise); this screen also hides itself from plain reviewers.
 */
export function UsersScreen() {
  const { reviewer } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';
  const [filter, setFilter] = useState<AccountStatus | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState(''); // debounced copy of `search` — one request per pause, not per keystroke
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const status = filter === 'all' ? undefined : filter;
  const { data, isPending, isError, error } = useUsers(status, isAdmin, q);

  if (reviewer && !isAdmin) {
    return (
      <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
        <ShieldAlert className="mb-2 size-7" aria-hidden />
        <p>Nur Administrator:innen können die Nutzerverwaltung sehen.</p>
      </div>
    );
  }

  return (
    <section>
      {/* FilterChips brings its own mb-4 — it spaces this whole row from the list below. */}
      <div className="flex flex-wrap items-start gap-3">
        <FilterChips value={filter} onChange={setFilter} options={FILTERS} label="Status filtern" />
        <div className="relative ml-auto w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="E-Mail suchen …"
            aria-label="Nach E-Mail suchen"
            className="pl-8"
          />
        </div>
      </div>

      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt Nutzer …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Nutzer konnten nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : data.items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <Users className="mb-2 size-7" aria-hidden />
          <p>{q ? 'Keine Konten für diese Suche.' : 'Keine Konten in dieser Ansicht.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          {data.items.map((u) => (
            <UserRow key={u.accountId} user={u} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const { approve, deactivate, remove } = useUserActions();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const progress = useUserProgress(user.accountId, showProgress);
  const busy = approve.isPending || deactivate.isPending || remove.isPending;

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{user.email}</p>
          <p className="text-sm text-ink-soft">
            {user.profileCount} Schüler · seit{' '}
            {new Date(user.createdAt).toLocaleDateString('de-AT')}
            {user.lastActive && ` · zuletzt aktiv ${new Date(user.lastActive).toLocaleDateString('de-AT')}`}
          </p>
        </div>

        <span
          className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_BADGE[user.status])}
        >
          {STATUS_LABEL[user.status]}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowProgress((v) => !v)} aria-expanded={showProgress}>
            {showProgress ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            Fortschritt
          </Button>
          {(user.status === 'pending' || user.status === 'deactivated') && (
            <Button variant="good" size="sm" disabled={busy} onClick={() => approve.mutate(user.accountId)}>
              {user.status === 'pending' ? 'Freigeben' : 'Reaktivieren'}
            </Button>
          )}
          {user.status === 'active' && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => deactivate.mutate(user.accountId)}>
              Deaktivieren
            </Button>
          )}

          {confirmingDelete ? (
            <>
              <Button variant="danger" size="sm" disabled={busy} onClick={() => remove.mutate(user.accountId)}>
                Endgültig löschen
              </Button>
              <Button variant="link" size="sm" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                Abbrechen
              </Button>
            </>
          ) : (
            <Button
              variant="link"
              size="sm"
              disabled={busy}
              className="text-danger"
              onClick={() => setConfirmingDelete(true)}
            >
              Löschen
            </Button>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="border-t border-line bg-black/[0.015] px-5 py-4">
          {progress.isPending ? (
            <p className="text-sm text-ink-soft">Lädt Fortschritt …</p>
          ) : progress.isError ? (
            <p className="text-sm text-danger">Fortschritt konnte nicht geladen werden.</p>
          ) : progress.data.profiles.length === 0 ? (
            <p className="text-sm text-ink-soft">Keine Schülerprofile.</p>
          ) : (
            <div className="space-y-4">
              {progress.data.profiles.map((p) => (
                <div key={p.profileId}>
                  <p className="mb-1.5 font-semibold text-ink">{p.name}</p>
                  <ProgressPanel data={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
