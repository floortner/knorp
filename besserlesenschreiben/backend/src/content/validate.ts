import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL_TAGS } from '../contract/skills';
import { loadContentDir } from './loader';
import { diffSkillsLock } from './skills-lock';
import type { ContentError } from './parser';
import type { ParsedLecture } from './lecture-file.schema';

/**
 * Full content validation = lecture files + the skill-tag lock. Shared by `content:validate`
 * (the linguists' CI gate) and `content:import` (which refuses to touch the DB while ANY file is
 * invalid — a broken PR must never half-import).
 */

export interface ValidationResult {
  lectures: ParsedLecture[];
  errors: ContentError[];
}

const LOCK_DISPLAY = 'content/skills.lock.json';

function checkSkillsLock(contentDir: string): ContentError[] {
  const lockPath = join(contentDir, 'skills.lock.json');
  if (!existsSync(lockPath)) {
    return [
      {
        file: LOCK_DISPLAY,
        message: 'Datei fehlt — mit `npm run content:validate -- --update-skills-lock` erzeugen',
      },
    ];
  }

  let lock: unknown;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return [{ file: LOCK_DISPLAY, message: 'kein gültiges JSON' }];
  }
  if (!Array.isArray(lock) || !lock.every((t) => typeof t === 'string')) {
    return [{ file: LOCK_DISPLAY, message: 'erwartet wird eine Liste von Skill-Tags (Strings)' }];
  }

  const diff = diffSkillsLock(lock, SKILL_TAGS);
  const errors: ContentError[] = [];
  for (const tag of diff.added) {
    errors.push({
      file: LOCK_DISPLAY,
      message: `neuer Skill-Tag „${tag}" (contract/skills.ts) — bitte mit \`npm run content:validate -- --update-skills-lock\` in den Lock übernehmen, damit die Änderung im PR sichtbar ist`,
    });
  }
  for (const tag of diff.removed) {
    errors.push({
      file: LOCK_DISPLAY,
      message: `Skill-Tag „${tag}" wurde aus contract/skills.ts entfernt oder umbenannt. Die Lernstatistik (FSRS, Telemetrie, Digest) hängt an diesem Tag — Umbenennen verwaist die bisherigen Antworten. Wenn das beabsichtigt ist, entferne ihn im selben PR aus content/skills.lock.json (\`--update-skills-lock\`).`,
    });
  }
  return errors;
}

export function validateContent(contentDir: string): ValidationResult {
  const { lectures, errors } = loadContentDir(contentDir);
  return { lectures, errors: [...errors, ...checkSkillsLock(contentDir)] };
}
