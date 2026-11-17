import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

import type { CurrencyWithExchangeRate } from '../types';
import ExchangeRateForm from './exchange-rate-form.vue';

vi.mock('@/api/currencies', () => ({
  deleteCustomRate: vi.fn(),
  editUserCurrenciesExchangeRates: vi.fn(),
}));

vi.mock('@/components/notification-center', () => ({
  useNotificationCenter: () => ({
    addSuccessNotification: vi.fn(),
    addWarningNotification: vi.fn(),
    addErrorNotification: vi.fn(),
  }),
}));

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } });

const mountForm = (overrides: Partial<CurrencyWithExchangeRate> = {}) => {
  const wrapper = mount(ExchangeRateForm, {
    props: {
      currency: {
        currency: { code: 'USD' },
        quoteCode: 'EUR',
        rate: 0.9,
        quoteRate: 1.111111,
        custom: true,
        ...overrides,
      } as unknown as CurrencyWithExchangeRate,
      isFormDisabled: false,
    },
    global: { plugins: [i18n] },
  });
  const [baseInput, quoteInput] = wrapper.findAll('input[type="number"]');
  return { wrapper, baseInput: baseInput!, quoteInput: quoteInput! };
};

describe('ExchangeRateForm', () => {
  it('derives the inverse rate and enables Save for a valid rate', async () => {
    const { wrapper, baseInput, quoteInput } = mountForm();

    await baseInput.trigger('focus');
    await baseInput.setValue('0.5');

    expect((quoteInput.element as HTMLInputElement).value).toBe('2');
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined();
  });

  it('keeps a reciprocal IDR->USD rate precise when users edit the inverse 16,000 USD->IDR value', async () => {
    // Synthetic rate, not an external/live currency quote.
    const { baseInput, quoteInput } = mountForm({
      currency: { code: 'IDR' } as CurrencyWithExchangeRate['currency'],
      quoteCode: 'USD',
      rate: 1 / 15_000,
      quoteRate: 15_000,
    });

    await quoteInput.trigger('focus');
    await quoteInput.setValue('16000');
    expect(Number((baseInput.element as HTMLInputElement).value)).toBeCloseTo(1 / 16_000, 12);
    expect((baseInput.element as HTMLInputElement).value).toBe('0.0000625');
  });

  it('does not turn tiny but valid inverse rates into zero', async () => {
    const { baseInput, quoteInput } = mountForm({
      currency: { code: 'IDR' } as CurrencyWithExchangeRate['currency'],
      quoteCode: 'USD',
      rate: 1 / 2_000_000,
      quoteRate: 2_000_000,
    });

    await quoteInput.trigger('focus');
    await quoteInput.setValue('2500000');
    expect(Number((baseInput.element as HTMLInputElement).value)).toBeCloseTo(1 / 2_500_000, 15);
    expect(Number((baseInput.element as HTMLInputElement).value)).toBeGreaterThan(0);
  });

  it('disables Save when a rate is empty', async () => {
    const { wrapper, baseInput } = mountForm();

    await baseInput.trigger('focus');
    await baseInput.setValue('');

    expect(wrapper.find('button').attributes('disabled')).toBeDefined();
  });
});
