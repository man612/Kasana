import { describe, expect, it } from 'vitest';

import { resolveTimeZoneLabel } from './indonesian-time';

describe('Indonesian local time-zone label', () => {
  it.each([
    ['Asia/Jakarta', 420, 'WIB'],
    ['Asia/Pontianak', 420, 'WIB'],
    ['Asia/Makassar', 480, 'WITA'],
    ['Asia/Jayapura', 540, 'WIT'],
    ['Europe/London', 60, 'UTC+01:00'],
    ['America/New_York', -300, 'UTC-05:00'],
  ])('maps %s correctly', (zone, offset, expected) => {
    expect(resolveTimeZoneLabel(zone, offset)).toBe(expected);
  });
});
