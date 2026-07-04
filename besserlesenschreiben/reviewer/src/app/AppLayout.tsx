import { Link, NavLink, Outlet } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Portal chrome: a slim top bar (brand + nav + reviewer identity + logout) over the routed Outlet.
 *  Desktop/tablet, full-width content (ARCHITECTURE §1a/§11). */
export function AppLayout() {
  const { reviewer, logout } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition',
      isActive ? 'bg-teal-tint text-teal-dark' : 'text-ink-soft hover:bg-black/[0.02]',
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-5">
          <div className="flex items-center gap-5">
            <Link to="/queue" className="flex items-center gap-2 font-semibold text-ink">
              <ClipboardCheck className="size-5 text-teal-dark" aria-hidden />
              blesen · Review
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/queue" className={navClass}>
                Warteschlange
              </NavLink>
              {/* User administration + lexeme curation are admin-only (backend SPEC §6); hidden from plain reviewers. */}
              {isAdmin && (
                <NavLink to="/users" className={navClass}>
                  Nutzer
                </NavLink>
              )}
              {isAdmin && (
                <NavLink to="/lexemes" className={navClass}>
                  Wortschatz
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            {reviewer && (
              <span>
                {reviewer.name}
                {isAdmin && ' · Admin'}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Abmelden
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
