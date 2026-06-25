/**
 * scripts/build-seed.ts — regenerates item_bank.seed.json from the prototype's LESSONS.
 * LESSONS below is transcribed verbatim from knorp.html (the Claude Design export).
 * Run:  npx tsx scripts/build-seed.ts   ->  writes ../item_bank.seed.json
 *
 * Keep this as the source of truth: edit lessons / tagging here and re-run, rather than
 * hand-editing the JSON.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Item = Record<string, unknown> & { type: string };

// ---------------------------------------------------------------------------
// Verbatim from the prototype (7 units). Order preserved.
// ---------------------------------------------------------------------------
const LESSONS: Item[][] = [
  // Unit 1 — Silben (syllables)
  [
    { type: "count", word: "Sommer", syll: ["Som", "mer"], answer: 2, opts: [2, 3, 4], praise: "Richtig! Som·mer – zwei Silben." },
    { type: "gap", word: "Banane", syll: ["Ba", "na", "ne"], gapIndex: 1, answer: "na", options: ["na", "mo", "le"], praise: "Genau! Ba·na·ne ist komplett." },
    { type: "order", word: "Schmetterling", syll: ["Schmet", "ter", "ling"], tiles: ["ter", "Schmet", "ling"], praise: "Super! Schmet·ter·ling sitzt." },
    { type: "gap", word: "Tomate", syll: ["To", "ma", "te"], gapIndex: 1, answer: "ma", options: ["ma", "mi", "lo"], praise: "Stark! To·ma·te – perfekt ergänzt." },
  ],
  // Unit 2 — Silben (Fortsetzung)
  [
    { type: "count", word: "Elefant", syll: ["E", "le", "fant"], answer: 3, opts: [2, 3, 4], praise: "Richtig! E·le·fant – drei Silben." },
    { type: "order", word: "Kartoffel", syll: ["Kar", "tof", "fel"], tiles: ["tof", "fel", "Kar"], praise: "Super! Kar·tof·fel sitzt." },
    { type: "gap", word: "Marmelade", syll: ["Mar", "me", "la", "de"], gapIndex: 1, answer: "me", options: ["me", "ma", "mo"], praise: "Genau! Mar·me·la·de ist komplett." },
    { type: "count", word: "Sonnenblume", syll: ["Son", "nen", "blu", "me"], answer: 4, opts: [3, 4, 5], praise: "Stark! Son·nen·blu·me – vier Silben." },
  ],
  // Unit 3 — Reime (rhymes)
  [
    { type: "rhyme", word: "Maus", options: ["Haus", "Tisch", "Ball"], answer: "Haus", praise: "Genau! Maus reimt sich auf Haus." },
    { type: "rhyme", word: "Baum", options: ["Traum", "Hund", "Stein"], answer: "Traum", praise: "Super! Baum reimt sich auf Traum." },
    { type: "rhyme", word: "Sonne", options: ["Tonne", "Blume", "Wolke"], answer: "Tonne", praise: "Genau! Sonne reimt sich auf Tonne." },
    { type: "rhyme", word: "Schokolade", options: ["Marmelade", "Banane", "Kartoffel"], answer: "Marmelade", praise: "Stark! Schokolade reimt sich auf Marmelade." },
    { type: "rhyme", word: "Rakete", options: ["Trompete", "Tomate", "Kamel"], answer: "Trompete", praise: "Toll! Rakete reimt sich auf Trompete." },
  ],
  // Unit 4 — Anlaute & Buchstaben (initial sounds & letters)
  [
    { type: "initial", word: "Apfel", emoji: "🍎", answer: "A", options: ["A", "E", "O"], praise: "Richtig! Apfel beginnt mit A." },
    { type: "letter", word: "Sonne", letters: ["S", "o", "n", "n", "e"], gapIndex: 2, answer: "n", options: ["n", "m", "r"], praise: "Genau! In Sonne fehlt das n." },
    { type: "initial", word: "Igel", emoji: "🦔", answer: "I", options: ["I", "E", "U"], praise: "Stark! Igel beginnt mit I." },
    { type: "letter", word: "Hund", letters: ["H", "u", "n", "d"], gapIndex: 1, answer: "u", options: ["u", "a", "o"], praise: "Super! In Hund hörst du ein u." },
    { type: "initial", word: "Banane", emoji: "🍌", answer: "B", options: ["B", "P", "D"], praise: "Toll! Banane beginnt mit B." },
    { type: "letter", word: "Maus", letters: ["M", "a", "u", "s"], gapIndex: 3, answer: "s", options: ["s", "z", "f"], praise: "Genau! Maus endet mit s." },
  ],
  // Unit 5 — Groß/klein & Buchstabenreihenfolge (capitalization & letter order)
  [
    { type: "case", word: "Hund", emoji: "🐶", answer: "Hund", options: ["Hund", "hund"], praise: "Richtig! Hund ist ein Nomen – groß." },
    { type: "arrange", word: "Maus", syll: ["M", "a", "u", "s"], tiles: ["a", "s", "M", "u"], praise: "Super! M·a·u·s – richtig geordnet." },
    { type: "case", word: "springen", answer: "springen", options: ["Springen", "springen"], praise: "Genau! springen ist ein Tunwort – klein." },
    { type: "arrange", word: "Baum", syll: ["B", "a", "u", "m"], tiles: ["u", "B", "m", "a"], praise: "Stark! B·a·u·m sitzt." },
    { type: "case", word: "Blume", emoji: "🌸", answer: "Blume", options: ["blume", "Blume"], praise: "Richtig! Blume ist ein Nomen – groß." },
    { type: "arrange", word: "Fisch", syll: ["F", "i", "s", "ch"], tiles: ["s", "F", "ch", "i"], praise: "Toll! F·i·sch – geordnet." },
  ],
  // Unit 6 — Echtwort/Quatschwort & Reimpaare (lexical decision & rhyme pairs)
  [
    { type: "nonsense", word: "Tisch", answer: "Echtes Wort", options: ["Echtes Wort", "Quatschwort"], praise: "Richtig! Tisch gibt es wirklich." },
    { type: "pairs", tiles: ["Haus", "Tisch", "Maus", "Ball"], pair: ["Haus", "Maus"], praise: "Super! Haus und Maus reimen sich." },
    { type: "nonsense", word: "Lomp", answer: "Quatschwort", options: ["Echtes Wort", "Quatschwort"], praise: "Genau! Lomp ist ein Quatschwort." },
    { type: "pairs", tiles: ["Baum", "Hund", "Stein", "Traum"], pair: ["Baum", "Traum"], praise: "Stark! Baum und Traum reimen sich." },
    { type: "nonsense", word: "Sonne", answer: "Echtes Wort", options: ["Echtes Wort", "Quatschwort"], praise: "Richtig! Sonne gibt es wirklich." },
    { type: "pairs", tiles: ["Hose", "Katze", "Dose", "Tasse"], pair: ["Hose", "Dose"], praise: "Toll! Hose und Dose reimen sich." },
  ],
  // Unit 7 — b/d-Unterscheidung & ie/ei (letter discrimination & vowel spelling)
  [
    { type: "bd", glyph: "d", answer: "d", options: ["b", "d", "p"], praise: "Richtig! Das ist ein d – der Bauch zeigt nach rechts." },
    { type: "vowel", word: "Liebe", letters: ["L", "ie", "b", "e"], gapIndex: 1, answer: "ie", options: ["ie", "ei", "eu"], praise: "Genau! Liebe schreibt man mit ie." },
    { type: "bd", glyph: "b", answer: "b", options: ["b", "d", "q"], praise: "Stark! Das ist ein b – der Bauch zeigt nach links." },
    { type: "vowel", word: "Eis", letters: ["ei", "s"], gapIndex: 0, answer: "ei", options: ["ei", "ie", "au"], praise: "Toll! Eis schreibt man mit ei." },
    { type: "bd", glyph: "p", answer: "p", options: ["p", "q", "d"], praise: "Super! Das ist ein p." },
    { type: "vowel", word: "Brief", letters: ["Br", "ie", "f"], gapIndex: 1, answer: "ie", options: ["ie", "ei", "eu"], praise: "Genau! Brief schreibt man mit ie." },
  ],
];

// ---------------------------------------------------------------------------
// Skill-tag taxonomy. The FIRST tag is the PRIMARY skill — FSRS schedules per
// primary skill_tag (see backend SPEC §8). Keep this list authoritative.
// ---------------------------------------------------------------------------
const TAXONOMY: Record<string, string> = {
  syllable_count: "Anzahl der Silben bestimmen (count)",
  syllable_segmentation: "Wort in Silben zerlegen (gap, order)",
  syllable_gap: "fehlende Silbe ergänzen (gap)",
  syllable_order: "Silben in Reihenfolge bringen (order)",
  rhyme: "Reim erkennen (rhyme)",
  rhyme_pairs: "Reimpaare finden (pairs)",
  phoneme_initial: "Anlaut hören/erkennen (initial)",
  phoneme_position: "Laut an einer Position hören (letter, medial/final)",
  letter_sound: "Laut-Buchstaben-Zuordnung (initial, letter)",
  capitalization: "Groß-/Kleinschreibung (case)",
  word_class_noun: "Nomen erkennen (case)",
  word_class_verb: "Tunwort/Verb erkennen (case)",
  letter_order: "Buchstaben ordnen (arrange)",
  spelling: "Rechtschreibung allgemein (arrange, vowel)",
  lexical_decision: "echtes Wort vs. Quatschwort (nonsense)",
  letter_discrimination: "b/d/p/q unterscheiden (bd)",
  vowel_ie: "Dehnungs-ie (vowel)",
  vowel_ei: "Diphthong ei (vowel)",
  vowel_spelling: "Vokal-Schreibung allgemein (vowel)",
};

// difficulty: 1=leicht, 2=mittel, 3=schwer. STARTING estimate; real difficulty comes from attempt data.
function tagsAndDifficulty(it: Item): [string[], number] {
  const t = it.type;
  const s = (it.syll as string[] | undefined) ?? [];
  switch (t) {
    case "count": {
      const n = it.answer as number;
      return [["syllable_count", "syllable_segmentation"], n <= 2 ? 1 : n === 3 ? 2 : 3];
    }
    case "gap":
      return [["syllable_gap", "syllable_segmentation"], s.length <= 3 ? 1 : 2];
    case "order":
      return [["syllable_order", "syllable_segmentation"], 2];
    case "rhyme":
      return [["rhyme"], (it.word as string).length >= 7 ? 2 : 1];
    case "initial":
      return [["phoneme_initial", "letter_sound"], 1];
    case "letter": {
      const gi = it.gapIndex as number;
      const posTag = gi === 0 ? "phoneme_initial" : "phoneme_position";
      return [[posTag, "letter_sound"], gi <= 1 ? 1 : 2];
    }
    case "case": {
      const isNoun = /^[A-ZÄÖÜ]/.test(it.answer as string);
      return [["capitalization", isNoun ? "word_class_noun" : "word_class_verb"], isNoun ? 1 : 2];
    }
    case "arrange":
      return [["letter_order", "spelling"], 2];
    case "nonsense":
      return [["lexical_decision"], (it.answer as string).toLowerCase().startsWith("echtes") ? 1 : 2];
    case "pairs":
      return [["rhyme_pairs", "rhyme"], 2];
    case "bd":
      return [["letter_discrimination"], 2];
    case "vowel": {
      const ans = it.answer as string;
      const primary = ans === "ie" ? "vowel_ie" : ans === "ei" ? "vowel_ei" : "vowel_spelling";
      return [[primary, "vowel_spelling", "spelling"], 2];
    }
    default:
      return [["unknown"], 1];
  }
}

const slug = (str: string): string =>
  str
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/·/g, "").replace(/\s+/g, "-");

const items = LESSONS.flatMap((lesson, ui) =>
  lesson.map((it, ii) => {
    const [tags, difficulty] = tagsAndDifficulty(it);
    const { type, ...payload } = it; // payload = per-type fields the frontend renders
    const label =
      (it.word as string) ??
      (it.glyph as string) ??
      ((it.pair as string[] | undefined)?.join("+")) ??
      `item${ii + 1}`;
    return {
      seed_key: `u${ui + 1}-${type}-${slug(label)}`, // stable natural key for idempotent upsert
      unit: ui + 1,
      exercise_type: type,
      payload,
      skill_tags: tags,
      difficulty,
      audio_url: null, // filled by the TTS pipeline (backend SPEC §9)
      syllable_audio: null,
      generated_by: "seed",
    };
  }),
);

const byUnit: Record<number, number> = {};
const byType: Record<string, number> = {};
for (const it of items) {
  byUnit[it.unit] = (byUnit[it.unit] ?? 0) + 1;
  byType[it.exercise_type] = (byType[it.exercise_type] ?? 0) + 1;
}

const out = {
  $schema_note:
    "Seed for item_bank (backend SPEC §3). 'payload' = the per-type fields the frontend renders " +
    "(frontend SPEC §3); the backend composes Exercise = {id, type, ...payload, audioUrl, skillTags} " +
    "when serving a session.",
  skill_tags_taxonomy: TAXONOMY,
  counts: { total: items.length, by_unit: byUnit, by_type: byType },
  items,
};

const target = join(__dirname, "..", "item_bank.seed.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\n", "utf-8");
console.log(`Wrote item_bank.seed.json — ${items.length} items`);
console.log("by unit:", byUnit);
console.log("by type:", byType);
