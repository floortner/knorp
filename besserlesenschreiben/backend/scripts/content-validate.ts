/**
 * Validate the lecture content library (`content/`, ROADMAP §I) — the linguists' CI feedback loop.
 *
 *   npm run content:validate                          # validate + check the skill-tag lock
 *   npm run content:validate -- --update-skills-lock  # rewrite the lock after a taxonomy change
 *
 * Output is German (the authors are linguists, not engineers); in GitHub Actions each error is
 * additionally emitted as a `::error file=…` annotation so it appears inline on the PR diff.
 * Exit code 1 on any error. CONTENT_DIR overrides the content directory (used by e2e fixtures).
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKILL_TAGS } from '../src/contract/skills';
import { validateContent } from '../src/content/validate';
import { formatContentErrors, formatGithubAnnotations } from '../src/content/report';
import { renderSkillsLock } from '../src/content/skills-lock';

const contentDir = resolve(process.env.CONTENT_DIR ?? join(__dirname, '..', '..', '..', 'content'));

function main(): void {
  if (!existsSync(contentDir)) {
    console.error(`Content-Verzeichnis nicht gefunden: ${contentDir}`);
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes('--update-skills-lock')) {
    const lockPath = join(contentDir, 'skills.lock.json');
    writeFileSync(lockPath, renderSkillsLock(SKILL_TAGS));
    console.log(`Skill-Tag-Lock aktualisiert: ${lockPath}`);
  }

  const { lectures, errors } = validateContent(contentDir);

  if (errors.length > 0) {
    for (const line of formatContentErrors(errors)) console.error(line);
    if (process.env.GITHUB_ACTIONS === 'true') {
      for (const line of formatGithubAnnotations(errors)) console.log(line);
    }
    process.exitCode = 1;
    return;
  }

  const drafts = lectures.filter((l) => l.status === 'draft').length;
  console.log(
    `${lectures.length} Lektion(en) geprüft, keine Fehler.` + (drafts > 0 ? ` (davon ${drafts} im Entwurf)` : ''),
  );
}

main();
