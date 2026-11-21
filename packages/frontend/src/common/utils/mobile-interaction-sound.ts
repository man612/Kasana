/**
 * Optional, local-only feedback for interactive UI chrome on desktop and mobile.
 * Do not play for typing, read-out amounts, failed requests or user data.
 * No network calls or bundled audio assets; Android requires a direct user click
 * before Web Audio can start. Users may disable it in Appearance settings.
 */
const STORAGE_KEY = 'lajur:mobile-interaction-sound';
const MIN_SOUND_INTERVAL_MS = 100;
const MAX_RESUME_DELAY_MS = 250;

export const getMobileInteractionSoundEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
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
let requestGeneration = 0;
let lastStartedAt = -Infinity;

const playTone = (audio: AudioContext) => {
  if (audio.state !== 'running' || document.hidden || !getMobileInteractionSoundEnabled()) return;
  const startedAt = performance.now();
  if (startedAt - lastStartedAt < MIN_SOUND_INTERVAL_MS) return;
  lastStartedAt = startedAt;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(680, now);
  oscillator.frequency.exponentialRampToValueAtTime(480, now + 0.05);
  // Easier to hear on small speakers while remaining a brief UI cue.
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + 0.075);
};

export const previewInteractionSound = () => {
  if (!window.AudioContext || document.hidden || !getMobileInteractionSoundEnabled()) return;
  if (navigator.userActivation?.isActive === false) return;
  try {
    if (!context || context.state === 'closed') context = new window.AudioContext();
    const audio = context;
    const generation = ++requestGeneration;
    const requestedAt = performance.now();
    if (audio.state === 'running') {
      playTone(audio);
      return;
    }
    // Resume during the gesture, including after the mobile OS interrupts the PWA.
    void audio
      .resume()
      .then(() => {
        if (generation === requestGeneration && performance.now() - requestedAt < MAX_RESUME_DELAY_MS) playTone(audio);
      })
      .catch(() => undefined);
  } catch {
    // An unavailable output must not interrupt the user's action.
  }
};

export const installMobileInteractionSounds = (): void => {
  if (isInstalled) return;
  isInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) requestGeneration++;
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!getMobileInteractionSoundEnabled()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="menuitem"]');
      if (
        !control ||
        control.closest(':disabled, [disabled], [aria-disabled="true"], [inert], [data-interaction-sound-toggle]')
      )
        return;
      // Preview plays its own sound; the document click must not replay it.
      if (control.closest('[data-interaction-sound-preview]')) return;
      previewInteractionSound();
    },
    { capture: true, passive: true },
  );
};
