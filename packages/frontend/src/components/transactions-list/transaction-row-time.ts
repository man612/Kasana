import { format, isValid } from 'date-fns';

export function formatTransactionRowTime({
  value,
  hideDate,
  showTime,
}: {
  value: string | number | Date;
  hideDate?: boolean;
  showTime?: boolean;
}) {
  if (hideDate) return '';
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (!isValid(date) || (showTime && dateOnly)) return '';
  return format(date, showTime ? 'HH:mm' : 'd MMM y');
}
