import type { AccentThemePreference } from '@bt/shared/types';
import { readonly, ref } from 'vue';

export const ACCENT_OPTIONS = [
  { value: 'purple', swatch: '#7355be' },
  { value: 'green', swatch: '#1b5b4a' },
  { value: 'blue', swatch: '#2563eb' },
] as const;

export type AccentTheme = AccentThemePreference;
const DEFAULT_ACCENT: AccentTheme = 'purple';
const _accentTheme = ref<AccentTheme>(DEFAULT_ACCENT);
let activeUserId: number | null = null;

export const accentTheme = readonly(_accentTheme);

export function normalizeAccentTheme(value: string | null | undefined): AccentTheme {
  return ACCENT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_ACCENT;
}

function applyAccent(value: AccentTheme): void {
  document.documentElement.dataset.kasanaAccent = value;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute('content', ACCENT_OPTIONS.find((option) => option.value === value)?.swatch ?? '#7355be');
}

const keyForUser = (userId: number): string => 'kasana-accent:user:' + userId;

export function setAccentTheme(value: AccentTheme): void {
  _accentTheme.value = value;
  applyAccent(value);
  if (activeUserId === null) return;
  try {
    localStorage.setItem(keyForUser(activeUserId), value);
  } catch {
    // Storage can be disabled; the server also stores per-account preferences.
  }
}

/** Restore preference after authentication, preferring server over per-user local cache. */
export function identifyAccentThemeForUser({
  userId,
  serverPreference,
}: {
  userId: number | null;
  serverPreference?: AccentTheme;
}): void {
  activeUserId = userId;
  let localPreference: string | null = null;
  if (userId !== null) {
    try {
      localPreference = localStorage.getItem(keyForUser(userId));
    } catch {
      // Storage unavailable.
    }
  }
  const value = normalizeAccentTheme(userId === null ? null : (serverPreference ?? localPreference));
  _accentTheme.value = value;
  applyAccent(value);
  if (userId !== null && serverPreference) {
    try {
      localStorage.setItem(keyForUser(userId), value);
    } catch {
      // Private browsing can disable storage.
    }
  }
}

/** Never show another account's preference on login or logout screens. */
export function identifyAccentTheme(): void {
  identifyAccentThemeForUser({ userId: null });
}
