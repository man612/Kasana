/**
 * Optional, local-only feedback for interactive UI chrome on small touch screens.
 * Do not play for typing, read-out amounts, failed requests or user data.
 * No network calls or bundled audio assets; Android requires a direct user click
 * before Web Audio can start. Disabled by default for accessibility.
 */
const STORAGE_KEY = 'lajur:mobile-interaction-sound';

export const getMobileInteractionSoundEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
};

export const setMobileInteractionSoundEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Private browsing may disable persistence; the app remains usable.
  }
};

let context: AudioContext | null = null;
let isInstalled = false;

const playTapSound = () => {
  if (!window.AudioContext) return;
  try {
    context ??= new AudioContext();
    if (context.state !== 'running') {
      void context.resume().catch(() => undefined);
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(560, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.035);
    gain.gain.setValueAtTime(0.008, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  } catch {
    // Audio is optional; a blocked audio context must never break a button.
  }
};

export const installMobileInteractionSounds = (): void => {
  if (isInstalled) return;
  isInstalled = true;

  document.addEventListener(
    'click',
    (event) => {
      if (!getMobileInteractionSoundEnabled() || window.innerWidth > 767) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        'button, a[href], [role="button"], [role="tab"], [role="menuitem"]',
      );
      if (!control || control.matches(':disabled, [disabled], [aria-disabled="true"]')) return;
      playTapSound();
    },
    { passive: true },
  );
};
