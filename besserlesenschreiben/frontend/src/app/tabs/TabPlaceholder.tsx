import { type LucideIcon } from 'lucide-react';

/**
 * Shell placeholder for tabs whose content arrives in later milestones (SPEC §11). Keeps the
 * navigation honest and on-brand without faking lesson data (golden rule 4).
 */
export function TabPlaceholder({ title, subtitle, icon: Icon, milestone }: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  milestone: string;
}) {
  return (
    <section>
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-1 text-ink-soft">{subtitle}</p>

      <div className="mt-8 flex flex-col items-center gap-3 rounded-card bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-tint text-teal-dark">
          <Icon className="h-7 w-7" aria-hidden />
        </span>
        <p className="font-display font-semibold text-ink">Kommt in Kürze</p>
        <p className="text-sm text-ink-soft">{milestone}</p>
      </div>
    </section>
  );
}
