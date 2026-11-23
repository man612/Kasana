import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { animateDialogMutation, observeDialogHeight } from './animate-dialog-height';

type Notify = (height: number) => void;

let notify: Notify = () => {};
const disconnect = vi.fn();
const observe = vi.fn();

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    notify = (height: number) => {
      callback(
        [{ borderBoxSize: [{ blockSize: height }] } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    };
  }

  observe = observe;
  disconnect = disconnect;
}

describe('dialog height transitions', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
    globalThis.ResizeObserver = originalResizeObserver;
  });

  function mountDialog() {
    const el = document.createElement('div');
    el.dataset.state = 'open';
    const cancel = vi.fn();
    const animate = vi.fn().mockImplementation(() => ({
      finished: new Promise<void>(() => {}),
      cancel,
    }));
    Object.defineProperty(el, 'animate', { value: animate });
    const cleanup = observeDialogHeight(el);
    return { el, animate, cancel, cleanup };
  }

  it('only animates subsequent meaningful height changes, not initial mount', () => {
    const { animate, cleanup } = mountDialog();
    expect(observe).toHaveBeenCalled();
    notify(300);
    notify(302);
    expect(animate).not.toHaveBeenCalled();
    notify(380);
    expect(animate).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenCalledWith(
      [{ height: '302px' }, { height: '380px' }],
      expect.objectContaining({ duration: 190 }),
    );
    cleanup();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('avoids animating height when reduced-motion is requested', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const { animate, cleanup } = mountDialog();
    notify(300);
    notify(380);
    expect(animate).not.toHaveBeenCalled();
    cleanup();
  });

  it('allows a large resize only after the dialog opens', () => {
    const { el, animate, cleanup } = mountDialog();
    el.dataset.state = 'closed';
    notify(240);
    notify(270);
    expect(animate).not.toHaveBeenCalled();
    el.dataset.state = 'open';
    notify(700);
    expect(animate).toHaveBeenCalledWith(
      [{ height: '270px' }, { height: '700px' }],
      expect.objectContaining({ duration: 190 }),
    );
    cleanup();
  });

  it('cancels an active resize when the keyboard resizes the viewport', () => {
    const { el, animate, cancel, cleanup } = mountDialog();
    notify(300);
    notify(380);
    el.setAttribute('data-keyboard-resize', '');
    notify(220);
    expect(cancel).toHaveBeenCalledOnce();
    el.removeAttribute('data-keyboard-resize');
    notify(380);
    expect(animate).toHaveBeenCalledOnce();
    cleanup();
  });

  it('uses sizes seen during the entrance as the baseline without starting a resize animation', () => {
    const { el, animate, cleanup } = mountDialog();
    const getAnimations = vi.fn().mockReturnValue([{ animationName: 'enter', playState: 'running' }]);
    Object.defineProperty(el, 'getAnimations', { value: getAnimations });
    notify(240);
    notify(330);
    expect(animate).not.toHaveBeenCalled();

    getAnimations.mockReturnValue([]);
    notify(390);
    expect(animate).toHaveBeenCalledWith(
      [{ height: '330px' }, { height: '390px' }],
      expect.objectContaining({ duration: 190 }),
    );
    cleanup();
  });

  it('retargets a discrete resize from the painted size during rapid changes', async () => {
    const { el, animate, cancel, cleanup } = mountDialog();
    document.body.append(el);
    let height = 300;
    vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 320, height));
    await Promise.race([
      animateDialogMutation(el, () => {
        height = 380;
      }),
      Promise.resolve(),
    ]);
    expect(animate).toHaveBeenCalledWith(
      [{ height: '300px' }, { height: '380px' }],
      expect.objectContaining({ duration: 190 }),
    );
    height = 335;
    await Promise.race([
      animateDialogMutation(el, () => {
        height = 270;
      }),
      Promise.resolve(),
    ]);
    expect(cancel).toHaveBeenCalledOnce();
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: '335px' }, { height: '270px' }],
      expect.objectContaining({ duration: 190 }),
    );
    cleanup();
    el.remove();
  });
});
