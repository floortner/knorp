import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { useActiveProfile, useMe } from '@/features/profile/useMe';
import { useUnits } from '@/features/units/useUnits';
import { useCreateSession } from '@/features/sessions/useCreateSession';
import { UnitCard } from '@/features/units/UnitCard';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/app/components/TopBar';
import { WeekStrip } from '@/app/components/WeekStrip';

export function Lernen() {
  const navigate = useNavigate();
  const me = useMe();
  const profile = useActiveProfile();
  const units = useUnits(profile?.id);
  const createSession = useCreateSession();

  if (me.isLoading) return <CenterNote>Lädt …</CenterNote>;
  if (me.isError) return <CenterNote>{(me.error as ApiError).message}</CenterNote>;

  // Authenticated but no child profile yet → send them through onboarding.
  if (!profile) {
    return (
      <div className="py-16 text-center">
        <p className="font-medium text-ink-soft">Noch kein Profil angelegt.</p>
        <Button className="mt-4" onClick={() => navigate('/onboarding')}>
          Jetzt einrichten
        </Button>
      </div>
    );
  }

  const startUnit = (unit: number) => {
    createSession.mutate(
      { profileId: profile.id, unit },
      { onSuccess: (session) => navigate('/app/lesson', { state: { session } }) },
    );
  };
  const startingUnit = createSession.isPending ? createSession.variables?.unit : undefined;

  return (
    <div className="space-y-5">
      <TopBar name={profile.name} streakDays={profile.streakDays} stars={profile.stars} />
      <WeekStrip />

      <div className="flex items-center gap-3 rounded-card bg-teal-tint/70 p-4">
        <img src="/nepo.svg" alt="" className="h-10 w-10" />
        <p className="text-sm font-medium text-ink">
          Schön, dass du da bist! Wähle eine Einheit und leg los.
        </p>
      </div>

      {units.isLoading && <CenterNote>Einheiten laden …</CenterNote>}
      {units.isError && <CenterNote>{(units.error as ApiError).message}</CenterNote>}

      {units.data && (
        <div className="space-y-3">
          {units.data.map((u) => (
            <UnitCard key={u.unit} unit={u} onStart={startUnit} starting={startingUnit === u.unit} />
          ))}
        </div>
      )}

      {createSession.isError && (
        <p role="alert" className="text-center text-sm text-orange-dark">
          {(createSession.error as ApiError).message}
        </p>
      )}

      <div className="flex items-center gap-3 rounded-card border border-dashed border-teal/40 bg-white/50 p-4">
        <img src="/pixel.svg" alt="" className="h-10 w-10" />
        <div>
          <p className="font-display font-bold text-ink">Belohnung: Pixel</p>
          <p className="text-sm text-ink-soft">Schließe alle Einheiten ab</p>
        </div>
      </div>
    </div>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center font-medium text-ink-soft">{children}</p>;
}
