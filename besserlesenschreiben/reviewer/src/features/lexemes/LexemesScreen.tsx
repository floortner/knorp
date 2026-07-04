import { useState } from 'react';
import { BookMarked, Download, Plus, ShieldAlert } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import type { Lexeme } from '@/lib/contract';
import { useLexemes, useLexemeActions } from './useLexemes';
import { LexemeEditor } from './LexemeEditor';

// Mirrors backend src/contract/skills.ts (SKILL_TAGS). The backend validates, so drift → a 400.
export const SKILL_TAGS = [
  'vowel_identify', 'vowel_length', 'vowel_substitution', 'word_raster', 'lexical_decision',
  'syllable_validity', 'syllable_segmentation', 'visual_discrimination', 'compound_word',
  'word_family', 'article', 'sentence_context', 'dehnung_h', 'double_consonant',
] as const;

/**
 * Lexeme foundation curation (admin only; backend SPEC §6). Browse/search/filter the annotated word pool
 * and edit every column; add and delete words. Edits hit the live table immediately; "Export" persists the
 * change-set to the committed lexeme.overrides.json so corrections survive reseeds and reproduce anywhere.
 */
export function LexemesScreen() {
  const { reviewer } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState('');
  const [editing, setEditing] = useState<Lexeme | 'new' | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const { data, isPending, isError, error } = useLexemes(
    { search: search.trim() || undefined, skill: skill || undefined },
    isAdmin,
  );
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BookMarked className="size-5 text-teal-dark" aria-hidden />
        <h1 className="text-lg font-semibold text-ink">Wortschatz</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={exportOverrides.isPending} onClick={runExport}>
            <Download className="size-4" aria-hidden /> Korrekturen exportieren
          </Button>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> Neues Wort
          </Button>
        </div>
      </div>

      {exportMsg && <p className="mb-3 text-sm text-ink-soft">{exportMsg}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Wort suchen …"
          aria-label="Wort suchen"
          className="w-64"
        />
        <Select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          aria-label="Nach Skill filtern"
          className="w-auto"
        >
          <option value="">Alle Skills</option>
          {SKILL_TAGS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        {data && <span className="text-sm text-ink-soft">{data.total} Wörter</span>}
      </div>

      {isPending ? (
        <p className="py-16 text-center text-ink-soft">Lädt Wortschatz …</p>
      ) : isError ? (
        <p className="py-16 text-center text-danger">
          Wortschatz konnte nicht geladen werden{error instanceof Error ? `: ${error.message}` : ''}.
        </p>
      ) : data.items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-dashed border-line py-20 text-ink-soft">
          <p>Keine Wörter in dieser Ansicht.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-line">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-medium">Wort</th>
                <th className="px-4 py-2 font-medium">HK</th>
                <th className="px-4 py-2 font-medium">Wortart</th>
                <th className="px-4 py-2 font-medium">Silben</th>
                <th className="px-4 py-2 font-medium">Skills</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((w) => (
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
          {data.nextCursor && (
            <p className={cn('border-t border-line px-4 py-2 text-center text-xs text-ink-soft')}>
              Erste {data.items.length} von {data.total} — Suche eingrenzen, um mehr zu sehen.
            </p>
          )}
        </div>
      )}

      {editing && (
        <LexemeEditor
          lexeme={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
