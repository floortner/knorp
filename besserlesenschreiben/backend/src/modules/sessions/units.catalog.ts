/**
 * Static unit catalogue (titles, focus, theme colours, drilled exercise types, teaching intro). The 7 units
 * follow the owner's Vokaltraining progression (Wortraster/FRESCH): find the vowel → decompose the word →
 * real vs. Quatsch → swap vowels → vowel length → multi-syllable words → compounds & word families.
 * Server-owned, the source for `GET /units`. Per-profile `status` and live `itemCount` are computed in the
 * service — only the editorial metadata lives here. Mirrors `../frontend/fixtures/units.example.json`.
 *
 * `intro` is the unit's Merksatz — the teaching card shown before the first exercise of a bank session
 * (the strategy layer of the program: ◡◡ Silben mitsprechen · → Verlängern · 🏠 Wortfamilie · 📖 Merkwort).
 */
export interface UnitMeta {
  unit: number;
  title: string;
  subtitle: string;
  focus: string;
  exerciseTypes: string[];
  intro: string;
  theme: { iconBg: string; iconColor: string };
}

export const UNIT_CATALOG: readonly UnitMeta[] = [
  {
    unit: 1, title: 'Einheit 1', subtitle: 'Selbstlaute entdecken', focus: 'Selbstlaute finden & einsetzen',
    exerciseTypes: ['findvowel', 'insertvowel'],
    intro: 'Merke: Es gibt 5 Selbstlaute (a, e, i, o, u), 3 verzierte (ä, ö, ü) und 5 Selbstlautfreunde (au, äu, eu, ei, ie). Jede Silbe braucht einen Selbstlaut – sonst kann sie nicht klingen!',
    theme: { iconBg: '#DFF0EC', iconColor: '#1E8275' },
  },
  {
    unit: 2, title: 'Einheit 2', subtitle: 'Das Wortraster', focus: 'Anfang · Vokal · Ende',
    exerciseTypes: ['raster'],
    intro: 'Merke: Jedes einsilbige Wort passt ins Wortraster – Anfang, gelber Kreis für den Selbstlaut, Ende. Der Selbstlaut ist die Sonne in der Mitte!',
    theme: { iconBg: '#EFE6FB', iconColor: '#8B45D6' },
  },
  {
    unit: 3, title: 'Einheit 3', subtitle: 'Echt oder Quatsch?', focus: 'Echtwort, Silben & genaues Hinschauen',
    exerciseTypes: ['realword', 'sylvalid', 'paircheck'],
    intro: 'Merke: Echte Wörter haben immer einen Selbstlaut. Lies laut vor – klingt es wie ein deutsches Wort? Ohne Selbstlaut kann eine Silbe nicht klingen.',
    theme: { iconBg: '#FCE5F0', iconColor: '#C53D7E' },
  },
  {
    unit: 4, title: 'Einheit 4', subtitle: 'Zaubervokale', focus: 'Vokal tauschen → neues Wort',
    exerciseTypes: ['fixvowel', 'swapvowel', 'pickword'],
    intro: 'Merke: Tauschst du den Selbstlaut aus, entsteht oft ein ganz neues Wort – aus Hend wird Hand! Sprich laut vor: Welcher Selbstlaut macht ein echtes Wort?',
    theme: { iconBg: '#FBF0D6', iconColor: '#C9852A' },
  },
  {
    unit: 5, title: 'Einheit 5', subtitle: 'Kurz oder lang?', focus: 'Stopper vs. offene Silbe',
    exerciseTypes: ['length'],
    intro: 'Merke: Ein kurzer Selbstlaut hat einen Stopper – zwei Konsonanten danach (Tas-se). Ein langer Selbstlaut hat viel Zeit – nur ein Konsonant, ie oder Dehnungs-h (Na-se, liegt, Jahr).',
    theme: { iconBg: '#E3EEFB', iconColor: '#2A6FDB' },
  },
  {
    unit: 6, title: 'Einheit 6', subtitle: 'Silbenprofi', focus: 'Ganzes → Silben → Ganzes',
    exerciseTypes: ['sylarrange'],
    intro: 'Merke: Lange Wörter knackst du in Silben – lies das Ganze, sprich es in Silben und setz es wieder zusammen. Klatsch mit: Jede Silbe hat einen Selbstlaut!',
    theme: { iconBg: '#E6F3E6', iconColor: '#4E9A4E' },
  },
  {
    unit: 7, title: 'Einheit 7', subtitle: 'Wortbaumeister', focus: 'Komposita & Wortfamilien',
    exerciseTypes: ['compound', 'family', 'sentencefix'],
    intro: 'Merke: Zwei Wörter zusammen = ein neues Ding: die Holztreppe! Der Artikel kommt vom letzten Teil. Und in der Wortfamilie bleibt der Stamm gleich – einmal h, immer h (fahren → Fahrrad).',
    theme: { iconBg: '#F6E5E0', iconColor: '#C0612F' },
  },
];

/** Per-profile unit status: unlocked-and-past = done, the unlocked edge = current, beyond = locked. */
export function unitStatus(unit: number, unlockedUnit: number): 'locked' | 'current' | 'done' {
  if (unit < unlockedUnit) return 'done';
  if (unit === unlockedUnit) return 'current';
  return 'locked';
}
