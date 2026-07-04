import { useState } from 'react';
import { Download, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { Lexeme, LexemeStats } from '@/lib/contract';
import type { LexemeFilters } from '@/lib/endpoints';
import { useLexemes, useLexemeStats, useLexemeActions } from './useLexemes';
import { LexemeEditor } from './LexemeEditor';
import { SkillsHelp } from './SkillsHelp';
import { SKILL_TAGS } from './skills';

const POS_OPTIONS = ['N', 'V', 'ADJ', 'ADV', 'PRO', 'KONJ', 'ART', 'PREP', 'PTK', 'NUM', 'ADJ / ADV'];
// The orthographic Lernstellen keys in `features` (from the parser).
const FEATURE_KEYS = [
  'vSchreibung', 'stummesH', 'doppelvokalUmlaut', 'auslautverhaertung', 'ig',
  'rSchreibung', 'schwaEnding', 'scharfesS', 'silbengelenk', 'silbischesH',
];

/**
 * Lexeme foundation curation (admin only; backend SPEC §6). Filter the annotated word pool by ANY
 * property, see live aggregate stats for the current filter, and edit/add/delete words. Edits hit the
 * live table immediately; "Export" persists the change-set to the committed lexeme.overrides.json.
 */
export function LexemesScreen() {
  const { reviewer } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';
  const [filters, setFilters] = useState<LexemeFilters>({});
  const [editing, setEditing] = useState<Lexeme | 'new' | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const setF = (patch: Partial<LexemeFilters>) => setFilters((s) => ({ ...s, ...patch }));

  const list = useLexemes(filters, isAdmin);
  const stats = useLexemeStats(filters, isAdmin);
  const { exportOverrides } = useLexemeActions();

  if (reviewer && !isAdmin) {
    return (
      <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
        <ShieldAlert className="mb-2 size-7" aria-hidden />
        <p>Nur Administrator:innen können den Wortschatz bearbeiten.</p>
      </div>
    );
  }

  const runExport = () => {
    setExportMsg(null);
    exportOverrides.mutate(undefined, {
      onSuccess: (r) =>
        setExportMsg(`Korrekturen gespeichert: ${r.edits} Änderungen, ${r.adds} neue, ${r.deletes} gelöscht.`),
      onError: (e) => setExportMsg(`Export fehlgeschlagen${e instanceof Error ? `: ${e.message}` : ''}.`),
    });
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={exportOverrides.isPending} onClick={runExport}>
          <Download className="size-4" aria-hidden /> Korrekturen exportieren
        </Button>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="size-4" aria-hidden /> Neues Wort
        </Button>
      </div>

      {exportMsg && <p className="mb-3 text-sm text-ink-soft">{exportMsg}</p>}

      {/* ── Filter bar (every property) ── */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
        <Ctrl label="Suche">
          <Input
            className="w-56"
            value={filters.search ?? ''}
            onChange={(e) => setF({ search: e.target.value })}
            placeholder="Wort …"
            aria-label="Wort suchen"
          />
        </Ctrl>
        <Ctrl label="Skill" help={<SkillsHelp />}>
          <Filter value={filters.skill} onChange={(v) => setF({ skill: v })} options={[...SKILL_TAGS]} allLabel="Alle Skills" />
        </Ctrl>
        <Ctrl label="Wortart">
          <Filter value={filters.pos} onChange={(v) => setF({ pos: v })} options={POS_OPTIONS} allLabel="Alle" />
        </Ctrl>
        <Ctrl label="Genus">
          <Select className="w-auto" value={filters.genus ?? ''} onChange={(e) => setF({ genus: e.target.value || undefined })}>
            <option value="">Alle</option>
            <option value="der">der</option>
            <option value="die">die</option>
            <option value="das">das</option>
            <option value="none">kein Nomen</option>
          </Select>
        </Ctrl>
        <Ctrl label="Merkmal">
          <Filter value={filters.feature} onChange={(v) => setF({ feature: v })} options={FEATURE_KEYS} allLabel="Alle" />
        </Ctrl>
        <Ctrl label="Quelle">
          <Filter value={filters.source} onChange={(v) => setF({ source: v })} options={['rwe2015', 'reviewer']} allLabel="Alle" />
        </Ctrl>
        <Ctrl label="HK von">
          <Input className="w-16" type="number" value={filters.hkMin ?? ''} onChange={(e) => setF({ hkMin: e.target.value })} />
        </Ctrl>
        <Ctrl label="HK bis">
          <Input className="w-16" type="number" value={filters.hkMax ?? ''} onChange={(e) => setF({ hkMax: e.target.value })} />
        </Ctrl>
        <Ctrl label="Silbenzahl">
          <Input className="w-16" type="number" value={filters.syl ?? ''} onChange={(e) => setF({ syl: e.target.value })} />
        </Ctrl>
        <Ctrl label="Morpheme">
          <Input className="w-16" type="number" value={filters.morph ?? ''} onChange={(e) => setF({ morph: e.target.value })} />
        </Ctrl>
        <FlagSelect label="Lernwort" value={filters.lernwort} onChange={(v) => setF({ lernwort: v })} />
        <FlagSelect label="Trennbar" value={filters.trennbar} onChange={(v) => setF({ trennbar: v })} />
        <FlagSelect label="Merkwort" value={filters.merkwort} onChange={(v) => setF({ merkwort: v })} />
        <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
          <RotateCcw className="size-4" aria-hidden /> Zurücksetzen
        </Button>
      </div>

      {/* ── Aggregate stats for the current filter ── */}
      {stats.data && <StatsPanel s={stats.data} />}

      {list.isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt Wortschatz …</p>
      ) : list.isError ? (
        <p className="py-16 text-center text-danger">
          Wortschatz konnte nicht geladen werden{list.error instanceof Error ? `: ${list.error.message}` : ''}.
        </p>
      ) : list.data.items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <p>Keine Wörter in dieser Ansicht.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-medium">Wort</th>
                <th className="px-4 py-2 font-medium">HK</th>
                <th className="px-4 py-2 font-medium">Wortart</th>
                <th className="px-4 py-2 font-medium">Silben</th>
                <th className="px-4 py-2 font-medium">Silbenzahl</th>
                <th className="px-4 py-2 font-medium">Morpheme</th>
                <th className="px-4 py-2 font-medium">Skills <SkillsHelp /></th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data.items.map((w) => (
                <tr key={w.lemma} className="hover:bg-black/[0.015]">
                  <td className="px-4 py-2 font-medium text-ink">
                    {w.lemma}
                    {w.genus && <span className="ml-1 text-ink-soft">({w.genus})</span>}
                    {w.source !== 'rwe2015' && (
                      <span className="ml-2 rounded-full bg-teal-tint px-1.5 py-0.5 text-[10px] text-teal-dark">
                        {w.source}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-ink-soft">{w.hk}</td>
                  <td className="px-4 py-2 text-ink-soft">{w.pos}</td>
                  <td className="px-4 py-2 text-ink-soft">{w.syllabification}</td>
                  <td className="px-4 py-2 text-ink-soft">{w.syllableCount}</td>
                  <td className="px-4 py-2 text-ink-soft">{w.morphemeCount}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {w.skillTags.map((t) => (
                        <span key={t} className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[11px] text-ink-soft">
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="link" size="sm" onClick={() => setEditing(w)}>
                      Bearbeiten
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data.nextCursor && (
            <p className="border-t border-line px-4 py-2 text-center text-xs text-ink-soft">
              Erste {list.data.items.length} von {list.data.total} — Filter eingrenzen, um mehr zu sehen.
            </p>
          )}
        </div>
      )}

      {editing && <LexemeEditor lexeme={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Ctrl({ label, help, children }: { label: string; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs font-medium text-ink-soft">
        {label}
        {help}
      </span>
      {children}
    </label>
  );
}

/** A "— all —" + options select bound to an optional filter value. */
function Filter({
  value,
  onChange,
  options,
  allLabel,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <Select className="w-auto" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </Select>
  );
}

/** Tri-state (Alle / ja / nein) for a boolean flag filter. */
function FlagSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <Ctrl label={label}>
      <Select className="w-auto" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">Alle</option>
        <option value="true">ja</option>
        <option value="false">nein</option>
      </Select>
    </Ctrl>
  );
}

function StatsPanel({ s }: { s: LexemeStats }) {
  return (
    <div className="mb-4 rounded-card bg-surface p-4 shadow-sm ring-1 ring-line">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-2xl font-bold text-ink">{s.total.toLocaleString('de-AT')}</span>
        <span className="text-ink-soft">Wörter im Filter</span>
        {s.total > 0 && (
          <>
            <span className="text-sm text-ink-soft">
              HK {s.hk.min}–{s.hk.max} · ⌀ {s.hk.avg}
            </span>
            <span className="text-sm text-ink-soft">
              Lernwort {s.flags.lernwort} · Trennbar {s.flags.trennbar} · Merkwort {s.flags.merkwort}
            </span>
          </>
        )}
      </div>
      {s.total > 0 && (
        <div className="mt-3 space-y-2">
          <StatRow label="Wortart" items={s.byPos} />
          <StatRow label="Genus" items={s.byGenus} />
          <StatRow label="Quelle" items={s.bySource} />
          <StatRow label="Silbenzahl" items={s.bySyllableCount} />
          <StatRow label="Morpheme" items={s.byMorpheme} />
          <StatRow label="Skills" items={s.bySkill} help={<SkillsHelp />} />
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  items,
  help,
}: {
  label: string;
  items: { value: string; count: number }[];
  help?: React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="flex min-w-16 shrink-0 items-center gap-1 text-xs font-medium text-ink-soft">
        {label}
        {help}
      </span>
      {items.slice(0, 12).map((i) => (
        <span key={i.value} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-ink-soft">
          {i.value} <span className="font-semibold text-ink">{i.count}</span>
        </span>
      ))}
    </div>
  );
}
