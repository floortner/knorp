import { z } from 'zod';

/**
 * The skill-tag taxonomy — the spine of the adaptive engine. Skill tags drive FSRS scheduling
 * (`review_state.skill_tag`), the digest's per-skill roll-up, and LLM lecture targeting. A typed enum
 * lets the Exercise contract reject unknown tags, so seed content and LLM output can't silently invent a
 * skill that then never gets drilled.
 *
 * Taxonomy of the Vokaltraining program (FRESCH-style; SPEC §8 / units.catalog): vowels are the anchor of
 * every strategy — find them, judge their length, swap them, and build words and compounds around them.
 */
export const SKILL_TAGS = [
  // Vokale finden & einsetzen (Wortraster, Selbstlaute)
  'vowel_identify',
  'vowel_length',
  'vowel_substitution',
  'word_raster',
  // Echtwort & Silben
  'lexical_decision',
  'syllable_validity',
  'syllable_segmentation',
  'visual_discrimination',
  // Wortbau & Strategien
  'compound_word',
  'word_family',
  'article',
  'sentence_context',
  'dehnung_h',
  'double_consonant',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

/** A single validated skill tag — rejects anything outside the taxonomy. */
export const skillTagSchema = z.enum(SKILL_TAGS);

export const SKILL_TAG_SET: ReadonlySet<string> = new Set(SKILL_TAGS);
