/** A big word/prompt display. */
export function BigWord({ children }: { children: React.ReactNode }) {
  return <p className="text-center font-display text-3xl font-bold text-ink">{children}</p>;
}
