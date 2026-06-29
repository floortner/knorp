import type { HomeworkAnalysis } from '@/lib/contract';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/input';

/**
 * Editable copy of the analysis. Starts as the LLM draft; the reviewer corrects it into the
 * authoritative verdict. Per-item the reviewer flips correct/incorrect and adjusts the error type;
 * the suggested focus skills are the comma-separated tags that drive the next lecture.
 */
export function AnalysisEditor({
  value,
  onChange,
  disabled,
}: {
  value: HomeworkAnalysis;
  onChange: (next: HomeworkAnalysis) => void;
  disabled?: boolean;
}) {
  const setItem = (idx: number, patch: Partial<HomeworkAnalysis['items'][number]>) =>
    onChange({ ...value, items: value.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Thema">
          <Input
            value={value.topic}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, topic: e.target.value })}
          />
        </Field>
        <Field label="Übungstyp">
          <Input
            value={value.exerciseType}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, exerciseType: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-soft">Aufgaben ({value.items.length})</p>
        <ul className="flex flex-col gap-2">
          {value.items.map((it, idx) => (
            <li key={idx} className="rounded-lg ring-1 ring-line">
              <div className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setItem(idx, { correct: !it.correct })}
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 transition disabled:opacity-50',
                    it.correct
                      ? 'bg-good-tint text-good ring-good/30'
                      : 'bg-danger-tint text-danger ring-danger/30',
                  )}
                  aria-pressed={it.correct}
                >
                  {it.correct ? 'richtig' : 'falsch'}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{it.prompt}</p>
                  <p className="truncate text-xs text-ink-soft">Kind: „{it.childAnswer}“</p>
                </div>
                <Input
                  value={it.errorType ?? ''}
                  disabled={disabled || it.correct}
                  placeholder="Fehlertyp"
                  onChange={(e) => setItem(idx, { errorType: e.target.value || null })}
                  className="h-9 w-40 text-sm"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Field label="Förderschwerpunkte (kommagetrennt) → nächste Lektion">
        <Input
          value={value.suggestedFocus.join(', ')}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...value,
              suggestedFocus: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
