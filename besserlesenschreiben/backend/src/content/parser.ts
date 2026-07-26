import matter from 'gray-matter';
import { z } from 'zod';
import { solvableExerciseSchema } from '../contract/exercise';
import { exerciseHash, lectureHash } from './hash';
import {
  LECTURE_SLUG_RE,
  lectureFrontmatterSchema,
  toWireExercise,
  type ParsedLecture,
} from './lecture-file.schema';

/**
 * Lecture-file parser + validator. The audience for every error message is a linguist reading CI
 * output or `npm run content:validate` locally — German, concrete, and pointing at the exact field
 * (`exercises[0].answer: …`). All errors for a file are collected; never fail-fast.
 */

export interface ContentError {
  /** Display path of the offending file, e.g. `content/lectures/dehnungs-h.md`. */
  file: string;
  /** Dotted field path inside the frontmatter, e.g. `exercises[1].answer`. Absent for file-level errors. */
  path?: string;
  message: string;
}

export type ParseResult = { ok: true; lecture: ParsedLecture } | { ok: false; errors: ContentError[] };

function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

const GERMAN_TYPES: Record<string, string> = {
  string: 'Text',
  number: 'Zahl',
  int: 'ganze Zahl',
  boolean: 'Wahrheitswert',
  array: 'Liste',
  object: 'Objekt',
};

/** One Zod issue → one German sentence a non-engineer can act on. */
function issueToGerman(issue: z.core.$ZodIssue): string {
  const path = formatPath(issue.path);
  switch (issue.code) {
    case 'invalid_type': {
      const expected = GERMAN_TYPES[issue.expected] ?? issue.expected;
      return issue.input === undefined
        ? `Pflichtfeld fehlt (erwartet: ${expected})`
        : `falscher Typ — erwartet: ${expected}`;
    }
    case 'too_small': {
      if (issue.origin === 'string') return `zu kurz — mindestens ${issue.minimum} Zeichen`;
      if (issue.origin === 'array') return `zu wenige Einträge — mindestens ${issue.minimum}`;
      return `zu klein — mindestens ${issue.minimum}`;
    }
    case 'too_big': {
      if (issue.origin === 'string') return `zu lang — höchstens ${issue.maximum} Zeichen`;
      if (issue.origin === 'array') return `zu viele Einträge — höchstens ${issue.maximum}`;
      return `zu groß — höchstens ${issue.maximum}`;
    }
    case 'invalid_value': {
      const allowed = issue.values.map(String).join(' | ');
      return path.includes('skills')
        ? `unbekannter Skill-Tag — erlaubt: ${allowed}`
        : `ungültiger Wert — erlaubt: ${allowed}`;
    }
    case 'invalid_format':
      return path.endsWith('id')
        ? 'ungültige ID — erlaubt: Kleinbuchstaben a-z, Ziffern und Bindestriche (Beginn mit Buchstabe/Ziffer, höchstens 32 Zeichen)'
        : 'ungültiges Format';
    case 'unrecognized_keys':
      return issue.keys.length === 1
        ? `unbekanntes Feld: ${issue.keys[0]} — Tippfehler?`
        : `unbekannte Felder: ${issue.keys.join(', ')} — Tippfehler?`;
    default:
      return issue.message;
  }
}

function zodErrors(file: string, error: z.ZodError, pathPrefix = ''): ContentError[] {
  return error.issues.map((issue) => {
    const path = pathPrefix + formatPath(issue.path);
    return { file, path: path || undefined, message: issueToGerman(issue) };
  });
}

/** Parse + fully validate one lecture file. `sourcePath` is the display path, slug = basename. */
export function parseLectureFile(sourcePath: string, raw: string): ParseResult {
  const errors: ContentError[] = [];
  const fileName = sourcePath.split('/').pop() ?? sourcePath;
  const slug = fileName.replace(/\.md$/, '');

  if (!LECTURE_SLUG_RE.test(slug)) {
    errors.push({
      file: sourcePath,
      message: `ungültiger Dateiname „${fileName}" — erlaubt: Kleinbuchstaben a-z, Ziffern und Bindestriche (Beginn mit Buchstabe/Ziffer, höchstens 64 Zeichen), Endung .md`,
    });
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    return {
      ok: false,
      errors: [...errors, { file: sourcePath, message: `YAML-Frontmatter konnte nicht gelesen werden: ${reason}` }],
    };
  }

  if (Object.keys(parsed.data).length === 0) {
    return {
      ok: false,
      errors: [
        ...errors,
        { file: sourcePath, message: 'kein YAML-Frontmatter gefunden — die Datei muss mit einem „---"-Block beginnen (siehe content/lectures/_vorlage.md)' },
      ],
    };
  }

  const front = lectureFrontmatterSchema.safeParse(parsed.data);
  if (!front.success) {
    return { ok: false, errors: [...errors, ...zodErrors(sourcePath, front.error)] };
  }

  const seenIds = new Set<string>();
  front.data.exercises.forEach((ex, i) => {
    if (seenIds.has(ex.id)) {
      errors.push({
        file: sourcePath,
        path: `exercises[${i}].id`,
        message: `doppelte Aufgaben-ID „${ex.id}" — IDs müssen innerhalb der Lektion eindeutig sein`,
      });
    }
    seenIds.add(ex.id);

    // The §H solvability invariant, applied to file content: compose the wire exercise and gate it.
    const solvable = solvableExerciseSchema.safeParse(toWireExercise(ex));
    if (!solvable.success) {
      for (const issue of solvable.error.issues) {
        const german =
          issue.code === 'custom' && issue.message.includes('is not among options')
            ? `Antwort „${ex.answer}" ist nicht in den Antwortmöglichkeiten (options) enthalten`
            : issueToGerman(issue);
        errors.push({ file: sourcePath, path: `exercises[${i}].${formatPath(issue.path)}`, message: german });
      }
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const skillTags = [...new Set(front.data.exercises.flatMap((ex) => ex.skills))];
  const contentHash = lectureHash({
    title: front.data.title,
    intro: front.data.intro,
    exercises: front.data.exercises.map((ex) => ({ id: ex.id, hash: exerciseHash(ex) })),
  });

  return {
    ok: true,
    lecture: {
      slug,
      sourcePath,
      title: front.data.title,
      intro: front.data.intro,
      status: front.data.status,
      exercises: front.data.exercises,
      skillTags,
      contentHash,
      body: parsed.content.trim(),
    },
  };
}
