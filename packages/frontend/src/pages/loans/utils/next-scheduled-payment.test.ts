import { format, parseISO } from 'date-fns';
import { describe, expect, it } from 'vitest';

import { nextScheduledPayment } from './next-scheduled-payment';

describe('nextScheduledPayment', () => {
  it.each([
    [31, '2024-01-01', '2024-02-10', '2024-02-29'],
    [31, '2026-01-01', '2026-04-30', '2026-04-30'],
    [15, '2026-07-20', '2026-06-27', '2026-08-15'],
    [1, '2025-01-01', '2025-12-31', '2026-01-01'],
    [null, '2025-01-01', '2025-12-31', null],
  ])('projects day %s after the account starts', (day, starts, today, expected) => {
    const next = nextScheduledPayment({ day, starts: parseISO(starts), today: parseISO(today) });
    expect(next && format(next, 'yyyy-MM-dd')).toBe(expected);
  });
});
