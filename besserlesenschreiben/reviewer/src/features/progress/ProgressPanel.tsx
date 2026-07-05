import { cn } from '@/lib/cn';
import { decisionTone } from '@/lib/decision';
import type { ProfileProgress } from '@/lib/contract';

/** The identity-agnostic progress payload (shared by the account + queue variants). */
type ProgressData = Pick<ProfileProgress, 'summary' | 'skills' | 'activity'>;

const de = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('de-AT') : '—');

/** Renders one learner's progress: summary, per-skill mastery, and recent activity + homework history. */
export function ProgressPanel({ data }: { data: ProgressData }) {
  const { summary, skills, activity } = data;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-soft">
        <Stat label="Einheit" value={summary.unit} />
        <Stat label="🔥 Serie" value={`${summary.streakDays} Tage`} />
        <Stat label="⭐ Sterne" value={summary.stars} />
        <Stat label="Liga" value={<span className="capitalize">{summary.league.tier}</span>} />
        <Stat label="Zuletzt aktiv" value={de(summary.lastActive)} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-soft">
        <Stat label="Aufgaben gesamt" value={activity.totalAttempts} />
        <Stat label="Sitzungen (7 T.)" value={activity.sessions7d} />
        <Stat label="Sitzungen (30 T.)" value={activity.sessions30d} />
      </div>

      {skills.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">Skills — schwächste zuerst</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s.skill}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  s.due ? 'bg-amber-tint text-amber' : 'bg-black/[0.04] text-ink-soft',
                )}
                title={s.due ? 'FSRS: fällig zur Wiederholung' : undefined}
              >
                {s.skill} <b className="text-ink">{s.correctPct}%</b> ({s.attempts}){s.due ? ' • fällig' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {activity.homework.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-soft">Hausübungen — neueste zuerst</p>
          <ul className="space-y-0.5">
            {activity.homework.map((h) => (
              <li key={h.uploadId} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-ink-soft">{de(h.createdAt)}</span>
                <span className="text-ink">{h.status}</span>
                {h.decision && (
                  <span className={cn('rounded-full px-1.5 py-0.5', decisionTone(h.decision))}>{h.decision}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span>
      {label}: <b className="text-ink">{value}</b>
    </span>
  );
}
