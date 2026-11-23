import { describe, expect, it } from 'vitest';

import { sameTagSelection } from './tag-selection';

describe('sameTagSelection', () => {
  it('treats reordered and reverted selections as unchanged', () => {
    expect(sameTagSelection({ initial: ['a', 'b'], draft: ['b', 'a'] })).toBe(true);
    expect(sameTagSelection({ initial: ['a'], draft: ['a'] })).toBe(true);
  });

  it('distinguishes replacements, additions and removals', () => {
    expect(sameTagSelection({ initial: ['a'], draft: ['b'] })).toBe(false);
    expect(sameTagSelection({ initial: ['a'], draft: ['a', 'b'] })).toBe(false);
    expect(sameTagSelection({ initial: ['a'], draft: [] })).toBe(false);
  });
});
