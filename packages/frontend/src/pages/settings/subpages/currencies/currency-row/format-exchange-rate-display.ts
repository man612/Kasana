import { toLocalNumber } from '@/js/helpers/formatters';

/**
 * Currency-rate DISPLAY precision is not the same as the amount's minor-unit
 * scale. A tiny IDR/USD rate must show all significant digits instead of
 * rendering as 0 or a misleading rounded six-decimal approximation.
 */
export function formatExchangeRateDisplay(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 0.001) {
    return toLocalNumber(value, { minimumFractionDigits: 0, maximumSignificantDigits: 12 });
  }
  return toLocalNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}
