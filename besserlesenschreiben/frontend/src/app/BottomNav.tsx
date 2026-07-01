import { NavLink } from 'react-router-dom';
import { BookOpen, MessageCircle, Trophy, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/app/lernen', label: 'Lernen', icon: BookOpen },
  { to: '/app/liga', label: 'Liga', icon: Trophy },
  { to: '/app/chat', label: 'Chat', icon: MessageCircle },
  { to: '/app/profil', label: 'Profil', icon: User },
];

/** Mobile bottom tab bar (SPEC §2). The parent area is never reachable from here — via /profil, PIN-gated. */
export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-black/5 bg-canvas/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Hauptnavigation"
    >
      <ul className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-teal-dark' : 'text-ink-soft/70',
                )
              }
            >
              <Icon className="h-6 w-6" aria-hidden />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
