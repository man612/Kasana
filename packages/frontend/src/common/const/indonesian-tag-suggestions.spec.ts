import { describe, expect, it } from 'vitest';

import { availableTagSuggestions, INDONESIAN_TAG_SUGGESTIONS } from './indonesian-tag-suggestions';

describe('Indonesia-first optional tag suggestions', () => {
  it('provides plenty of valid, distinct preset names and colors', () => {
    expect(INDONESIAN_TAG_SUGGESTIONS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(INDONESIAN_TAG_SUGGESTIONS.map((tag) => tag.name.toLowerCase())).size).toBe(
      INDONESIAN_TAG_SUGGESTIONS.length,
    );
    expect(INDONESIAN_TAG_SUGGESTIONS.every((tag) => /^#[0-9a-f]{6}$/i.test(tag.color))).toBe(true);
  });
  it('does not offer names already in the account and supports case-insensitive search', () => {
    const result = availableTagSuggestions(['PRIORITAS', 'rumah'], 'PRIO');
    expect(result.map((tag) => tag.name)).toEqual([]);
    expect(availableTagSuggestions(['Keinginan'], 'kebut').map((tag) => tag.name)).toContain('Kebutuhan');
  });
});
