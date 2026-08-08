import { type ReactNode, createContext, useContext, useEffect } from 'react';
import { useActiveProfile } from '@/features/profile/useMe';
import { applyTheme, rememberAppearance, resolveTheme } from '@/features/settings/theme';
import type { Profile } from '@/lib/types';

/** Master audio switch (SPEC §6) read by voice/feedback features; defaults on until a profile loads. */
const SoundContext = createContext<boolean>(true);
export const useSoundOn = () => useContext(SoundContext);

/** Apply the profile's a11y settings to the document root (SPEC §6): font scale + dyslexic flag. */
function useApplyA11y(profile: Profile | undefined): void {
  const fontScale = profile?.fontScale ?? 1;
  const dyslexic = profile?.dyslexicFont ?? false;
  const appearance = profile?.appearance;
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${Math.round(fontScale * 100)}%`; // rem-based UI scales with the root
    root.dataset.dyslexic = dyslexic ? 'true' : 'false';
  }, [fontScale, dyslexic]);
  useEffect(() => {
    // Pre-load (no profile yet): keep whatever the index.html boot script resolved.
    if (!appearance) return;
    rememberAppearance(appearance);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(resolveTheme(appearance, mq.matches));
    if (appearance !== 'auto') return;
    const onChange = (e: MediaQueryListEvent) => applyTheme(resolveTheme('auto', e.matches));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [appearance]);
}

/**
 * Applies the active student's accessibility settings app-wide and exposes `soundOn`. Wraps the
 * authenticated app frame; the editing UI lands with the profile/settings screen (M6).
 */
export function A11yProvider({ children }: { children: ReactNode }) {
  const profile = useActiveProfile();
  useApplyA11y(profile);
  return <SoundContext.Provider value={profile?.soundOn ?? true}>{children}</SoundContext.Provider>;
}
