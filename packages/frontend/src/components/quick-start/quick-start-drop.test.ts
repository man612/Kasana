import { describe, expect, it } from 'vitest';

import { resolveQuickStartDrop } from './quick-start-drop';

describe('Quick Start pointer cancellation', () => {
  const previous = { x: 0.1, y: 0.2 };
  const moved = { x: 0.8, y: 0.6 };

  it('persists the moved position when the finger is released normally', () => {
    expect(resolveQuickStartDrop({ canceled: false, dragging: true, previous, current: moved })).toEqual({
      kind: 'persist',
      position: moved,
    });
  });

  it('restores the starting position after a cancelled drag', () => {
    expect(resolveQuickStartDrop({ canceled: true, dragging: true, previous, current: moved })).toEqual({
      kind: 'restore',
      position: previous,
    });
  });

  it('restores the default position when cancelling a first-time drag', () => {
    expect(resolveQuickStartDrop({ canceled: true, dragging: true, previous: null, current: moved })).toEqual({
      kind: 'restore',
      position: null,
    });
  });

  it('does nothing when the pointer was cancelled before dragging started', () => {
    expect(resolveQuickStartDrop({ canceled: true, dragging: false, previous, current: moved })).toEqual({
      kind: 'none',
    });
  });
});
