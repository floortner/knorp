import { describe, expect, it } from 'vitest';
import { createActiveTimer } from './active-timer';

/** Deterministic clock + a minimal document whose visibility we control. */
function harness(startVisible = true) {
  let t = 0;
  const listeners = new Set<() => void>();
  const doc = {
    visibilityState: (startVisible ? 'visible' : 'hidden') as DocumentVisibilityState,
    addEventListener: (_: string, l: () => void) => void listeners.add(l),
    removeEventListener: (_: string, l: () => void) => void listeners.delete(l),
  };
  return {
    timer: createActiveTimer(() => t, doc),
    tick: (ms: number) => (t += ms),
    setVisible(visible: boolean) {
      doc.visibilityState = visible ? 'visible' : 'hidden';
      for (const l of [...listeners]) l();
    },
    listenerCount: () => listeners.size,
  };
}

describe('createActiveTimer', () => {
  it('counts visible time', () => {
    const h = harness();
    h.tick(1200);
    expect(h.timer.elapsedMs()).toBe(1200);
  });

  it('does not count time while the page is hidden', () => {
    const h = harness();
    h.tick(1000);
    h.setVisible(false);
    h.tick(1_800_000); // dinner break
    h.setVisible(true);
    h.tick(500);
    expect(h.timer.elapsedMs()).toBe(1500);
  });

  it('restart resets, including mid-hidden', () => {
    const h = harness();
    h.tick(5000);
    h.setVisible(false);
    h.timer.restart(); // e.g. next item mounted while hidden (advance timeout fired)
    h.tick(9000);
    h.setVisible(true);
    h.tick(700);
    expect(h.timer.elapsedMs()).toBe(700);
  });

  it('starts paused when created while hidden', () => {
    const h = harness(false);
    h.tick(4000);
    expect(h.timer.elapsedMs()).toBe(0);
    h.setVisible(true);
    h.tick(300);
    expect(h.timer.elapsedMs()).toBe(300);
  });

  it('dispose removes the listener', () => {
    const h = harness();
    expect(h.listenerCount()).toBe(1);
    h.timer.dispose();
    expect(h.listenerCount()).toBe(0);
  });
});
