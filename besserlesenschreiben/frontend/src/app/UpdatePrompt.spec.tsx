import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// The SW machinery is vite-plugin-pwa's (tested upstream); what's OURS — and pinned here — is the
// banner's render logic, above all the mid-lesson suppression (ARCHITECTURE §7: prompt-to-update,
// never interrupt a lesson).
const setNeedRefresh = vi.fn();
const updateServiceWorker = vi.fn();
let needRefresh = true;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  }),
}));

const { UpdatePrompt } = await import('./UpdatePrompt');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <UpdatePrompt />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  needRefresh = true;
  setNeedRefresh.mockClear();
  updateServiceWorker.mockClear();
});

describe('UpdatePrompt', () => {
  it('offers the new version in the shell when an update is waiting', () => {
    renderAt('/app/lernen');
    expect(screen.getByRole('status')).toHaveTextContent('Neue Version verfügbar – neu laden?');
  });

  it('renders nothing when no update is waiting', () => {
    needRefresh = false;
    renderAt('/app/lernen');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('stays hidden during a lesson even when an update is waiting (never interrupt mid-lesson)', () => {
    renderAt('/app/lesson');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('"Neu laden" activates the waiting service worker (with reload)', async () => {
    const user = userEvent.setup();
    renderAt('/app/erfolge');
    await user.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('"Später" dismisses the offer without updating', async () => {
    const user = userEvent.setup();
    renderAt('/app/erfolge');
    await user.click(screen.getByRole('button', { name: 'Später' }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });
});
