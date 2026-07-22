import { Outlet } from 'react-router-dom';
import { A11yProvider } from '@/features/settings/a11y';
import { BottomNav } from './BottomNav';

/** App frame for the student tabs: a centered mobile column with the bottom tab bar. */
export function AppShell() {
  return (
    <A11yProvider>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col">
        <main className="flex-1 px-5 pb-24 pt-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </A11yProvider>
  );
}
