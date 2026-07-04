// Mirrors backend src/contract/skills.ts (SKILL_TAGS) — the reviewer's single source for the taxonomy.
// The backend validates writes, so any drift from the contract surfaces as a 400.
export const SKILL_TAGS = [
  'vowel_identify', 'vowel_length', 'vowel_substitution', 'word_raster', 'lexical_decision',
  'syllable_validity', 'syllable_segmentation', 'visual_discrimination', 'compound_word',
  'word_family', 'article', 'sentence_context', 'dehnung_h', 'double_consonant',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

/**
 * Plain-language help for every skill (FRESCH-style Vokaltraining). Keyed by SkillTag as a total Record,
 * so adding a tag to SKILL_TAGS without a description here is a COMPILE error — no silent drift.
 */
export const SKILL_INFO: Record<SkillTag, { name: string; desc: string }> = {
  vowel_identify: { name: 'Selbstlaut finden', desc: 'Den Selbstlaut (Vokal) im Wort erkennen.' },
  vowel_length: { name: 'Vokallänge', desc: 'Kurz (Doppelkonsonant/Stopper) oder lang (offene Silbe, ie, Dehnungs-h)?' },
  vowel_substitution: { name: 'Selbstlaut tauschen', desc: 'Den Vokal austauschen → neues Wort (Hend → Hand).' },
  word_raster: { name: 'Wortraster', desc: 'Einsilbige Wörter: Anfang · Selbstlaut · Ende.' },
  lexical_decision: { name: 'Echt oder Quatsch', desc: 'Ein echtes Wort von einem Quatschwort unterscheiden.' },
  syllable_validity: { name: 'Silbe gültig?', desc: 'Kann die Silbe klingen? Jede Silbe braucht einen Selbstlaut.' },
  syllable_segmentation: { name: 'Silben zerlegen', desc: 'Ein Wort in Silben zerlegen und wieder zusammensetzen.' },
  visual_discrimination: { name: 'Genau hinschauen', desc: 'Gleich oder anders? Wortpaare vergleichen.' },
  compound_word: { name: 'Zusammengesetzte Wörter', desc: 'Holz + Treppe → Holztreppe; der Artikel kommt vom Grundwort.' },
  word_family: { name: 'Wortfamilie', desc: 'Gemeinsamer Wortstamm – die Schreibung ableiten (fahren → Fahrrad).' },
  article: { name: 'Artikel', desc: 'Den richtigen Artikel (der/die/das) zum Nomen wählen.' },
  sentence_context: { name: 'Satzzusammenhang', desc: 'Das Wort im Satz erkennen oder korrigieren.' },
  dehnung_h: { name: 'Dehnungs-h', desc: 'Dehnungs-h / stummes H als Zeichen für einen langen Vokal (Jahr, sehen).' },
  double_consonant: { name: 'Doppelkonsonant', desc: 'Silbengelenk als Zeichen für einen kurzen Vokal (kommen, Wasser).' },
};
