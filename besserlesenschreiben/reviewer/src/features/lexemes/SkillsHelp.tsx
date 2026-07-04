import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';

// Brief explanations of the Vokaltraining skill tags (FRESCH-style; mirrors backend contract/skills.ts).
// Order + tags must stay in sync with SKILL_TAGS.
const SKILLS: { tag: string; name: string; desc: string }[] = [
  { tag: 'vowel_identify', name: 'Selbstlaut finden', desc: 'Den Selbstlaut (Vokal) im Wort erkennen.' },
  { tag: 'vowel_length', name: 'Vokallänge', desc: 'Kurz (Doppelkonsonant/Stopper) oder lang (offene Silbe, ie, Dehnungs-h)?' },
  { tag: 'vowel_substitution', name: 'Selbstlaut tauschen', desc: 'Den Vokal austauschen → neues Wort (Hend → Hand).' },
  { tag: 'word_raster', name: 'Wortraster', desc: 'Einsilbige Wörter: Anfang · Selbstlaut · Ende.' },
  { tag: 'lexical_decision', name: 'Echt oder Quatsch', desc: 'Ein echtes Wort von einem Quatschwort unterscheiden.' },
  { tag: 'syllable_validity', name: 'Silbe gültig?', desc: 'Kann die Silbe klingen? Jede Silbe braucht einen Selbstlaut.' },
  { tag: 'syllable_segmentation', name: 'Silben zerlegen', desc: 'Ein Wort in Silben zerlegen und wieder zusammensetzen.' },
  { tag: 'visual_discrimination', name: 'Genau hinschauen', desc: 'Gleich oder anders? Wortpaare vergleichen.' },
  { tag: 'compound_word', name: 'Zusammengesetzte Wörter', desc: 'Holz + Treppe → Holztreppe; der Artikel kommt vom Grundwort.' },
  { tag: 'word_family', name: 'Wortfamilie', desc: 'Gemeinsamer Wortstamm – die Schreibung ableiten (fahren → Fahrrad).' },
  { tag: 'article', name: 'Artikel', desc: 'Den richtigen Artikel (der/die/das) zum Nomen wählen.' },
  { tag: 'sentence_context', name: 'Satzzusammenhang', desc: 'Das Wort im Satz erkennen oder korrigieren.' },
  { tag: 'dehnung_h', name: 'Dehnungs-h', desc: 'Dehnungs-h / stummes H als Zeichen für einen langen Vokal (Jahr, sehen).' },
  { tag: 'double_consonant', name: 'Doppelkonsonant', desc: 'Silbengelenk als Zeichen für einen kurzen Vokal (kommen, Wasser).' },
];

/** A small "?" that opens a popup explaining every skill tag in plain language. Drop it wherever skills show. */
export function SkillsHelp() {
  const [open, setOpen] = useState(false);

  // Close on Escape while the popup is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

      {/* Rendered in a portal on <body> so it never inherits click behaviour from the label/table it sits in. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
            role="dialog"
            aria-modal
            aria-label="Skills erklärt"
            onClick={() => setOpen(false)}
          >
            <div
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-card bg-surface p-6 shadow-xl ring-1 ring-line"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Skills – kurz erklärt</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Schließen"
                  className="text-ink-soft hover:text-ink"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <p className="mb-4 text-sm text-ink-soft">
                Die Skills sind die Förderschwerpunkte des Vokaltrainings – jedes Wort ist damit markiert, wofür es
                sich zum Üben eignet.
              </p>
              <ul className="space-y-3">
                {SKILLS.map(({ tag, name, desc }) => (
                  <li key={tag}>
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-ink">{name}</span>
                      <code className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[11px] text-teal-dark">{tag}</code>
                    </div>
                    <p className="text-sm text-ink-soft">{desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
