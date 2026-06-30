import { type ReactNode } from 'react';

/** Centered card used by the staff login/code screens — calm, neutral, desktop-centered. */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 shadow-sm ring-1 ring-line">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
