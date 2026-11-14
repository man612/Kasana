import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeDialogHeight } from './animate-dialog-height';

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
    const animate = vi.fn().mockImplementation(() => ({
      finished: new Promise<void>(() => {}),
      cancel: vi.fn(),
    }));
    Object.defineProperty(el, 'animate', { value: animate });
    const cleanup = observeDialogHeight(el);
    return { el, animate, cleanup };
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

  it('ignores an unstable initial state and dramatic layout changes', () => {
    const { el, animate, cleanup } = mountDialog();
    el.dataset.state = 'closed';
    notify(240);
    notify(270);
    el.dataset.state = 'open';
    notify(700);
    expect(animate).not.toHaveBeenCalled();
    cleanup();
  });
});
