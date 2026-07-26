/**
 * Validate the lecture content library (`content/`, ROADMAP §I) — the linguists' CI feedback loop.
 *
 *   npm run content:validate                        # validate + check the skill-tag lock
 *   npm run content:validate -- --update-skills-lock  # rewrite the lock after a taxonomy change
 *
 * Output is German (the authors are linguists, not engineers); in GitHub Actions each error is
 * additionally emitted as a `::error file=…` annotation so it appears inline on the PR diff.
 * Exit code 1 on any error. CONTENT_DIR overrides the content directory (used by e2e fixtures).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKILL_TAGS } from '../src/contract/skills';
import { loadContentDir } from '../src/content/loader';
import { diffSkillsLock, renderSkillsLock } from '../src/content/skills-lock';
import type { ContentError } from '../src/content/parser';

const contentDir = resolve(process.env.CONTENT_DIR ?? join(__dirname, '..', '..', '..', 'content'));
const updateLock = process.argv.includes('--update-skills-lock');
const isGithub = process.env.GITHUB_ACTIONS === 'true';

function checkSkillsLock(): ContentError[] {
  const lockPath = join(contentDir, 'skills.lock.json');
  const lockFile = 'content/skills.lock.json';

  if (updateLock) {
    writeFileSync(lockPath, renderSkillsLock(SKILL_TAGS));
    console.log(`Skill-Tag-Lock aktualisiert: ${lockPath}`);
    return [];
  }

  if (!existsSync(lockPath)) {
    return [
      {
        file: lockFile,
        message: 'Datei fehlt — mit `npm run content:validate -- --update-skills-lock` erzeugen',
      },
    ];
  }

  let lock: unknown;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return [{ file: lockFile, message: 'kein gültiges JSON' }];
  }
  if (!Array.isArray(lock) || !lock.every((t) => typeof t === 'string')) {
    return [{ file: lockFile, message: 'erwartet wird eine Liste von Skill-Tags (Strings)' }];
  }

  const diff = diffSkillsLock(lock, SKILL_TAGS);
  const errors: ContentError[] = [];
  for (const tag of diff.added) {
    errors.push({
      file: lockFile,
      message: `neuer Skill-Tag „${tag}" (contract/skills.ts) — bitte mit \`npm run content:validate -- --update-skills-lock\` in den Lock übernehmen, damit die Änderung im PR sichtbar ist`,
    });
  }
  for (const tag of diff.removed) {
    errors.push({
      file: lockFile,
      message: `Skill-Tag „${tag}" wurde aus contract/skills.ts entfernt oder umbenannt. Die Lernstatistik (FSRS, Telemetrie, Digest) hängt an diesem Tag — Umbenennen verwaist die bisherigen Antworten. Wenn das beabsichtigt ist, entferne ihn im selben PR aus content/skills.lock.json (\`--update-skills-lock\`).`,
    });
  }
  return errors;
}

function printErrors(errors: ContentError[]): void {
  const byFile = new Map<string, ContentError[]>();
  for (const err of errors) {
    const list = byFile.get(err.file) ?? [];
    list.push(err);
    byFile.set(err.file, list);
  }
  for (const [file, fileErrors] of byFile) {
    console.error(`\nFEHLER in ${file}:`);
    for (const err of fileErrors) {
      console.error(err.path ? `  ${err.path}: ${err.message}` : `  ${err.message}`);
      if (isGithub) {
        const detail = err.path ? `${err.path}: ${err.message}` : err.message;
        console.log(`::error file=${err.file}::${detail}`);
      }
    }
  }
}

function main(): void {
  if (!existsSync(contentDir)) {
    console.error(`Content-Verzeichnis nicht gefunden: ${contentDir}`);
    process.exitCode = 1;
    return;
  }

  const { lectures, errors } = loadContentDir(contentDir);
  errors.push(...checkSkillsLock());

  if (errors.length > 0) {
    printErrors(errors);
    const files = new Set(errors.map((e) => e.file)).size;
    console.error(`\n${errors.length} Fehler in ${files} Datei(en). Details siehe oben — Format-Referenz: content/README.md`);
    process.exitCode = 1;
    return;
  }

  const drafts = lectures.filter((l) => l.status === 'draft').length;
  console.log(
    `${lectures.length} Lektion(en) geprüft, keine Fehler.` + (drafts > 0 ? ` (davon ${drafts} im Entwurf)` : ''),
  );
}

main();
