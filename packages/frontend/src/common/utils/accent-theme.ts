import { readonly, ref } from 'vue';

export const ACCENT_OPTIONS = [
  { value: 'purple', swatch: '#7355be' },
  { value: 'green', swatch: '#1b5b4a' },
  { value: 'blue', swatch: '#2563eb' },
] as const;

export type AccentTheme = (typeof ACCENT_OPTIONS)[number]['value'];
const STORAGE_KEY = 'kasana-accent';
const DEFAULT_ACCENT: AccentTheme = 'purple';
const _accentTheme = ref<AccentTheme>(DEFAULT_ACCENT);

export const accentTheme = readonly(_accentTheme);

export function normalizeAccentTheme(value: string | null): AccentTheme {
  return ACCENT_OPTIONS.find((option) => option.value === value)?.value ?? DEFAULT_ACCENT;
}

function applyAccent(value: AccentTheme): void {
  document.documentElement.dataset.kasanaAccent = value;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  meta?.setAttribute('content', ACCENT_OPTIONS.find((option) => option.value === value)?.swatch ?? '#7355be');
}

export function setAccentTheme(value: AccentTheme): void {
  _accentTheme.value = value;
  applyAccent(value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage can be disabled in privacy mode; the active tab still updates.
  }
}

export function identifyAccentTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing or disabled storage: fall back to purple.
  }
  const value = normalizeAccentTheme(stored);
  _accentTheme.value = value;
  applyAccent(value);
}
