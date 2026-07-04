import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import type { Lexeme } from '@/lib/contract';
import { useLexemeActions } from './useLexemes';
import { SKILL_TAGS } from './skills';
import { SkillsHelp } from './SkillsHelp';

interface Form {
  lemma: string;
  hk: string;
  pos: string;
  genus: string;
  morphemeCount: string;
  ipa: string;
  syllabification: string;
  syllableCount: string;
  forms: string;
  separablePrefix: string;
  familyStem: string;
  compoundParts: string; // edited as "Holz + Treppe"; split on "+" into string[] on save
  skillTags: string[];
  isLernwort: boolean;
  isTrennbar: boolean;
  isMerkwort: boolean;
}

function initForm(l: Lexeme | null): Form {
  return {
    lemma: l?.lemma ?? '',
    hk: String(l?.hk ?? 10),
    pos: l?.pos ?? 'N',
    genus: l?.genus ?? '',
    morphemeCount: String(l?.morphemeCount ?? 1),
    ipa: l?.ipa ?? '',
    syllabification: l?.syllabification ?? '',
    syllableCount: String(l?.syllableCount ?? 1),
    forms: l?.forms ?? '',
    separablePrefix: l?.separablePrefix ?? '',
    familyStem: l?.familyStem ?? '',
    compoundParts: (l?.compoundParts ?? []).join(' + '),
    skillTags: l?.skillTags ?? [],
    isLernwort: l?.isLernwort ?? false,
    isTrennbar: l?.isTrennbar ?? false,
    isMerkwort: l?.isMerkwort ?? false,
  };
}

