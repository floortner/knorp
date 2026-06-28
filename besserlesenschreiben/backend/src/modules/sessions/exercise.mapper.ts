import type { ItemBankModel } from '../../generated/prisma/models';

/**
 * Compose the wire `Exercise` the frontend renders from a stored `item_bank` row (SPEC §6/§8):
 *   Exercise = { id, type, ...payload, audioUrl, syllableAudio?, skillTags }
 * `payload` holds the per-type render fields (word, syll, options, answer, praise, …). `audioUrl` is
 * always present (null → client falls back to Web Speech); `syllableAudio` only when pre-generated.
 * Golden shape: `../frontend/fixtures/session.example.json`.
 */
export function toExercise(item: ItemBankModel): Record<string, unknown> {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  return {
    id: item.id,
    type: item.exerciseType,
    ...payload,
    audioUrl: item.audioUrl ?? null,
    ...(item.syllableAudio != null ? { syllableAudio: item.syllableAudio } : {}),
    skillTags: item.skillTags,
  };
}
