import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/**
 * Prompt-to-update banner (ARCHITECTURE §7): the SW is registered with `registerType: 'prompt'`, so a
 * new version never activates on its own. While a lesson is running the banner stays hidden — the
 * student finishes the exercise first, then sees the gentle offer back in the shell. Reloading is
 * always the student's choice ("Später" just hides the offer until the next app start).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // An installed PWA can stay alive for days — without this, a deploy is only picked up on a
      // cold start. Hourly is plenty; the banner still waits for the student.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  const { pathname } = useLocation();

  if (!needRefresh || pathname === '/app/lesson') return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-card bg-white px-4 py-3 shadow-lg ring-1 ring-black/10"
    >
      <p className="text-sm font-medium text-ink">Neue Version verfügbar – neu laden?</p>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
          Später
        </Button>
        <Button size="sm" onClick={() => void updateServiceWorker(true)}>
          Neu laden
        </Button>
      </div>
    </div>
  );
}
