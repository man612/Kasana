/** Human-readable duration without hiding the canonical month count. */
export const formatLoanDuration = (months: number, locale = 'id'): string => {
  if (!Number.isInteger(months) || months <= 0) return '';
  const indonesian = locale.toLowerCase().startsWith('id');
  const year = indonesian ? 'tahun' : 'year';
  const month = indonesian ? 'bulan' : 'month';
  const fullYears = Math.floor(months / 12);
  const leftover = months % 12;
  const decimalYears = (months / 12).toLocaleString(indonesian ? 'id-ID' : 'en-US', {
    maximumFractionDigits: 2,
  });
  if (months % 6 === 0 && months <= 36) {
    return `${months} ${month} (${decimalYears} ${year}${!indonesian && months !== 12 ? 's' : ''})`;
  }
  if (fullYears > 0) {
    const yearsLabel = `${fullYears} ${year}${!indonesian && fullYears !== 1 ? 's' : ''}`;
    const monthsLabel = leftover ? ` ${leftover} ${month}${!indonesian && leftover !== 1 ? 's' : ''}` : '';
    return `${months} ${month}${!indonesian && months !== 1 ? 's' : ''} (${yearsLabel}${monthsLabel})`;
  }
  return `${months} ${month}${!indonesian && months !== 1 ? 's' : ''} (${decimalYears} ${year}${!indonesian ? 's' : ''})`;
};
