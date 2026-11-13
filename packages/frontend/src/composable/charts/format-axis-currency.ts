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
  const prefix = idr ? 'Rp ' : symbol;
  const magnitude = Math.abs(value);
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
  const unit = units.find(({ limit }) => magnitude >= limit);
  if (!unit) {
    return prefix + new Intl.NumberFormat(idr ? 'id-ID' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  }
  const normalizedStep = Math.abs(step ?? 0) / unit.limit;
  const digits = normalizedStep > 0 ? Math.max(1, Math.min(4, Math.ceil(-Math.log10(normalizedStep)))) : 1;
  if (normalizedStep > 0 && normalizedStep < 0.0001) {
    return prefix + new Intl.NumberFormat(idr ? 'id-ID' : 'en-US', { maximumFractionDigits: 0 }).format(value);
  }
  return (
    prefix +
    new Intl.NumberFormat(idr ? 'id-ID' : 'en-US', { maximumFractionDigits: digits }).format(value / unit.limit) +
    unit.suffix
  );
};
