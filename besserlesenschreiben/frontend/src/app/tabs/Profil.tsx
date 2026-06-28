import { useNavigate } from 'react-router-dom';
import { Flame, HeartHandshake, MessageCircle, Star } from 'lucide-react';
import { useActiveProfile } from '@/features/profile/useMe';
import { useUpdateSettings } from '@/features/profile/useUpdateSettings';
import { useProgress } from '@/features/progress/useProgress';
import { SkillBreakdown } from '@/features/progress/components';
import { useAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';

const BUDDY_SRC: Record<string, string> = { nepo: '/nepo.svg', stella: '/stella.svg' };
const FONT_SCALES = [
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Groß' },
  { value: 1.5, label: 'Sehr groß' },
];

export function Profil() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const profile = useActiveProfile();
  const progress = useProgress(profile?.id);
  const settings = useUpdateSettings(profile?.id ?? '');

  if (!profile) return <p className="py-16 text-center font-medium text-ink-soft">Lädt …</p>;

  const activeSince = new Date(profile.createdAt).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5">
        <img src={BUDDY_SRC[profile.buddy] ?? '/nepo.svg'} alt="" className="h-16 w-16" />
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold text-ink">{profile.name}</h1>
          <p className="text-sm text-ink-soft">aktiv seit {activeSince}</p>
          <div className="mt-1 flex gap-3 text-sm font-semibold text-ink">
            <span className="flex items-center gap-1"><Flame className="h-4 w-4 text-orange" />{profile.streakDays}</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-400" />{profile.stars}</span>
          </div>
        </div>
      </section>

      {/* Progress */}
      <section>
        <h2 className="mb-3 font-display font-bold text-ink">Dein Fortschritt</h2>
        {progress.data ? (
          <SkillBreakdown skills={progress.data.skillBreakdown} />
        ) : (
          <p className="text-sm text-ink-soft">Lädt …</p>
        )}
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
        <Row label="Legasthenie-Schrift">
          <Switch
            label="Legasthenie-Schrift"
            checked={profile.dyslexicFont}
            disabled={settings.isPending}
            onChange={(dyslexicFont) => settings.mutate({ dyslexicFont })}
          />
        </Row>
        <Row label="Schriftgröße">
          <div className="flex gap-2">
            {FONT_SCALES.map((f) => (
              <button
                key={f.value}
                type="button"
                disabled={settings.isPending}
                onClick={() => settings.mutate({ fontScale: f.value })}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 transition disabled:opacity-50',
                  Math.abs(profile.fontScale - f.value) < 0.01
                    ? 'bg-teal text-white ring-teal'
                    : 'bg-white text-ink ring-black/10',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Row>
      </section>

      {/* CTAs */}
      <section className="space-y-3">
        <Button variant="ghost" className="w-full justify-start" onClick={() => navigate('/app/chat')}>
          <MessageCircle className="h-5 w-5 text-teal-dark" /> Trainerin kontaktieren
        </Button>
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
