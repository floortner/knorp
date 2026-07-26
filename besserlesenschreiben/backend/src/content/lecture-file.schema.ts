import { z } from 'zod';
import { skillTagSchema } from '../contract/skills';
import type { Exercise } from '../contract/exercise';

/**
 * The lecture-file frontmatter contract (ROADMAP §I): one markdown file per lecture in
 * `content/lectures/<slug>.md`, YAML frontmatter holds all structured data, the body is reserved
 * for future richer prose. English keys mirror the wire contract 1:1; the linguist-facing docs and
 * validation errors are German (content/README.md, parser.ts).
 *
 * Both objects are `.strict()` on purpose: a typo'd key (`optionss`) must fail loudly for the
 * authors, never be silently ignored.
 */

/** The filename-derived lecture slug — the durable natural key for versioning + telemetry. */
export const LECTURE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
/** Per-exercise id, unique within its file — `{slug}.{id}` anchors the item across versions. */
export const EXERCISE_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// Authored exercise: the placeholder wire shape minus backend-owned media fields, plus the stable
// `id` and optional `difficulty`. Bounds match the retired portal authoring input (contract §H).
export const lectureFileExerciseSchema = z
  .object({
    id: z.string().regex(EXERCISE_ID_RE),
    type: z.literal('placeholder'),
    prompt: z.string().min(1).max(2000),
    options: z.array(z.string().min(1).max(200)).min(2).max(8),
    answer: z.string().min(1).max(200),
    praise: z.string().min(1).max(200),
    skills: z.array(skillTagSchema).min(1).max(10),
    difficulty: z.number().int().min(1).max(3).default(1),
  })
  .strict();

export type LectureFileExercise = z.infer<typeof lectureFileExerciseSchema>;

export const lectureFrontmatterSchema = z
  .object({
    title: z.string().min(1).max(200),
    // The Merksatz — plain text, same bound as the LLM lecture's generated intro (wire-compatible).
    intro: z.string().min(1).max(300),
    // Merged to main = live at the next deploy; `draft` imports browsable but unassignable.
    status: z.enum(['draft', 'published']).default('published'),
    exercises: z.array(lectureFileExerciseSchema).min(1).max(12),
  })
  .strict();

export type LectureFrontmatter = z.infer<typeof lectureFrontmatterSchema>;

/** A parsed, fully validated lecture file — the unit the validator reports and the import consumes. */
export interface ParsedLecture {
  slug: string;
  /** Display/annotation path, e.g. `content/lectures/dehnungs-h.md` (relative to the content dir's parent). */
  sourcePath: string;
  title: string;
  intro: string;
  status: 'draft' | 'published';
  exercises: LectureFileExercise[];
  /** Union of the exercises' skills, first-seen order — computed, never authored (no drift). */
  skillTags: string[];
  /** Canonical lecture content hash (hash.ts) — the import's same-or-new-version test. */
  contentHash: string;
  /** Markdown body below the frontmatter — reserved, currently stored nowhere. */
  body: string;
}

/**
 * Compose the wire `Exercise` from an authored one, exactly like the retired staff authoring path
 * did — so `solvableExerciseSchema` can gate file content with the same §H invariant: an
 * unanswerable item can never enter the system, regardless of author.
 */
export function toWireExercise(ex: LectureFileExercise): Exercise {
  return {
    id: ex.id,
    type: ex.type,
    prompt: ex.prompt,
    options: ex.options,
    answer: ex.answer,
    praise: ex.praise,
    skillTags: ex.skills,
    audioUrl: null,
  };
}
