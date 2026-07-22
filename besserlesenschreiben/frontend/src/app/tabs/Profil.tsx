import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Flame, Pencil, RotateCcw, Star, Trash2, X, type LucideIcon } from 'lucide-react';
import { useActiveProfile, useMe } from '@/features/profile/useMe';
import { useUpdateSettings } from '@/features/profile/useUpdateSettings';
import { BUDDIES, buddySrc, buddyStateSrc, type BuddyState } from '@/lib/constants';
import { useAuth } from '@/features/auth/auth-context';
import { coreApi } from '@/lib/endpoints';
import { errorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

// Tap the big buddy → it reacts, cycling through its emotional states (then back to neutral).
const REACTIONS: BuddyState[] = ['froehlich', 'ueberrascht', 'cool'];

export function Profil() {
  const { logout } = useAuth();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const profile = useActiveProfile();
  const settings = useUpdateSettings(profile?.id ?? '');
  const [reaction, setReaction] = useState(-1); // -1 = neutral (buddySrc)
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  if (!profile) return <p className="py-16 text-center font-medium text-ink-soft">Lädt …</p>;

  const startEditName = () => {
    setNameDraft(profile.name);
    setEditingName(true);
  };
  const saveName = () => {
    const name = nameDraft.trim();
    if (!name || name === profile.name) return setEditingName(false);
    settings.mutate({ name }, { onSuccess: () => setEditingName(false) });
  };

  const activeSince = new Date(profile.createdAt).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const buddyImg = reaction < 0 ? buddySrc(profile.buddy) : buddyStateSrc(profile.buddy, REACTIONS[reaction]);

  return (
    <div className="space-y-6">
      {/* Header — tap the buddy and it reacts */}
      <section className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          aria-label="Dein Lernfreund reagiert"
          className="shrink-0 transition-transform active:scale-90"
          onClick={() => setReaction((r) => (r + 1) % REACTIONS.length)}
        >
          <img src={buddyImg} alt="" className="h-16 w-16" />
        </button>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                maxLength={10}
                autoFocus
                aria-label="Name"
                disabled={settings.isPending}
                className="min-w-0 flex-1 rounded-lg bg-canvas px-2 py-1 font-display text-xl font-bold text-ink ring-1 ring-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/60"
              />
              <button
                type="button"
                aria-label="Name speichern"
                disabled={!nameDraft.trim() || settings.isPending}
                onClick={saveName}
                className="shrink-0 rounded-full p-1.5 text-teal-dark hover:bg-teal/10 disabled:opacity-40"
              >
                <Check className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Abbrechen"
                disabled={settings.isPending}
                onClick={() => setEditingName(false)}
                className="shrink-0 rounded-full p-1.5 text-ink-soft hover:bg-black/5"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <h1 className="truncate font-display text-xl font-bold text-ink">{profile.name}</h1>
              <button
                type="button"
                aria-label="Namen ändern"
                onClick={startEditName}
                className="shrink-0 rounded-full p-1.5 text-ink-soft hover:bg-black/5"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          <p className="text-sm text-ink-soft">aktiv seit {activeSince}</p>
          <div className="mt-1 flex gap-3 text-sm font-semibold text-ink">
            <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-orange" />{profile.streakDays}</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400" />{profile.stars}</span>
          </div>
        </div>
      </section>

      {/* Buddy picker — the student's companion is theirs to choose. */}
      <section>
        <h2 className="mb-3 font-display font-bold text-ink">Dein Lernfreund</h2>
        <div className="grid grid-cols-4 gap-3">
          {BUDDIES.map((b) => {
            const selected = b.id === profile.buddy;
            return (
              <button
                key={b.id}
                type="button"
                aria-label={b.name}
                aria-pressed={selected}
                disabled={settings.isPending}
                onClick={() => {
                  if (!selected) {
                    setReaction(-1);
                    settings.mutate({ buddy: b.id });
                  }
                }}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-card bg-white p-2 shadow-sm ring-1 transition-transform active:scale-95',
                  selected ? 'ring-2 ring-teal' : 'ring-black/5',
                )}
              >
                <img src={buddyStateSrc(b.id, selected ? 'froehlich' : 'cool')} alt="" className="h-12 w-12" />
                <span className={cn('text-xs font-medium', selected ? 'text-teal-dark' : 'text-ink-soft')}>{b.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Settings */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-ink">Einstellungen</h2>
        <Row label="Ton">
          <Switch
            label="Ton an/aus"
            checked={profile.soundOn}
            disabled={settings.isPending}
            onChange={(soundOn) => settings.mutate({ soundOn })}
          />
        </Row>
        {me?.account.email && (
          <Row label="Anmelde-E-Mail">
            <span className="min-w-0 truncate text-sm text-ink-soft">{me.account.email}</span>
          </Row>
        )}
      </section>

      {/* Destructive actions — no PIN gate; each is fronted by a TWO-step confirmation instead. */}
      <section className="space-y-3">
        <h2 className="font-display font-bold text-ink">Verwaltung</h2>
        <DangerAction
          icon={RotateCcw}
          title="Lernfortschritt zurücksetzen"
          description="Löscht alle Versuche, Übungsplan und Sterne. Name und Einstellungen bleiben erhalten."
          actionLabel="Zurücksetzen"
          confirmQuestion="Wirklich zurücksetzen?"
          finalLabel="Ja, endgültig zurücksetzen"
          pendingLabel="Wird zurückgesetzt…"
          action={() => coreApi.resetProgress(profile.id)}
          onSuccess={() => {
            void qc.invalidateQueries({ queryKey: ['me'] });
            void qc.invalidateQueries({ queryKey: ['progress'] });
            void qc.invalidateQueries({ queryKey: ['units'] });
          }}
        />
        <DangerAction
          icon={Trash2}
          title="Chat löschen"
          description="Löscht den gesamten Chat mit dem Lerntrainer – Nachrichten, Rückmeldungen und alle hochgeladenen Fotos der Hausübungen. Lernfortschritt und Einstellungen bleiben erhalten."
          actionLabel="Chat löschen"
          confirmQuestion="Wirklich den ganzen Chat löschen?"
          finalLabel="Ja, endgültig löschen"
          pendingLabel="Wird gelöscht…"
          action={() => coreApi.resetChat(profile.id)}
          onSuccess={() => void qc.invalidateQueries({ queryKey: ['chat'] })}
        />
      </section>

      {/* CTAs */}
      <section className="space-y-3">
        <Button variant="link" className="w-full" onClick={logout}>
          Abmelden
        </Button>
      </section>
    </div>
  );
}

// The second-step wording is deliberately identical for every destructive action (uniform gate UX).
const FINAL_QUESTION = 'Bist du ganz sicher? Das kann nicht rückgängig gemacht werden.';

/**
 * A destructive card with a two-step confirmation ("are you really sure" gate): action → confirm →
 * final confirm → mutate. Replaces the removed parent-PIN gate — anyone holding the family session may
 * trigger these, so the friction is deliberate.
 */
function DangerAction({
  icon: Icon,
  title,
  description,
  actionLabel,
  confirmQuestion,
  finalLabel,
  pendingLabel,
  action,
  onSuccess,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  confirmQuestion: string;
  finalLabel: string;
  pendingLabel: string;
  action: () => Promise<{ ok: true }>;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'really'>('idle');
  const mutation = useMutation({ mutationFn: action, onSuccess });

  const cancel = () => {
    setStep('idle');
    mutation.reset(); // else a stale error from an aborted attempt greets the next open
  };
  const run = () => mutation.mutate(undefined, { onSuccess: cancel });

  return (
    <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-soft">{description}</p>

      {step === 'idle' && (
        <Button
          variant="ghost"
          className="mt-3 w-full text-orange-dark hover:bg-orange/10"
          onClick={() => setStep('confirm')}
        >
          <Icon className="h-4 w-4" aria-hidden /> {actionLabel}
        </Button>
      )}

      {step !== 'idle' && (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold text-orange-dark">
            {step === 'confirm' ? confirmQuestion : FINAL_QUESTION}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={cancel} disabled={mutation.isPending}>
              Abbrechen
            </Button>
            {step === 'confirm' ? (
              <Button
                className="flex-1 bg-orange-dark hover:bg-orange-dark/90"
                onClick={() => setStep('really')}
              >
                Weiter
              </Button>
            ) : (
              <Button
                className="flex-1 bg-orange-dark hover:bg-orange-dark/90"
                onClick={run}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? pendingLabel : finalLabel}
              </Button>
            )}
          </div>
          {mutation.isError && (
            <p role="alert" className="text-sm text-orange-dark">
              {errorMessage(mutation.error)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}
