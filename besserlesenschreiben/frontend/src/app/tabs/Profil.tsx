import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, HeartHandshake, Star } from 'lucide-react';
import { useActiveProfile } from '@/features/profile/useMe';
import { useUpdateSettings } from '@/features/profile/useUpdateSettings';
import { BUDDIES, buddySrc, buddyStateSrc, type BuddyState } from '@/lib/constants';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

// Tap the big buddy → it reacts, cycling through its emotional states (then back to neutral).
const REACTIONS: BuddyState[] = ['froehlich', 'ueberrascht', 'cool'];

export function Profil() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const profile = useActiveProfile();
  const settings = useUpdateSettings(profile?.id ?? '');
  const [reaction, setReaction] = useState(-1); // -1 = neutral (buddySrc)

  if (!profile) return <p className="py-16 text-center font-medium text-ink-soft">Lädt …</p>;

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
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink">{profile.name}</h1>
          <p className="text-sm text-ink-soft">aktiv seit {activeSince}</p>
          <div className="mt-1 flex gap-3 text-sm font-semibold text-ink">
            <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-orange" />{profile.streakDays}</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400" />{profile.stars}</span>
          </div>
        </div>
      </section>

      {/* Buddy picker — the child's companion is theirs to choose */}
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
      </section>

      {/* CTAs */}
      <section className="space-y-3">
        <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/parent')}>
          <HeartHandshake className="h-5 w-5 text-teal-dark" /> Eltern-Bereich
        </Button>
        <Button variant="link" className="w-full" onClick={logout}>
          Abmelden
        </Button>
      </section>
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
