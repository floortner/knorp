/** The brand "b" mark (hand-authored SVG — mirrors the family app's BMark; SVG-first media rule). */
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
