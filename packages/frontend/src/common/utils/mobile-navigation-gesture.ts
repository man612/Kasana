import { ref } from 'vue';

/** Optional app-level swipe navigation; not the mandatory Android OS back gesture. */
const KEY = 'lajur:mobile-page-swipe';
const savedValue = (): boolean => {
  try { return window.localStorage.getItem(KEY) === 'on'; }
  catch { return false; }
};
export const mobilePageSwipeEnabled = ref(savedValue());
export const setMobilePageSwipeEnabled = (enabled: boolean) => {
  mobilePageSwipeEnabled.value = enabled;
  try { window.localStorage.setItem(KEY, enabled ? 'on' : 'off'); }
  catch { /* keep the in-memory choice when storage is unavailable */ }
};
