import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseLectureFile, type ContentError } from './parser';
import type { ParsedLecture } from './lecture-file.schema';

/**
 * Load every lecture file from a content directory (`<contentDir>/lectures/*.md`). Files starting
 * with `_` (the template) are skipped. All files are parsed and ALL errors collected — a broken
 * file never hides the errors of the next one.
 */

export interface LoadResult {
  lectures: ParsedLecture[];
  errors: ContentError[];
}

export function loadContentDir(contentDir: string): LoadResult {
  const lecturesDir = join(contentDir, 'lectures');
  // Display paths are anchored at the content dir's basename (`content/lectures/x.md`) — what a
  // linguist sees on GitHub, and what the CI annotation needs relative to the repo root.
  const displayBase = basename(contentDir);

  if (!existsSync(lecturesDir)) {
    return {
      lectures: [],
      errors: [{ file: `${displayBase}/lectures`, message: `Verzeichnis nicht gefunden: ${lecturesDir}` }],
    };
  }

  const files = readdirSync(lecturesDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort();

  const lectures: ParsedLecture[] = [];
  const errors: ContentError[] = [];

  for (const file of files) {
    const raw = readFileSync(join(lecturesDir, file), 'utf8');
    const result = parseLectureFile(`${displayBase}/lectures/${file}`, raw);
    if (result.ok) lectures.push(result.lecture);
    else errors.push(...result.errors);
  }

  return { lectures, errors };
}
