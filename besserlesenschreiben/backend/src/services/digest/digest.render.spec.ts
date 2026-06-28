import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDigestData,
  renderDigest,
  type DigestAttempt,
  type DigestProfile,
  type DueRow,
} from './digest.render';

const NOW = new Date('2026-06-25T12:00:00Z'); // window midpoint = 2026-06-18T12:00:00Z
const PROFILE: DigestProfile = {
  name: 'Mia',
  buddy: 'nepo',
  goalPerWeek: 5,
  soundOn: true,
  dyslexicFont: false,
  fontScale: 1.0,
};

function at(daysBack: number, skillTags: string[], isCorrect: boolean, timeMs: number, prompt: string, expected: string, given: string): DigestAttempt {
  return { skillTags, isCorrect, timeMs, prompt, expected, given, createdAt: new Date(NOW.getTime() - daysBack * 86_400_000) };
}

// Dataset chosen so every digest branch is exercised; the golden file is its exact rendering.
const ATTEMPTS: DigestAttempt[] = [
  at(12, ['vowel_ie'], false, 9000, 'Liebe', 'Liebe', 'Leibe'), // old half → 0% old
  at(2, ['vowel_ie'], false, 9000, 'Liebe', 'Liebe', 'Leibe'), // new half
  at(2, ['vowel_ie'], true, 9000, 'Wiese', 'Wiese', 'Wiese'), // new half → 50% new ⇒ trend ↑
  at(1, ['syllable_count'], true, 4000, 'Sommer', '2', '2'),
  at(1, ['syllable_count'], true, 4000, 'Banane', '3', '3'),
  at(1, ['syllable_count'], false, 4000, 'Sommer', '2', '3'),
  at(1, ['rhyme'], true, 2000, 'Maus', 'Haus', 'Haus'),
  at(1, ['rhyme'], true, 3000, 'Ball', 'Wall', 'Wall'),
];

const DUE: DueRow[] = [
  { skill: 'vowel_ie', examples: ['Liebe', 'Wiese'] },
  { skill: 'rhyme', examples: ['Maus'] },
];

describe('digest', () => {
  it('matches the golden digest.md', () => {
    const data = buildDigestData(PROFILE, ATTEMPTS, DUE, NOW, 14);
    const golden = readFileSync(join(__dirname, 'digest.golden.md'), 'utf-8');
    expect(renderDigest(data)).toBe(golden);
  });

  it('aggregates skills weakest-first with correct rate, avg time and trend', () => {
    const { skills } = buildDigestData(PROFILE, ATTEMPTS, DUE, NOW, 14);
    expect(skills.map((s) => s.skill)).toEqual(['vowel_ie', 'syllable_count', 'rhyme']);
    expect(skills[0]).toMatchObject({ attempts: 3, correctPct: 33, avgMs: 9000, trend: 'up' });
    expect(skills[2]).toMatchObject({ correctPct: 100, trend: 'flat' });
  });

  it('groups repeated mistakes with a count, most frequent first', () => {
    const { recentWrong } = buildDigestData(PROFILE, ATTEMPTS, DUE, NOW, 14);
    expect(recentWrong).toEqual([
      { prompt: 'Liebe', expected: 'Liebe', given: 'Leibe', count: 2 },
      { prompt: 'Sommer', expected: '2', given: '3', count: 1 },
    ]);
  });

  it('renders friendly empty states with no data', () => {
    const md = renderDigest(buildDigestData(PROFILE, [], [], NOW, 14));
    expect(md).toContain('Noch keine Versuche in diesem Zeitraum.');
    expect(md).toContain('- Keine Fehler in diesem Zeitraum. 🎉');
    expect(md).toContain('- Nichts fällig.');
  });

  it('reflects dyslexic-font preference in the header and preferences', () => {
    const md = renderDigest(buildDigestData({ ...PROFILE, dyslexicFont: true, fontScale: 1.2, soundOn: false }, [], [], NOW, 14));
    expect(md).toContain('Schrift: Legasthenie-Schrift ×1.2');
    expect(md).toContain('Ton: aus');
  });
});
