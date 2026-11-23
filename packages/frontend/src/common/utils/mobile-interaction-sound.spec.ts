import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installMobileInteractionSounds,
  previewInteractionSound,
  setMobileInteractionSoundEnabled,
} from './mobile-interaction-sound';

const startTone = vi.fn();
const setGainLevel = vi.fn();
const resumeAudio = vi.fn(async () => {});
let clock = 0;
class FakeAudioContext {
  static lastCreated: FakeAudioContext | null = null;
  state: AudioContextState = 'running';
  currentTime = 0;
  destination = {} as AudioNode;

  constructor() {
    FakeAudioContext.lastCreated = this;
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: startTone,
      stop: vi.fn(),
    } as unknown as OscillatorNode;
  }

  createGain() {
    return {
      gain: { setValueAtTime: setGainLevel, exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    } as unknown as GainNode;
  }

  async resume() {
    await resumeAudio();
    this.state = 'running';
  }
}

describe('Optional desktop and Android click feedback', () => {
  beforeAll(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    installMobileInteractionSounds();
  });

  beforeEach(() => {
    clock += 500;
    localStorage.clear();
    document.body.innerHTML = '';
    startTone.mockClear();
    setGainLevel.mockClear();
    resumeAudio.mockClear();
    if (FakeAudioContext.lastCreated) FakeAudioContext.lastCreated.state = 'running';
  });

  afterAll(() => {
    setMobileInteractionSoundEnabled(false);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('plays by default for a first-time user', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    expect(startTone).toHaveBeenCalledTimes(1);
  });

  it('plays once for a normal button on desktop', () => {
    setMobileInteractionSoundEnabled(true);
    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    expect(startTone).toHaveBeenCalledTimes(1);
    expect(setGainLevel).toHaveBeenCalledWith(0.1, 0);
  });

  it('respects an explicit off preference', () => {
    setMobileInteractionSoundEnabled(false);
    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    expect(startTone).not.toHaveBeenCalled();
  });

  it('does not double-play the explicit Test sound action', () => {
    setMobileInteractionSoundEnabled(true);
    const button = document.createElement('button');
    button.dataset.interactionSoundPreview = '';
    button.addEventListener('click', previewInteractionSound);
    document.body.append(button);
    button.click();
    expect(startTone).toHaveBeenCalledTimes(1);
  });

  it('rate-limits closely spaced gestures', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    clock += 50;
    button.click();
    expect(startTone).toHaveBeenCalledTimes(1);
    clock += 100;
    button.click();
    expect(startTone).toHaveBeenCalledTimes(2);
  });

  it('recovers when a resume is rejected and the next gesture succeeds', async () => {
    if (!FakeAudioContext.lastCreated) previewInteractionSound();
    FakeAudioContext.lastCreated!.state = 'suspended';
    resumeAudio.mockRejectedValueOnce(new Error('audio unavailable'));
    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    await Promise.resolve();
    expect(startTone).not.toHaveBeenCalled();
    clock += 500;
    button.click();
    await vi.waitFor(() => expect(startTone).toHaveBeenCalledTimes(1));
  });

  it('ignores disabled controls', () => {
    setMobileInteractionSoundEnabled(true);
    const button = document.createElement('button');
    button.disabled = true;
    document.body.append(button);
    button.click();
    expect(startTone).not.toHaveBeenCalled();
  });

  it('resumes a suspended Web Audio context and plays the first gesture', async () => {
    setMobileInteractionSoundEnabled(true);
    // A prior context may be suspended when the browser returns from background.
    previewInteractionSound();
    startTone.mockClear();
    if (!FakeAudioContext.lastCreated) throw new Error('AudioContext was not created');
    FakeAudioContext.lastCreated.state = 'suspended';
    clock += 500;

    const button = document.createElement('button');
    document.body.append(button);
    button.click();
    await vi.waitFor(() => expect(startTone).toHaveBeenCalledTimes(1));
    expect(resumeAudio).toHaveBeenCalledTimes(1);
  });
});
