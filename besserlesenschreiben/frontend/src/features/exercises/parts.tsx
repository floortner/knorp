import { cn } from '@/lib/cn';

/** Syllable / letter chips, e.g. Som · mer. A blank index renders as an underline gap. */
export function Chips({ parts, gapIndex }: { parts: string[]; gapIndex?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {parts.map((p, i) => (
        <span
          key={i}
          className={cn(
            'rounded-xl px-3 py-2 font-display text-xl font-bold',
            i === gapIndex ? 'min-w-10 bg-orange/15 text-orange-dark' : 'bg-teal-tint text-teal-dark',
          )}
        >
          {i === gapIndex ? ' ? ' : p}
        </span>
      ))}
    </div>
  );
}

/** A big word display (rhyme/nonsense prompts). */
export function BigWord({ children }: { children: React.ReactNode }) {
  return <p className="text-center font-display text-3xl font-bold text-ink">{children}</p>;
}
