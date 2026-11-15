import { getAmountSeparators, parseAmountInput } from '@/components/fields/utils/formatted-amount';
import { afterEach, describe, expect, it } from 'vitest';

import { currencyDisplayPreference, formatUIAmount, numberFormatLocale } from './formatters';

const originalLocale = numberFormatLocale.value;
const originalPreference = currencyDisplayPreference.value;
afterEach(() => {
  numberFormatLocale.value = originalLocale;
  currencyDisplayPreference.value = originalPreference;
});

for (const locale of ['id-ID', 'en-US']) {
  for (const currency of ['IDR', 'USD']) {
    describe(`${locale} ${currency} display and amount-entry compatibility`, () => {
      it.each([0, 0.01, 20_000, 20_000.5, -20_000.5, 1_000_000.25])(
        'preserves the API decimal %s through display and entry',
        (amount) => {
          numberFormatLocale.value = locale;
          currencyDisplayPreference.value = 'symbol';
          const displayed = formatUIAmount(amount, { currency });
          const { decimal, group } = getAmountSeparators(locale);
          const parsed = parseAmountInput({ raw: displayed, decimalSeparator: decimal, groupSeparator: group });
          expect(parsed.numeric).toBe(amount);
          expect(JSON.parse(JSON.stringify({ amount: parsed.numeric }))).toEqual({ amount });
        },
      );
    });
  }
}
