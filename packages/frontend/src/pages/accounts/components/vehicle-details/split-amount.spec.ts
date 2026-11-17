import { currencyDisplayPreference, formatUIAmount, numberFormatLocale } from '@/js/helpers/formatters';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { splitVehicleAmount } from './split-amount';
import VehicleAmount from './vehicle-amount.vue';

const initialLocale = numberFormatLocale.value;
const initialDisplay = currencyDisplayPreference.value;
afterEach(() => {
  numberFormatLocale.value = initialLocale;
  currencyDisplayPreference.value = initialDisplay;
});

describe('vehicle amount presentation boundaries', () => {
  it('keeps each IDR thousands group and decimal tail intact', () => {
    expect(splitVehicleAmount({ formatted: 'Rp\u00a020.000.000,5', locale: 'id-ID' })).toEqual({
      prefix: 'Rp\u00a0',
      groups: ['20', '.000', '.000,5'],
      suffix: '',
    });
  });
  it('keeps a sign-only prefix with its number', () => {
    expect(splitVehicleAmount({ formatted: '-20,000,000.50', locale: 'en-US' }).groups).toEqual([
      '-20',
      ',000',
      ',000.50',
    ]);
  });
  it('separates currency spacing from a locale that groups with the same space', () => {
    expect(splitVehicleAmount({ formatted: '20\u00a0000\u00a0000,50\u00a0$', locale: 'ru-RU' })).toEqual({
      prefix: '',
      groups: ['20', '\u00a0000', '\u00a0000,50'],
      suffix: '\u00a0$',
    });
  });
  it('preserves accounting parentheses and the final decimal group', () => {
    const parts = splitVehicleAmount({ formatted: '($20,000,000.50)', locale: 'en-US' });
    expect(parts.groups).toEqual(['20', ',000', ',000.50)']);
    expect(parts.prefix + parts.groups.join('') + parts.suffix).toBe('($20,000,000.50)');
  });
  it.each(['NaN', 'Infinity', '', 'Not available'])('preserves nonnumeric output %s', (formatted) => {
    expect(splitVehicleAmount({ formatted, locale: 'id-ID' })).toEqual({ prefix: formatted, groups: [], suffix: '' });
  });
  it('does not crash or reinterpret text when locale is invalid', () => {
    const formatted = 'Rp\u00a020.000.000,5';
    const parts = splitVehicleAmount({ formatted, locale: 'invalid_locale' });
    expect(parts.prefix + parts.groups.join('') + parts.suffix).toBe(formatted);
  });

  for (const locale of ['id-ID', 'en-US', 'fr-FR', 'hi-IN', 'ar-EG']) {
    for (const currency of ['IDR', 'USD']) {
      for (const display of ['symbol', 'narrowSymbol'] as const) {
        it.each([20_000_000.5, 9_876_543_210.25, -9_876_543.21, 0, 0.01, -0.01])(
          `${locale} ${currency} ${display} preserves %s and exposes the complete amount once`,
          (value) => {
            numberFormatLocale.value = locale;
            currencyDisplayPreference.value = display;
            const formatted = formatUIAmount(value, { currency });
            const parts = splitVehicleAmount({ formatted, locale });
            expect(parts.prefix + parts.groups.join('') + parts.suffix).toBe(formatted);
            const wrapper = mount(VehicleAmount, { props: { formatted, locale } });
            expect(wrapper.get('[data-amount-visual]').element.textContent).toBe(formatted);
            expect(wrapper.get('[data-amount-visual]').attributes('aria-hidden')).toBe('true');
            expect(wrapper.get('.sr-only').element.textContent).toBe(formatted);
            expect(wrapper.findAll('.sr-only')).toHaveLength(1);
            expect(wrapper.findAll('[data-amount-group]').map((part) => part.text())).toHaveLength(parts.groups.length);
            wrapper.unmount();
          },
        );
      }
    }
  }
});
