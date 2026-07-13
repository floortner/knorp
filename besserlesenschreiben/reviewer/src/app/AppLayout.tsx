import { Link, NavLink, Outlet } from 'react-router-dom';
import { ClipboardCheck, Users } from 'lucide-react';
import { useStaffAuth } from '@/features/auth/auth-context';
import { useOpenRequestCount } from '@/features/queue/useQueue';
import { usePendingUserCount } from '@/features/users/useUsers';
import { BMark } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

/** Portal chrome: a slim top bar (brand + nav + reviewer identity + logout) over the routed Outlet.
 *  Desktop/tablet, full-width content (ARCHITECTURE §1a/§11). */
export function AppLayout() {
  const { reviewer, logout } = useStaffAuth();
  const isAdmin = reviewer?.role === 'admin';
  const openRequests = useOpenRequestCount().data ?? 0;
  const pendingUsers = usePendingUserCount(isAdmin).data ?? 0;

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition',
      isActive ? 'bg-teal-tint text-teal-dark' : 'text-ink-soft hover:bg-black/[0.02]',
    );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-5">
          <div className="flex items-center gap-5">
            {/* Brand mark + the signed-in reviewer, mirroring the family app's "(b) name". */}
            <Link to="/queue" className="flex items-center gap-2">
              <BMark className="h-8 w-8" />
              {reviewer && (
                <span className="text-lg font-bold text-ink">
                  {reviewer.name}
                  {isAdmin && <span className="ml-1 text-sm font-medium text-ink-soft">· Admin</span>}
                </span>
              )}
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/queue" className={navClass}>
                <ClipboardCheck className="size-4" aria-hidden /> Chats
                <NavBadge count={openRequests} />
              </NavLink>
              {/* User administration is admin-only (backend SPEC §6); hidden from plain reviewers. */}
              {isAdmin && (
                <NavLink to="/users" className={navClass}>
                  <Users className="size-4" aria-hidden /> Nutzer
                  <NavBadge count={pendingUsers} tone="amber" />
                </NavLink>
              )}
            </nav>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            Abmelden
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-screen-xl px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}

/** Small count badge shown after a nav label (hidden at 0). Teal = informational, amber = needs attention. */
function NavBadge({ count, tone = 'teal' }: { count: number; tone?: 'teal' | 'amber' }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white',
        tone === 'amber' ? 'bg-amber' : 'bg-teal',
      )}
      aria-label={`${count} offen`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
