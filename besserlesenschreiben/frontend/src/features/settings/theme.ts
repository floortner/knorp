import type { Profile } from '@/lib/types';

/**
 * Night mode (SPEC §6). The persisted setting is the *mode* (`appearance`: auto|light|dark, a
 * profile setting like fontScale); the DOM only ever carries the *resolved* theme
 * (`html[data-theme='light'|'dark']`), so index.css needs exactly one dark selector.
 *
 * localStorage mirrors the mode so the inline boot script in index.html can theme the pre-auth
 * screens and the first paint (no light flash) before `/me` arrives.
 */
export const APPEARANCE_KEY = 'blsb.appearance';

export type Appearance = Profile['appearance'];
export type ResolvedTheme = 'light' | 'dark';

/** Keep in sync with the boot script in index.html and the manifest brand color. */
const THEME_COLOR = { light: '#27A99B', dark: '#151d1b' } as const;

export function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(appearance: Appearance, dark: boolean): ResolvedTheme {
  if (appearance === 'light') return 'light';
  if (appearance === 'dark') return 'dark';
  return dark ? 'dark' : 'light';
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

/** Mirror the mode for the boot script; storage may be unavailable (private mode) — best effort. */
export function rememberAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {
    /* noop */
  }
}