/** Full-column editor for one lexeme (or a new word). Edits the live table; run "Export" after to persist. */
export function LexemeEditor({ lexeme, onClose }: { lexeme: Lexeme | null; onClose: () => void }) {
  const isNew = lexeme === null;
  const { edit, add, remove } = useLexemeActions();
  const [f, setF] = useState<Form>(() => initForm(lexeme));
  const [featuresText, setFeaturesText] = useState(() => JSON.stringify(lexeme?.features ?? {}, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = edit.isPending || add.isPending || remove.isPending;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleTag = (t: string) =>
    set('skillTags', f.skillTags.includes(t) ? f.skillTags.filter((x) => x !== t) : [...f.skillTags, t]);

  const save = () => {
    setErr(null);
    if (isNew && !f.lemma.trim()) return setErr('Ein Wort (Lemma) ist erforderlich.');
    // A cleared number input is '' → Number('') === 0, which would silently persist hk:0 (the most-
    // frequent band) and skew lecture targeting. Require a real integer instead.
    const toInt = (s: string): number | null => {
      const n = Number(s);
      return s.trim() !== '' && Number.isInteger(n) ? n : null;
    };
    const hk = toInt(f.hk);
    const morphemeCount = toInt(f.morphemeCount);
    const syllableCount = toInt(f.syllableCount);
    if (hk === null) return setErr('HK muss eine ganze Zahl sein.');
    if (morphemeCount === null) return setErr('Morphemzahl muss eine ganze Zahl sein.');
    if (syllableCount === null) return setErr('Silbenzahl muss eine ganze Zahl sein.');
    let features: Record<string, unknown>;
    try {
      features = JSON.parse(featuresText || '{}');
    } catch {
      return setErr('Ungültiges JSON im Feld „Features“.');
    }
    const body = {
      hk,
      pos: f.pos,
      genus: f.genus || null,
      morphemeCount,
      ipa: f.ipa,
      syllabification: f.syllabification,
      syllableCount,
      forms: f.forms || null,
      separablePrefix: f.separablePrefix || null,
      familyStem: f.familyStem.trim() || null,
      compoundParts: f.compoundParts.split('+').map((s) => s.trim()).filter(Boolean),
      features: features as Lexeme['features'],
      skillTags: f.skillTags,
      isLernwort: f.isLernwort,
      isTrennbar: f.isTrennbar,
      isMerkwort: f.isMerkwort,
    };
    const onError = (e: unknown) => setErr(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.');
    if (isNew) add.mutate({ lemma: f.lemma.trim(), ...body }, { onSuccess: onClose, onError });
    else edit.mutate({ lemma: lexeme.lemma, body }, { onSuccess: onClose, onError });
  };

  return (
    <Modal
      onClose={onClose}
      dismissable={false}
      size="2xl"
      title={isNew ? 'Neues Wort' : `„${lexeme.lemma}“ bearbeiten`}
    >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Wort (Lemma)">
            <Input
              className={cn(!isNew && 'opacity-60')}
              value={f.lemma}
              onChange={(e) => set('lemma', e.target.value)}
              disabled={!isNew}
              aria-label="Lemma"
            />
          </Field>
          <Field label="Häufigkeitsklasse (HK)">
            <Input type="number" value={f.hk} onChange={(e) => set('hk', e.target.value)} />
          </Field>
          <Field label="Wortart">
            <Input value={f.pos} onChange={(e) => set('pos', e.target.value)} />
          </Field>
          <Field label="Genus">
            <Select value={f.genus} onChange={(e) => set('genus', e.target.value)}>
              <option value="">— (kein Nomen)</option>
              <option value="der">der</option>
              <option value="die">die</option>
              <option value="das">das</option>
            </Select>
          </Field>
          <Field label="IPA">
            <Input value={f.ipa} onChange={(e) => set('ipa', e.target.value)} />
          </Field>
          <Field label="Silbentrennung">
            <Input value={f.syllabification} onChange={(e) => set('syllabification', e.target.value)} />
          </Field>
          <Field label="Morpheme">
            <Input type="number" value={f.morphemeCount} onChange={(e) => set('morphemeCount', e.target.value)} />
          </Field>
          <Field label="Silbenzahl">
            <Input type="number" value={f.syllableCount} onChange={(e) => set('syllableCount', e.target.value)} />
          </Field>
          <Field label="Formen (Flexion)">
            <Input value={f.forms} onChange={(e) => set('forms', e.target.value)} />
          </Field>
          <Field label="Trennbares Präfix">
            <Input value={f.separablePrefix} onChange={(e) => set('separablePrefix', e.target.value)} />
          </Field>
          <Field label="Wortfamilie-Stamm">
            <Input
              value={f.familyStem}
              onChange={(e) => set('familyStem', e.target.value)}
              placeholder="z. B. fahr"
              aria-label="Wortfamilie-Stamm"
            />
          </Field>
          <Field label="Kompositum-Teile (mit + trennen)">
            <Input
              value={f.compoundParts}
              onChange={(e) => set('compoundParts', e.target.value)}
              placeholder="z. B. Holz + Treppe"
              aria-label="Kompositum-Teile"
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-soft">
            Skills <SkillsHelp />
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                aria-pressed={f.skillTags.includes(t)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition',
                  f.skillTags.includes(t)
                    ? 'bg-teal text-white ring-teal'
                    : 'bg-surface text-ink-soft ring-line hover:bg-black/[0.02]',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          {(['isLernwort', 'isTrennbar', 'isMerkwort'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} />
              {k === 'isLernwort' ? 'Lernwort' : k === 'isTrennbar' ? 'Trennbar' : 'Merkwort'}
            </label>
          ))}
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-ink-soft">
            Features (rohe Rechtschreib-Merkmale, JSON)
          </p>
          <Textarea
            className="h-28 font-mono text-xs"
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            spellCheck={false}
          />
        </div>

        {err && <p className="mt-3 text-sm text-danger">{err}</p>}

        <div className="mt-5 flex items-center justify-between">
          {!isNew ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button variant="danger" size="sm" disabled={busy} onClick={() => remove.mutate(lexeme.lemma, { onSuccess: onClose })}>
                  Endgültig löschen
                </Button>
                <Button variant="link" size="sm" onClick={() => setConfirmDelete(false)}>
                  Abbrechen
                </Button>
              </div>
            ) : (
              <Button variant="link" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
                Wort löschen
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              {busy ? 'Speichert …' : 'Speichern'}
            </Button>
          </div>
        </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
