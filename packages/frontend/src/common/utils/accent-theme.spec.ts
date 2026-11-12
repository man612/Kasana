import { beforeEach, describe, expect, it } from 'vitest';

import {
  ACCENT_OPTIONS,
  accentTheme,
  identifyAccentThemeForUser,
  normalizeAccentTheme,
  setAccentTheme,
} from './accent-theme';

describe('Kasana accent preference', () => {
  beforeEach(() => {
    localStorage.clear();
    identifyAccentThemeForUser({ userId: null });
  });

  it('isolates account A from account B even in the same browser', () => {
    identifyAccentThemeForUser({ userId: 42 });
    setAccentTheme('green');
    expect(accentTheme.value).toBe('green');
    expect(localStorage.getItem('kasana-accent:user:42')).toBe('green');

    identifyAccentThemeForUser({ userId: 77 });
    expect(accentTheme.value).toBe('purple');
    setAccentTheme('blue');

    identifyAccentThemeForUser({ userId: 42 });
    expect(accentTheme.value).toBe('green');
    identifyAccentThemeForUser({ userId: 77 });
    expect(accentTheme.value).toBe('blue');

    identifyAccentThemeForUser({ userId: null });
    expect(accentTheme.value).toBe('purple');
  });

  it('prefers the server-saved accent for the logged-in account', () => {
    localStorage.setItem('kasana-accent:user:42', 'green');
    identifyAccentThemeForUser({ userId: 42, serverPreference: 'blue' });
    expect(accentTheme.value).toBe('blue');
    expect(localStorage.getItem('kasana-accent:user:42')).toBe('blue');
  });

  it('never uses the legacy global storage key for a second account', () => {
    localStorage.setItem('kasana-accent', 'green');
    identifyAccentThemeForUser({ userId: 777 });
    expect(accentTheme.value).toBe('purple');
  });
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
