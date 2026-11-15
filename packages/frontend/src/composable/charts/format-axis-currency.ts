/**
 * Compact chart tick labels. Rupiah uses Indonesian units (rb, jt, miliar, triliun),
 * while non-IDR currencies retain conventional K/M/B/T suffixes.
 * The step controls precision so nearby Y-axis ticks never all render "Rp 2 jt".
 */
export const formatAxisCurrency = ({
  value,
  symbol,
  currencyCode,
  step,
}: {
  value: number;
  symbol: string;
  currencyCode?: string;
  step?: number;
}): string => {
  if (!Number.isFinite(value)) return '–';
  const idr = currencyCode === 'IDR' || /^Rp\.?\s*$/i.test(symbol);
  const prefix = idr ? 'Rp' : symbol;
  const sign = value < 0 ? '-' : '';
  const magnitude = Math.abs(value);
  const numberFormatter = (maximumFractionDigits: number) =>
    new Intl.NumberFormat(idr ? 'id-ID' : 'en-US', { maximumFractionDigits });

  const units = idr
    ? [
        { limit: 1e12, suffix: ' triliun' },
        { limit: 1e9, suffix: ' miliar' },
        { limit: 1e6, suffix: ' jt' },
        { limit: 1e3, suffix: ' rb' },
      ]
    : [
        { limit: 1e12, suffix: 'T' },
        { limit: 1e9, suffix: 'B' },
        { limit: 1e6, suffix: 'M' },
        { limit: 1e3, suffix: 'K' },
      ];
  let unitIndex = units.findIndex(({ limit }) => magnitude >= limit);
  if (unitIndex === -1) {
    return sign + prefix + numberFormatter(0).format(magnitude);
  }

  let unit = units[unitIndex]!;
  let normalizedStep = Math.abs(step ?? 0) / unit.limit;
  // A decimal place on "jt" represents Rp100.000. If consecutive ticks
  // differ by less than that, display full rupiah values rather than repeated labels.
  if (idr && normalizedStep > 0 && normalizedStep < 0.1) {
    return sign + prefix + numberFormatter(0).format(magnitude);
  }

  let digits = idr
    ? normalizedStep >= 1
      ? 0
      : 1
    : normalizedStep > 0
      ? Math.max(1, Math.min(2, Math.ceil(-Math.log10(normalizedStep))))
      : 1;

  if (idr) {
    const roundedMagnitude = Math.round((magnitude / unit.limit) * 10 ** digits) / 10 ** digits;
    // Promote after rounding so 999.999 rb becomes 1 jt, not 1.000 rb.
    if (roundedMagnitude >= 1_000 && unitIndex > 0) {
      unitIndex -= 1;
      unit = units[unitIndex]!;
      normalizedStep = Math.abs(step ?? 0) / unit.limit;
      if (normalizedStep > 0 && normalizedStep < 0.1) {
        return sign + prefix + numberFormatter(0).format(magnitude);
      }
      digits = normalizedStep >= 1 ? 0 : 1;
    }
  }

  return sign + prefix + numberFormatter(digits).format(magnitude / unit.limit) + unit.suffix;
};
