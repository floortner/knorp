/**
 * digest.md — the compact, LLM-facing performance view (SPEC §6). Two pure steps so both are
 * golden-testable: `buildDigestData` rolls the raw attempt rows into a summary, `renderDigest`
 * formats it as the pinned markdown. No DB, no I/O, fully deterministic (stable sort orders, fixed
 * number formatting) so the golden file only changes when the contract intentionally changes.
 */

import { winsorizeMs } from '../../common/time-ms';

const DAY_MS = 86_400_000;
const TREND_THRESHOLD = 5; // ±percentage points of correct-rate to count as a real trend
const MAX_RECENT_WRONG = 8;

export type Trend = 'up' | 'down' | 'flat';

/** One attempt row, reduced to what the digest needs. */
export interface DigestAttempt {
  skillTags: string[];
  isCorrect: boolean;
  timeMs: number;
  prompt: string;
  expected: string;
  given: string;
  createdAt: Date;
}

export interface DigestProfile {
  name: string;
  buddy: string;
  goalPerWeek: number;
  soundOn: boolean;
  dyslexicFont: boolean;
  fontScale: number;
}

export interface SkillRow {
  skill: string;
  attempts: number;
  correctPct: number;
  avgMs: number;
  trend: Trend;
}

export interface WrongRow {
  prompt: string;
  expected: string;
  given: string;
  count: number;
}

export interface DueRow {
  skill: string;
  examples: string[];
}

/** A recent staff-assigned lecture (§H3.3) — title + tags + outcome only, no names (LLM-facing). */
export interface AssignedRow {
  title: string;
  skillTags: string[];
  completed: boolean;
  correctPct: number | null; // attempt-level, null while open or when nothing was answered
}

export interface DigestData {
  profile: DigestProfile;
  windowDays: number;
  skills: SkillRow[];
  recentWrong: WrongRow[];
  due: DueRow[];
  assigned: AssignedRow[];
}

/** Roll raw attempts (already filtered to the window) into the digest summary. */
export function buildDigestData(
  profile: DigestProfile,
  attempts: readonly DigestAttempt[],
  due: readonly DueRow[],
  assigned: readonly AssignedRow[],
  now: Date,
  windowDays: number,
): DigestData {
  const midpoint = now.getTime() - (windowDays / 2) * DAY_MS;

  const agg = new Map<string, { n: number; correct: number; time: number; oldN: number; oldCorrect: number; newN: number; newCorrect: number }>();
  for (const a of attempts) {
    for (const tag of a.skillTags) {
      const s = agg.get(tag) ?? { n: 0, correct: 0, time: 0, oldN: 0, oldCorrect: 0, newN: 0, newCorrect: 0 };
      s.n += 1;
      s.time += winsorizeMs(a.timeMs); // §J5.1: „Ø Zeit" reads robustly, not raw
      if (a.isCorrect) s.correct += 1;
      const recent = a.createdAt.getTime() >= midpoint;
      if (recent) {
        s.newN += 1;
        if (a.isCorrect) s.newCorrect += 1;
      } else {
        s.oldN += 1;
        if (a.isCorrect) s.oldCorrect += 1;
      }
      agg.set(tag, s);
    }
  }

  const skills: SkillRow[] = [];
  for (const [skill, s] of agg) {
    skills.push({
      skill,
      attempts: s.n,
      correctPct: Math.round((s.correct / s.n) * 100),
      avgMs: Math.round(s.time / s.n),
      trend: trendOf(s.oldN ? (s.oldCorrect / s.oldN) * 100 : null, s.newN ? (s.newCorrect / s.newN) * 100 : null),
    });
  }
  skills.sort((a, b) => a.correctPct - b.correctPct || b.attempts - a.attempts || cmp(a.skill, b.skill));

  const wrongAgg = new Map<string, WrongRow>();
  for (const a of attempts) {
    if (a.isCorrect) continue;
    const key = `${a.prompt}\u0000${a.expected}\u0000${a.given}`;
    const w = wrongAgg.get(key) ?? { prompt: a.prompt, expected: a.expected, given: a.given, count: 0 };
    w.count += 1;
    wrongAgg.set(key, w);
  }
  const recentWrong = [...wrongAgg.values()]
    .sort((a, b) => b.count - a.count || cmp(a.prompt, b.prompt))
    .slice(0, MAX_RECENT_WRONG);

  return { profile, windowDays, skills, recentWrong, due: [...due], assigned: [...assigned] };
}

