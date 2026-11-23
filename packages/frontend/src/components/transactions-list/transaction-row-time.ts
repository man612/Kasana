import { getLocalTimeZoneLabel } from '@/common/utils/indonesian-time';
import { format, isValid, parseISO } from 'date-fns';

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
  const date = dateOnly ? parseISO(value) : new Date(value);
  if (!isValid(date) || (showTime && dateOnly)) return '';
  return showTime ? `${format(date, 'HH:mm')} ${getLocalTimeZoneLabel(date)}` : format(date, 'd MMM y');
}
