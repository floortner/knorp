import { z } from 'zod';

/**
 * The skill-tag taxonomy — the spine of the adaptive engine. Skill tags drive FSRS scheduling
 * (`review_state.skill_tag`), the digest's per-skill roll-up, and LLM lecture targeting. A typed enum
 * lets the Exercise contract reject unknown tags, so seed content and LLM output can't silently invent a
 * skill that then never gets drilled.
 *
 * The Vokaltraining taxonomy was dropped along with its word lists and training types — the approach is
 * being redesigned from scratch. `placeholder` keeps the contract (and FSRS/digest/LLM plumbing that key
 * off a non-empty tag) wired end-to-end; replace with the new taxonomy as training types are designed.
 */
export const SKILL_TAGS = ['placeholder'] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

/** A single validated skill tag — rejects anything outside the taxonomy. */
export const skillTagSchema = z.enum(SKILL_TAGS);

export const SKILL_TAG_SET: ReadonlySet<string> = new Set(SKILL_TAGS);
