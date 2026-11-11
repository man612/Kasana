import { describe, expect, it } from 'vitest';

import { ACCENT_OPTIONS, normalizeAccentTheme } from './accent-theme';

describe('Kasana accent preference', () => {
  it('defaults to purple when no saved preference exists', () => {
    expect(normalizeAccentTheme(null)).toBe('purple');
  });

  it('accepts only registered accent colors', () => {
    for (const option of ACCENT_OPTIONS) {
      expect(normalizeAccentTheme(option.value)).toBe(option.value);
    }
    expect(normalizeAccentTheme('neon')).toBe('purple');
    expect(normalizeAccentTheme('')).toBe('purple');
  });
});
