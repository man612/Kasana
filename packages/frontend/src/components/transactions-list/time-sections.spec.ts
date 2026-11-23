import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { describe, expect, it } from 'vitest';

import { buildTimeSectionRows, formatTransactionWeek, isTimeSection } from './time-sections';

const getTime = (time: Date) => time;

describe('transaction time sections', () => {
  it('begins weeks on Monday and rolls Sunday into the same week', () => {
    const monday = new Date(2026, 10, 16, 23);
    const sunday = new Date(2026, 10, 22, 23, 59);
    const next = new Date(2026, 10, 23);
    const rows = buildTimeSectionRows({ items: [monday, sunday, next], mode: 'week', getTime });

    expect(rows.filter(isTimeSection).map(({ start, end }) => [start.getDate(), end.getDate()])).toEqual([
      [23, 29],
      [16, 22],
    ]);
    expect(rows.filter((row) => !isTimeSection(row))).toEqual([next, sunday, monday]);
  });

  it('groups at local midnight and preserves the order of tied transaction keys', () => {
    const late = { id: 'late', time: new Date(2026, 10, 19, 23, 59, 59) };
    const first = { id: 'first', time: new Date(2026, 10, 20) };
    const second = { id: 'second', time: new Date(2026, 10, 20) };
    const rows = buildTimeSectionRows({
      items: [first, second, late],
      mode: 'day',
      ascending: true,
      getTime: (item) => item.time,
    });

    expect(rows.filter(isTimeSection).map(({ start }) => start.getDate())).toEqual([19, 20]);
    expect(rows.flatMap((row) => (isTimeSection(row) ? [] : [row.id]))).toEqual(['late', 'first', 'second']);
  });

  it('reuses the section when the next page has more rows from the same date', () => {
    const first = new Date(2026, 10, 20, 16);
    const next = new Date(2026, 10, 20, 8);
    const firstPage = buildTimeSectionRows({ items: [first], mode: 'day', getTime });
    const sections = buildTimeSectionRows({ items: [first, next], mode: 'day', getTime }).filter(isTimeSection);
    expect(sections).toEqual(firstPage.filter(isTimeSection));
  });

  it.each([
    [new Date(2026, 10, 16), new Date(2026, 10, 22), '16–22 November 2026'],
    [new Date(2026, 7, 31), new Date(2026, 8, 6), '31 Agustus–6 September 2026'],
    [new Date(2026, 11, 28), new Date(2027, 0, 3), '28 Desember 2026–3 Januari 2027'],
  ])('shows both calendar boundaries when formatting a week from %s to %s', (start, end, label) => {
    expect(
      formatTransactionWeek({ start, end, format: (date, pattern) => format(date, pattern, { locale: id }) }),
    ).toBe(label);
  });
});
