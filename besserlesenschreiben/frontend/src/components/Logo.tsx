import { cn } from '@/lib/cn';

/** The brand "b" mark + wordmark (hand-authored SVG — SVG-first media rule). */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BMark className="h-8 w-8" />
      {wordmark && <span className="font-display text-lg font-bold text-ink">besserlesenschreiben</span>}
    </div>
  );
}

export function BMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="besserlesenschreiben">
      <rect width="40" height="40" rx="12" fill="#27A99B" />
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque Variable', sans-serif"
        fontSize="24"
        fontWeight="800"
        fill="#fff"
      >
        b
      </text>
    </svg>
  );
}
