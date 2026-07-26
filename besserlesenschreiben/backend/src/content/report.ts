import type { ContentError } from './parser';

/**
 * Render validation errors for the two CLIs (`content:validate`, `content:import`). Pure formatting —
 * the scripts decide where the lines go (stderr vs. GitHub `::error` annotations on stdout).
 */

/** Grouped, human-readable German error lines (for stderr). */
export function formatContentErrors(errors: ContentError[]): string[] {
  const byFile = new Map<string, ContentError[]>();
  for (const err of errors) {
    const list = byFile.get(err.file) ?? [];
    list.push(err);
    byFile.set(err.file, list);
  }
  const lines: string[] = [];
  for (const [file, fileErrors] of byFile) {
    lines.push('', `FEHLER in ${file}:`);
    for (const err of fileErrors) {
      lines.push(err.path ? `  ${err.path}: ${err.message}` : `  ${err.message}`);
    }
  }
  const files = byFile.size;
  lines.push('', `${errors.length} Fehler in ${files} Datei(en). Format-Referenz: content/README.md`);
  return lines;
}

/** GitHub Actions workflow-command lines — one inline PR annotation per error (for stdout). */
export function formatGithubAnnotations(errors: ContentError[]): string[] {
  return errors.map((err) => {
    const detail = err.path ? `${err.path}: ${err.message}` : err.message;
    return `::error file=${err.file}::${detail}`;
  });
}
