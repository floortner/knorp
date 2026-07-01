import { z } from 'zod';

/**
 * The skill-tag taxonomy — the spine of the adaptive engine. Skill tags drive FSRS scheduling
 * (`review_state.skill_tag`), the digest's per-skill roll-up, and LLM lecture targeting. They were
 * previously free-form strings documented only in `item_bank.seed.json`; promoting them to a typed enum
 * lets the Exercise contract reject unknown tags, so seed content and LLM output can't silently invent a
 * skill that then never gets drilled.
 *
 * Grouped by unit focus (SPEC §8 / units.catalog). The last four were added with the Phase-1.6 exercise
 * types (swipe/odd/listen/sentence) and were missing from the original taxonomy doc.
 */
export const SKILL_TAGS = [
  // Silben
  'syllable_count',
  'syllable_segmentation',
  'syllable_gap',
  'syllable_order',
  // Reime
  'rhyme',
  'rhyme_pairs',
  // Laute & Buchstaben
  'phoneme_initial',
  'phoneme_position',
  'letter_sound',
  // Groß/klein & Wortarten
  'capitalization',
  'word_class_noun',
  'word_class_verb',
  // Ordnen & Rechtschreibung
  'letter_order',
  'spelling',
  // Echtwort / Unterscheidung / Vokale
  'lexical_decision',
  'letter_discrimination',
  'vowel_ie',
  'vowel_ei',
  'vowel_spelling',
  // Phase 1.6 additions (swipe / odd / listen / sentence)
  'binary_sort',
  'odd_one_out',
  'phonological_awareness',
  'word_in_context',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

/** A single validated skill tag — rejects anything outside the taxonomy. */
export const skillTagSchema = z.enum(SKILL_TAGS);

export const SKILL_TAG_SET: ReadonlySet<string> = new Set(SKILL_TAGS);
