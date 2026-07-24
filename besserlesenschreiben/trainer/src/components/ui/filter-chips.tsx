import { cn } from '@/lib/cn';

/** A row of single-select filter chips (tablist). Shared by the Chats queue + the Nutzer screen. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium ring-1 transition',
            value === o.value
              ? 'bg-teal text-white ring-teal'
              : 'bg-surface text-ink-soft ring-line hover:bg-black/[0.02]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
