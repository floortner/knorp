import { describe, expect, it } from 'vitest';
import { applyTheme, rememberAppearance, resolveTheme, APPEARANCE_KEY } from './theme';

describe('resolveTheme', () => {
  it('explicit modes ignore the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it("'auto' follows the OS preference", () => {
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets data-theme and updates the theme-color meta', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#27A99B';
    document.head.appendChild(meta);
    try {
      applyTheme('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(meta.content).toBe('#151d1b');
      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
      expect(meta.content).toBe('#27A99B');
    } finally {
      meta.remove();
    }
  });
});

describe('rememberAppearance', () => {
  it('mirrors the mode to localStorage', () => {
    rememberAppearance('dark');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
  });
});
