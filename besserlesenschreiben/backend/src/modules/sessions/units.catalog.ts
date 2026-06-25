/**
 * Static unit catalogue (titles, focus, theme colours, drilled exercise types). This was the
 * prototype's hardcoded LESSONS[] header; it is now server-owned and is the source for `GET /units`.
 * Per-profile `status` and live `itemCount` are computed in the service — only the editorial metadata
 * lives here. Mirrors the golden fixture `../frontend/fixtures/units.example.json`.
 */
export interface UnitMeta {
  unit: number;
  title: string;
  subtitle: string;
  focus: string;
  exerciseTypes: string[];
  theme: { iconBg: string; iconColor: string };
}

export const UNIT_CATALOG: readonly UnitMeta[] = [
  { unit: 1, title: 'Einheit 1', subtitle: 'Silben hören', focus: 'Silben hören & zählen', exerciseTypes: ['count', 'gap', 'order'], theme: { iconBg: '#DFF0EC', iconColor: '#1E8275' } },
  { unit: 2, title: 'Einheit 2', subtitle: 'Silben klatschen', focus: 'Silben segmentieren', exerciseTypes: ['count', 'order', 'gap'], theme: { iconBg: '#EFE6FB', iconColor: '#8B45D6' } },
  { unit: 3, title: 'Einheit 3', subtitle: 'Mit Reim', focus: 'Reime erkennen', exerciseTypes: ['rhyme'], theme: { iconBg: '#FCE5F0', iconColor: '#C53D7E' } },
  { unit: 4, title: 'Einheit 4', subtitle: 'Buchstaben & Anlaut', focus: 'Anlaut & fehlende Buchstaben', exerciseTypes: ['initial', 'letter'], theme: { iconBg: '#FBF0D6', iconColor: '#C9852A' } },
  { unit: 5, title: 'Einheit 5', subtitle: 'Groß, klein & ordnen', focus: 'Groß-/Kleinschreibung & ordnen', exerciseTypes: ['case', 'arrange'], theme: { iconBg: '#E3EEFB', iconColor: '#2A6FDB' } },
  { unit: 6, title: 'Einheit 6', subtitle: 'Quatsch & Reimpaare', focus: 'Echtwort vs Quatschwort, Reimpaare', exerciseTypes: ['nonsense', 'pairs'], theme: { iconBg: '#E6F3E6', iconColor: '#4E9A4E' } },
  { unit: 7, title: 'Einheit 7', subtitle: 'Genau hinschauen', focus: 'b/d/p/q & ie/ei/eu', exerciseTypes: ['bd', 'vowel'], theme: { iconBg: '#F6E5E0', iconColor: '#C0612F' } },
];

/** Per-profile unit status: unlocked-and-past = done, the unlocked edge = current, beyond = locked. */
export function unitStatus(unit: number, unlockedUnit: number): 'locked' | 'current' | 'done' {
  if (unit < unlockedUnit) return 'done';
  if (unit === unlockedUnit) return 'current';
  return 'locked';
}
