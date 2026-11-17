import { PAYMENT_TYPES, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { recordId } from '@common/lib/zod/custom-types';
import { describe, expect, it } from '@jest/globals';
import { z } from 'zod';

import { createTransactionBodySchema, updateTransactionBodySchema } from './schemas';

const accountId = recordId().parse('00000000-0000-4000-8000-000000000001');
const destinationAccountId = recordId().parse('00000000-0000-4000-8000-000000000002');
const categoryId = recordId().parse('00000000-0000-4000-8000-000000000003');
const loanPayment = {
  accountId,
  destinationAccountId,
  amount: 300,
  destinationAmount: 300,
  transactionType: TRANSACTION_TYPES.expense,
  transferNature: TRANSACTION_TRANSFER_NATURE.transfer_to_loan,
  paymentType: PAYMENT_TYPES.creditCard,
} satisfies z.input<typeof createTransactionBodySchema>;

const overJson = (payload: unknown): unknown => JSON.parse(JSON.stringify(payload));

describe('transaction request category optionality over JSON', () => {
  it.each([
    { name: 'absent', fields: {} },
    { name: 'explicitly undefined before JSON serialization', fields: { categoryId: undefined } },
    { name: 'a valid UUID', fields: { categoryId } },
  ])('accepts a loan payment with category $name', ({ fields }) => {
    const input = { ...loanPayment, ...fields };
    const parsed = createTransactionBodySchema.parse(overJson(input));
    expect(parsed.categoryId).toBe(fields.categoryId);
    expect(parsed.transferNature).toBe(TRANSACTION_TRANSFER_NATURE.transfer_to_loan);
    expect(parsed.amount).toBe(300);
    expect(parsed.isPlanned).toBe(false);
    expect(parsed.applyAutomations).toBe(false);
  });

  it('also accepts an explicitly undefined property in memory', () => {
    expect(createTransactionBodySchema.parse({ ...loanPayment, categoryId: undefined }).categoryId).toBeUndefined();
  });

  it('requires a category for an ordinary expense', () => {
    const expense = {
      accountId,
      amount: 300,
      transactionType: TRANSACTION_TYPES.expense,
      transferNature: TRANSACTION_TRANSFER_NATURE.not_transfer,
    };
    expect(createTransactionBodySchema.safeParse({ ...expense, categoryId }).success).toBe(true);
    for (const input of [expense, { ...expense, categoryId: undefined }]) {
      const result = createTransactionBodySchema.safeParse(overJson(input));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ message: "'categoryId' is required for non-transfer transactions." }),
          ]),
        );
      }
    }
  });

  it.each(['not-a-uuid', '', null, 123])('rejects an invalid loan-payment category %p', (value) => {
    expect(createTransactionBodySchema.safeParse({ ...loanPayment, categoryId: value }).success).toBe(false);
  });

  it('preserves the loan destination, commission and split refinements', () => {
    for (const patch of [
      { destinationAccountId: undefined },
      { destinationAmount: undefined },
      { destinationTransactionId: accountId },
      { commissionRate: 301 },
      { splits: [{ categoryId, amount: 300 }] },
    ]) {
      expect(createTransactionBodySchema.safeParse(overJson({ ...loanPayment, ...patch })).success).toBe(false);
    }
  });

  it('preserves optional update fields and does not inject create defaults into PATCH', () => {
    expect(updateTransactionBodySchema.parse({})).toEqual({});
    expect(updateTransactionBodySchema.parse({ categoryId })).toEqual({ categoryId });
    expect(updateTransactionBodySchema.safeParse({ categoryId: null }).success).toBe(false);
  });
});