/** Format the summary as the pinned digest.md markdown (the golden contract). */
export function renderDigest(d: DigestData): string {
  const p = d.profile;
  const schrift = p.dyslexicFont ? `Legasthenie-Schrift ×${fmtScale(p.fontScale)}` : `Standard ×${fmtScale(p.fontScale)}`;
  const lines: string[] = [];

  // No student name here: the digest is sent to the LLM and the name plays no role in generation, so we
  // keep this minor's PII off the third-party processor (security review P2-5). The buddy is a
  // non-identifying preference; student-facing personalisation stays client-side.
  lines.push(`# Lernprofil · Buddy ${p.buddy} · Ziel ${p.goalPerWeek}×/Woche · Schrift: ${schrift}`);
  lines.push('');

  lines.push(`## Letzte ${d.windowDays} Tage`);
  if (d.skills.length === 0) {
    lines.push('Noch keine Versuche in diesem Zeitraum.');
  } else {
    lines.push('| Skill | Versuche | Richtig % | Ø Zeit | Trend |');
    lines.push('|-------|---------:|----------:|-------:|-------|');
    for (const s of d.skills) {
      lines.push(`| ${s.skill} | ${s.attempts} | ${s.correctPct}% | ${fmtSec(s.avgMs)}s | ${arrow(s.trend)} |`);
    }
  }
  lines.push('');

  lines.push('## Zuletzt falsch (Wiederholung nötig)');
  if (d.recentWrong.length === 0) {
    lines.push('- Keine Fehler in diesem Zeitraum. 🎉');
  } else {
    for (const w of d.recentWrong) {
      lines.push(`- "${w.prompt}" → "${w.given}" statt "${w.expected}" (${w.count}×)`);
    }
  }
  lines.push('');

  lines.push('## Fällig laut FSRS');
  if (d.due.length === 0) {
    lines.push('- Nichts fällig.');
  } else {
    for (const r of d.due) {
      const examples = r.examples.length ? `: ${r.examples.join(', ')}` : '';
      lines.push(`- ${r.skill}${examples}`);
    }
  }
  lines.push('');

  // §H3.3 — the trainer's assigned lectures, so generated lectures BUILD ON the trainer's material
  // instead of ignoring it. Titles + tags + outcome only; no dates, no names (deterministic + P2-5).
  lines.push('## Zugewiesene Übungen');
  if (d.assigned.length === 0) {
    lines.push('- Keine zugewiesenen Übungen.');
  } else {
    for (const a of d.assigned) {
      const outcome = a.completed
        ? a.correctPct !== null
          ? `erledigt, ${a.correctPct}% richtig`
          : 'erledigt'
        : 'offen';
      lines.push(`- "${a.title}" (${a.skillTags.join(', ')}) — ${outcome}`);
    }
  }
  lines.push('');

  lines.push('## Präferenzen');
  lines.push(`- Ton: ${p.soundOn ? 'an' : 'aus'} · Buddy: ${p.buddy} · Schrift: ${schrift}`);

  return lines.join('\n') + '\n';
}

function trendOf(oldPct: number | null, newPct: number | null): Trend {
  if (oldPct === null || newPct === null) return 'flat';
  const delta = newPct - oldPct;
  if (delta > TREND_THRESHOLD) return 'up';
  if (delta < -TREND_THRESHOLD) return 'down';
  return 'flat';
}

function arrow(t: Trend): string {
  return t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
}

function fmtSec(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function fmtScale(scale: number): string {
  return Number.isInteger(scale) ? `${scale}.0` : String(scale);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
