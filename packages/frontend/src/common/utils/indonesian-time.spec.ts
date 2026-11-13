import { describe, expect, it, vi } from 'vitest';

import { getLocalTimeZoneLabel } from './indonesian-time';

describe('Indonesian local time-zone label', () => {
  it.each([
    ['Asia/Jakarta', 'WIB'],
    ['Asia/Makassar', 'WITA'],
    ['Asia/Jayapura', 'WIT'],
  ])('maps %s correctly', (zone, label) => {
    const original = Intl.DateTimeFormat;
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(((
      ...args: ConstructorParameters<typeof Intl.DateTimeFormat>
    ) => {
      const formatter = new original(...args);
      return Object.assign(formatter, { resolvedOptions: () => ({ ...formatter.resolvedOptions(), timeZone: zone }) });
    }) as typeof Intl.DateTimeFormat);
    expect(getLocalTimeZoneLabel()).toBe(label);
    vi.restoreAllMocks();
  });
});
