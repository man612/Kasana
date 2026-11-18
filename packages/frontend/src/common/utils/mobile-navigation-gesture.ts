import { ref } from 'vue';

/** Configurable mobile swipes; preserve Android OS back gestures and interactive elements. */
const KEY = 'lajur:mobile-page-swipe';
const savedValue = (): boolean => {
  try { return window.localStorage.getItem(KEY) !== 'off'; }
  catch { return true; }
};
export const mobilePageSwipeEnabled = ref(savedValue());
export const setMobilePageSwipeEnabled = (enabled: boolean) => {
  mobilePageSwipeEnabled.value = enabled;
  try { window.localStorage.setItem(KEY, enabled ? 'on' : 'off'); }
  catch { /* keep the in-memory choice when storage is unavailable */ }
};
