import { ACCOUNT_CATEGORIES, PAYMENT_TYPES } from '@bt/shared/types';
import { describe, expect, it } from '@jest/globals';

import { createAccountBodySchema, updateAccountBodySchema } from './account-body.schema';

describe('digital-wallet account category', () => {
  it('accepts a digital wallet as a normal manual asset account', () => {
    const result = createAccountBodySchema.safeParse({
      name: 'Dompet digital uji',
      currencyCode: 'IDR',
      initialBalance: 125000,
      accountCategory: ACCOUNT_CATEGORIES.digitalWallet,
      defaultPaymentType: PAYMENT_TYPES.qris,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.accountCategory).toBe('digital-wallet');
    expect(result.data.initialBalance).toBe(125000);
  });

  it('allows switching an existing account to the digital-wallet category', () => {
    const result = updateAccountBodySchema.safeParse({
      accountCategory: ACCOUNT_CATEGORIES.digitalWallet,
    });
    expect(result.success).toBe(true);
  });

  it('still rejects account categories not in the shared list', () => {
    expect(
      createAccountBodySchema.safeParse({
        name: 'invalid',
        currencyCode: 'IDR',
        accountCategory: 'arbitrary-category',
      }).success,
    ).toBe(false);
  });
});
