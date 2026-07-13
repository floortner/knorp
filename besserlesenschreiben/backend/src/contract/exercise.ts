import { z } from 'zod';
import { skillTagSchema } from './skills';

/**
 * The wire `Exercise` discriminated union — the single source of truth published to `openapi.json` and
 * typed into the frontends via `api.gen.ts`. The Vokaltraining content set (14 exercise types, word lists,
 * unit sequence, lecture prompt) was dropped; the approach is being redesigned from scratch.
 *
 * `placeholder` is a stand-in single-choice type that keeps the contract pipeline, the solvability-gated
 * validation used for seed/LLM content, and `EXERCISE_TYPES` (consumed by content pruning) wired
 * end-to-end. Replace it — and grow the union — as new training types are designed.
 */

// Fields every served exercise carries (added by the backend's exercise mapper).
const media = {
  id: z.string(),
  audioUrl: z.string().nullable(),
  syllableAudio: z.array(z.string()).nullable().optional(),
  skillTags: z.array(skillTagSchema).min(1),
  praise: z.string(),
};

const placeholder = z.object({
  type: z.literal('placeholder'),
  prompt: z.string(),
  options: z.array(z.string()).min(2),
  answer: z.string(),
  ...media,
});

export const exerciseSchema = z.discriminatedUnion('type', [placeholder]);
export type Exercise = z.infer<typeof exerciseSchema>;

/**
 * The Exercise contract PLUS per-type solvability — every generated/seeded exercise must be unambiguously
 * answerable. Use this to validate content (LLM output, seed rows, golden fixtures); use the plain
 * `exerciseSchema` for the wire/OpenAPI shape (JSON Schema can't encode these cross-field rules).
 */
export const solvableExerciseSchema = exerciseSchema.superRefine((ex, ctx) => {
  if (ex.type === 'placeholder' && !ex.options.includes(ex.answer)) {
    ctx.addIssue({ code: 'custom', message: `answer "${ex.answer}" is not among options`, path: ['answer'] });
  }
});

/** The exercise type discriminants, for tests/iteration. */
export const EXERCISE_TYPES = ['placeholder'] as const;
