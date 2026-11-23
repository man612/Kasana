import type { TransactionTimeGrouping } from '@bt/shared/types';
import { addDays, isSameMonth, isSameYear, startOfDay, startOfWeek } from 'date-fns';

export interface TransactionTimeRange {
  from?: Date;
  to?: Date;
}

export function isTransactionTimeInRange(time: Date, { from, to }: TransactionTimeRange): boolean {
  return (!from || time >= from) && (!to || time <= to);
}

export interface TransactionTimeSection {
  kind: 'time-section';
  key: string;
  start: Date;
  end: Date;
}

export const isTimeSection = (item: unknown): item is TransactionTimeSection =>
  typeof item === 'object' && item !== null && 'kind' in item && item.kind === 'time-section';

export function buildTimeSectionRows<T>({
  items,
  mode,
  getTime,
  ascending = false,
}: {
  items: readonly T[];
  mode: Exclude<TransactionTimeGrouping, 'none'>;
  getTime: (item: T) => Date;
  ascending?: boolean;
}): (T | TransactionTimeSection)[] {
  // The API sorts transactions. Reconcile a group's representative timestamp with
  // that order too, including when its newest member is on an unloaded page.
  const dated = items.map((item) => ({ item, time: getTime(item) }));
  dated.sort((a, b) => (ascending ? +a.time - +b.time : +b.time - +a.time));
  const rows: (T | TransactionTimeSection)[] = [];
  let previous = NaN;
  for (const { item, time } of dated) {
    const start = mode === 'day' ? startOfDay(time) : startOfWeek(time, { weekStartsOn: 1 });
    if (+start !== previous) {
      rows.push({
        kind: 'time-section',
        key: `time-${mode}-${+start}`,
        start,
        end: mode === 'day' ? start : addDays(start, 6),
      });
      previous = +start;
    }
    rows.push(item);
  }
  return rows;
}

export function formatTransactionWeek({
  start,
  end,
  format,
}: {
  start: Date;
  end: Date;
  format: (date: Date, pattern: string) => string;
}): string {
  const startPattern = isSameMonth(start, end) ? 'd' : isSameYear(start, end) ? 'd MMMM' : 'd MMMM yyyy';
  return `${format(start, startPattern)}–${format(end, 'd MMMM yyyy')}`;
}
