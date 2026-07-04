import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { SKILL_TAGS, SKILL_INFO } from './skills';

/** A small "?" that opens a popup explaining every skill tag in plain language. Drop it wherever skills show. */
export function SkillsHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Skills erklären"
        className="inline-flex align-middle text-ink-soft transition hover:text-teal-dark"
      >
        <HelpCircle className="size-3.5" aria-hidden />
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} title="Skills – kurz erklärt">
          <p className="mb-4 text-sm text-ink-soft">
            Die Skills sind die Förderschwerpunkte des Vokaltrainings – jedes Wort ist damit markiert, wofür es
            sich zum Üben eignet.
          </p>
          <ul className="space-y-3">
            {SKILL_TAGS.map((tag) => (
              <li key={tag}>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-ink">{SKILL_INFO[tag].name}</span>
                  <code className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-teal-dark">{tag}</code>
                </div>
                <p className="text-sm text-ink-soft">{SKILL_INFO[tag].desc}</p>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
