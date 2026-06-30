import { Link, Outlet } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { Button } from '@/components/ui/button';

/** Portal chrome: a slim top bar (brand + reviewer identity + logout) over the routed Outlet.
 *  Desktop/tablet, full-width content (ARCHITECTURE §1a/§11). */
export function AppLayout() {
  const { reviewer, logout } = useStaffAuth();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-5">
          <Link to="/queue" className="flex items-center gap-2 font-semibold text-ink">
            <ClipboardCheck className="size-5 text-teal-dark" aria-hidden />
            blesen · Review
          </Link>
          <div className="flex items-center gap-3 text-sm text-ink-soft">
            {reviewer && (
              <span>
                {reviewer.name}
                {reviewer.role === 'admin' && ' · Admin'}
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
