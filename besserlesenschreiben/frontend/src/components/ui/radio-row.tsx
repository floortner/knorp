import { useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Minimal accessible radio group (shadcn-style, like Switch): a row of equal-width segmented
 * options. WAI-ARIA radiogroup semantics — roving tabindex, arrow keys move selection.
 */
export function RadioRow<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  label: string;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              'min-w-0 flex-1 rounded-2xl px-2 py-2.5 text-sm font-semibold ring-1 transition active:scale-[0.98] disabled:opacity-50',
              selected
                ? 'bg-teal-tint text-teal-text ring-2 ring-teal'
                : 'bg-surface text-ink-soft ring-hairline hover:bg-wash',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
