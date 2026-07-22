import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, isApiError } from '@/lib/api';
import { useActiveProfile, useMe } from '@/features/profile/useMe';
import { useUnits } from '@/features/units/useUnits';
import { useProgress } from '@/features/progress/useProgress';
import { useCreateSession } from '@/features/sessions/useCreateSession';
import { UnitCard } from '@/features/units/UnitCard';
import { Button } from '@/components/ui/button';
import { TopBar } from '@/app/components/TopBar';
import { WeekStrip } from '@/app/components/WeekStrip';
import { ErrorRetry } from '@/app/components/ErrorRetry';
import { buddyStateSrc, type BuddyState } from '@/lib/constants';
import { useBuddyState } from './useBuddyState';
import type { Progress } from '@/lib/types';

export function Lernen() {
  const navigate = useNavigate();
  const me = useMe();
  const profile = useActiveProfile();
  const units = useUnits(profile?.id);
  const progress = useProgress(profile?.id);
  const createSession = useCreateSession();
  const buddyState = useBuddyState(profile?.unlockedUnit, progress.data);
  const [lectureNote, setLectureNote] = useState<string | null>(null);

  if (me.isLoading) return <CenterNote>Lädt …</CenterNote>;
  if (me.isError) return <ErrorRetry error={me.error} onRetry={() => void me.refetch()} />;

  // Authenticated but no student profile yet → send them through onboarding.
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

  const toLesson = (session: unknown) => navigate('/app/lesson', { state: { session } });

  const startUnit = (unit: number) => {
    createSession.mutate({ profileId: profile.id, unit }, { onSuccess: toLesson });
  };

  // ✨ generated lecture: a teaching intro + fresh exercises, made for this student (takes a few seconds).
  // When the LLM is unavailable (503) we fall back to a normal bank session with a friendly note.
  const startLecture = () => {
    setLectureNote(null);
    createSession.mutate(
      { profileId: profile.id, source: 'llm' },
      {
        onSuccess: toLesson,
        onError: (err) => {
          if (isApiError(err) && err.status === 503) {
            setLectureNote('Die Zauber-Übungen machen gerade Pause – wir üben mit deinen normalen Aufgaben weiter!');
            createSession.mutate({ profileId: profile.id }, { onSuccess: toLesson });
          }
        },
      },
    );
  };

  const startingUnit = createSession.isPending ? createSession.variables?.unit : undefined;
  // Pending without a unit → the lecture card (or its bank fallback) is what's loading.
  const lectureBusy = createSession.isPending && createSession.variables?.unit === undefined;

  const todayIdx = (new Date().getDay() + 6) % 7;
  const weeklyActivity = progress.data?.weeklyActivity;
  const activeDaysThisWeek = weeklyActivity ? weeklyActivity.filter((n) => n > 0).length : 0;
  const todayDone = weeklyActivity ? (weeklyActivity[todayIdx] ?? 0) > 0 : false;

  return (
    <div className="space-y-5">
      <TopBar name={profile.name} streakDays={profile.streakDays} stars={profile.stars} jokerAvailable={profile.jokerAvailable} />
      {progress.data ? (
        <GoalCard
          activeDays={activeDaysThisWeek}
          goalPerWeek={profile.goalPerWeek}
          todayDone={todayDone}
          activity={weeklyActivity}
        />
      ) : (
        <WeekStrip />
      )}

      <BuddyCard buddy={profile.buddy} state={buddyState} />

      <button
        type="button"
        onClick={startLecture}
        disabled={createSession.isPending}
        className="flex w-full items-center gap-3 rounded-card bg-white p-4 text-left shadow-sm ring-1 ring-teal/30 transition active:scale-[0.99] disabled:opacity-70"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-tint text-2xl" aria-hidden>
          ✨
        </span>
        <div>
          <p className="font-display font-bold text-ink">Neue Übungen für dich</p>
          <p className="text-sm text-ink-soft">
            {lectureBusy ? 'Nepo denkt sich neue Übungen aus …' : 'Nepo erfindet Übungen genau für dich'}
          </p>
        </div>
      </button>

      {lectureNote && (
        <p role="status" className="text-center text-sm text-ink-soft">
          {lectureNote}
        </p>
      )}

      {units.isLoading && <CenterNote>Einheiten laden …</CenterNote>}
      {units.isError && <ErrorRetry error={units.error} onRetry={() => void units.refetch()} />}

      {units.data && (
        <div className="space-y-3">
          {units.data.map((u) => (
            <UnitCard key={u.unit} unit={u} onStart={startUnit} starting={startingUnit === u.unit} />
          ))}
        </div>
      )}

      {createSession.isError && (
        <p role="alert" className="text-center text-sm text-orange-dark">
          {errorMessage(createSession.error)}
        </p>
      )}
      {/* (The "Belohnung: Pixel" teaser card was removed — Pixel is freely selectable in the Profil
          buddy picker now, so "earn Pixel by finishing all units" no longer made sense.) */}
    </div>
  );
}

function CenterNote({ children }: { children: React.ReactNode }) {
  return <p className="py-16 text-center font-medium text-ink-soft">{children}</p>;
}

function GoalCard({
  activeDays,
  goalPerWeek,
  todayDone,
  activity,
}: {
  activeDays: number;
  goalPerWeek: number;
  todayDone: boolean;
  activity: Progress['weeklyActivity'] | undefined;
}) {
  return (
    <div className="rounded-card bg-white p-4 shadow-sm ring-1 ring-black/5 space-y-3">
      <div className="flex items-center gap-4">
        <GoalRing done={activeDays} total={goalPerWeek} />
        <div>
          <p className="font-display font-bold text-ink">
            {todayDone ? 'Heute geübt ✓' : 'Heute noch üben'}
          </p>
          <p className="text-sm text-ink-soft">
            {activeDays} von {goalPerWeek} {goalPerWeek === 1 ? 'Tag' : 'Tagen'} diese Woche
          </p>
        </div>
      </div>
      <WeekStrip activity={activity ?? undefined} />
    </div>
  );
}

function GoalRing({ done, total }: { done: number; total: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const fill = total > 0 ? Math.min(done, total) / total : 0;
  const dash = fill * circ;
  const complete = done >= total && total > 0;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden>
      <circle cx="26" cy="26" r={r} fill="none" stroke="#E5E7EB" strokeWidth="5" />
      {done > 0 && (
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={complete ? '#27A99B' : '#F0915F'}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
      )}
      <text x="26" y="31" textAnchor="middle" fontSize="12" fontWeight="700" fill="#27403C">
        {done}/{total}
      </text>
    </svg>
  );
}

const BUDDY_MESSAGES: Record<BuddyState, (name: string) => string> = {
  froehlich: () => 'Super, heute schon geübt! Noch eine Runde?',
  ueberrascht: () => 'Wow, eine neue Einheit wartet auf dich!',
  traurig: (name) => `${name} hat dich vermisst! Üben wir heute?`,
  cool: () => 'Schön, dass du da bist! Wähle eine Einheit und leg los.',
};

function BuddyCard({ buddy, state }: { buddy: string; state: BuddyState }) {
  const name = buddy.charAt(0).toUpperCase() + buddy.slice(1);
  return (
    <div className="flex items-center gap-3 rounded-card bg-teal-tint/70 p-4">
      <img src={buddyStateSrc(buddy, state)} alt="" className="h-10 w-10" />
      <p className="text-sm font-medium text-ink">{BUDDY_MESSAGES[state](name)}</p>
    </div>
  );
}
