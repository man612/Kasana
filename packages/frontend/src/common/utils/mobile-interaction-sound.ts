/**
 * Optional, local-only feedback for interactive UI chrome on desktop and mobile.
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

const playTone = (audio: AudioContext) => {
  if (audio.state !== 'running') return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(680, now);
  oscillator.frequency.exponentialRampToValueAtTime(480, now + 0.05);
  gain.gain.setValueAtTime(0.018, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.06);
};

export const previewInteractionSound = () => {
  if (!window.AudioContext) return;
  try {
    context ??= new AudioContext();
    // The first tap often resumes an AudioContext suspended by autoplay policy.
    // Previously it returned without ever playing the first sound.
    if (context.state !== 'running') {
      void context.resume().then(() => playTone(context!)).catch(() => undefined);
      return;
    }
    playTone(context);
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
      if (!getMobileInteractionSoundEnabled()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        'button, a[href], [role="button"], [role="tab"], [role="menuitem"]',
      );
      if (!control || control.matches(':disabled, [disabled], [aria-disabled="true"]')) return;
      previewInteractionSound();
    },
    { passive: true },
  );
};
