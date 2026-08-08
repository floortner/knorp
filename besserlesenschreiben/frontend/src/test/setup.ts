import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

/**
 * jsdom has no matchMedia; the theme layer (features/settings/theme.ts, A11yProvider) needs it.
 * Minimal stub: `setPrefersDark()` flips the value and notifies 'change' listeners, so specs can
 * simulate the OS toggling its color scheme.
 */
type Listener = (e: { matches: boolean }) => void;
let prefersDarkValue = false;
const listeners = new Set<Listener>();

export function setPrefersDark(value: boolean): void {
  prefersDarkValue = value;
  for (const l of listeners) l({ matches: value });
}

window.matchMedia = ((query: string) => ({
  matches: query.includes('prefers-color-scheme: dark') ? prefersDarkValue : false,
  media: query,
  addEventListener: (_type: string, l: Listener) => listeners.add(l),
  removeEventListener: (_type: string, l: Listener) => listeners.delete(l),
  // legacy API surface, unused but part of MediaQueryList
  addListener: (l: Listener) => listeners.add(l),
  removeListener: (l: Listener) => listeners.delete(l),
  onchange: null,
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

// Theme/a11y specs write to <html> and localStorage; reset so state never leaks across suites.
afterEach(() => {
  prefersDarkValue = false;
  listeners.clear();
  const root = document.documentElement;
  delete root.dataset.theme;
  delete root.dataset.dyslexic;
  root.style.fontSize = '';
  localStorage.clear();
});
