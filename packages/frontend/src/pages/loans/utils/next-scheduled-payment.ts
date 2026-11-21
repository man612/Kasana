import { addMonths, endOfMonth, getDate, isBefore, max, setDate, startOfDay, startOfMonth } from 'date-fns';

/** Projects the configured day without claiming that the lender has issued a bill. */
export function nextScheduledPayment({ day, starts, today }: { day: number | null; starts: Date; today: Date }) {
  if (day === null || !Number.isInteger(day) || day < 1 || day > 31) return null;
  const reference = max([startOfDay(starts), startOfDay(today)]);
  const month = startOfMonth(reference);
  const scheduledDay = (date: Date) => setDate(date, Math.min(day, getDate(endOfMonth(date))));
  const candidate = scheduledDay(month);
  return isBefore(candidate, reference) ? scheduledDay(addMonths(month, 1)) : candidate;
}
