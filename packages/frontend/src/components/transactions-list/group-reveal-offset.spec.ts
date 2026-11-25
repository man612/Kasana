import { describe, expect, it } from 'vitest';

import { groupRevealOffset } from './group-reveal-offset';

describe('groupRevealOffset', () => {
  const viewport = { top: 50, bottom: 450 };

  it('keeps the position when the group fits', () => {
    expect(groupRevealOffset({ viewport, group: { top: 250, bottom: 420 } })).toBe(0);
  });

  it('reveals only the content below the scroll viewport', () => {
    expect(groupRevealOffset({ viewport, group: { top: 345, bottom: 497 } })).toBe(47);
  });

  it('keeps the header below the sticky time heading for groups taller than the viewport', () => {
    expect(groupRevealOffset({ viewport, group: { top: 345, bottom: 900 }, stickyHeight: 36 })).toBe(259);
  });

  it('does not scroll past a header already at the top of the viewport', () => {
    expect(groupRevealOffset({ viewport, group: { top: 48, bottom: 900 } })).toBe(0);
  });
});
