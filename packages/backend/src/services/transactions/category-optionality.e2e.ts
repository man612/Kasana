import { type RecordId, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { describe, expect, it } from '@jest/globals';
import type { TransactionApiResponse } from '@root/serializers/transactions.serializer';
import * as helpers from '@tests/helpers';

const createTransaction = ({ payload }: { payload: ReturnType<typeof helpers.buildTransactionPayload> }) =>
  helpers.makeRequest<[TransactionApiResponse, TransactionApiResponse?]>({
    method: 'post',
    url: '/transactions',
    payload,
  });

// The source payload distinguishes absent keys from undefined; HTTP JSON omits both.
describe('POST /transactions category optionality', () => {
  it.each(['absent', 'undefined', 'valid'] as const)('creates a loan payment with category %s', async (category) => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({ initialBalance: 1000 }),
      raw: true,
    });
    const loan = await helpers.createLoan({
      payload: helpers.buildCreateLoanPayload({
        currencyCode: global.BASE_CURRENCY.code,
        initialBalance: 1000,
        originalPrincipal: 1000,
      }),
      raw: true,
    });
    const payload = helpers.buildTransactionPayload({
      accountId: account.id,
      amount: 300,
      transferNature: TRANSACTION_TRANSFER_NATURE.transfer_to_loan,
      destinationAccountId: loan.id as RecordId,
      destinationAmount: 300,
    });
    if (category === 'absent') delete payload.categoryId;
    if (category === 'undefined') payload.categoryId = undefined;
    expect(Object.hasOwn(payload, 'categoryId')).toBe(category !== 'absent');
    const categoryId = payload.categoryId ?? null;

    const response = await createTransaction({ payload });
    expect({ status: response.statusCode, body: response.body }).toMatchObject({
      status: 200,
      body: {
        status: 'success',
        response: [
          expect.objectContaining({ id: expect.any(String) }),
          expect.objectContaining({ id: expect.any(String) }),
        ],
      },
    });
    const [cashLeg, loanLeg] = helpers.extractResponse(response);
    expect(cashLeg).toMatchObject({
      accountId: account.id,
      amount: 300,
      transactionType: TRANSACTION_TYPES.expense,
      transferNature: TRANSACTION_TRANSFER_NATURE.transfer_to_loan,
      transferId: expect.any(String),
      categoryId,
    });
    expect(loanLeg).toMatchObject({
      accountId: loan.id,
      amount: 300,
      transactionType: TRANSACTION_TYPES.income,
      transferNature: TRANSACTION_TRANSFER_NATURE.transfer_to_loan,
      transferId: cashLeg.transferId,
      categoryId,
    });
    expect(loanLeg!.id).not.toBe(cashLeg.id);
    const stored = await helpers.getTransactions({ raw: true });
    expect(stored).toHaveLength(2);
    expect(stored).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: cashLeg.id, categoryId }),
        expect.objectContaining({ id: loanLeg!.id, categoryId }),
      ]),
    );
    expect((await helpers.getAccount({ id: account.id, raw: true })).currentBalance).toBe(700);
    expect((await helpers.getLoanById({ id: loan.id, raw: true })).currentBalance).toBe(-700);
  });

  it('rejects a malformed category on a loan payment without creating either leg', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({ initialBalance: 1000 }),
      raw: true,
    });
    const loan = await helpers.createLoan({
      payload: helpers.buildCreateLoanPayload({
        currencyCode: global.BASE_CURRENCY.code,
        initialBalance: 1000,
        originalPrincipal: 1000,
      }),
      raw: true,
    });
    const response = await createTransaction({
      payload: helpers.buildTransactionPayload({
        accountId: account.id,
        amount: 300,
        categoryId: 'not-a-uuid' as RecordId,
        transferNature: TRANSACTION_TRANSFER_NATURE.transfer_to_loan,
        destinationAccountId: loan.id as RecordId,
        destinationAmount: 300,
      }),
    });
    expect(response.statusCode).toBe(422);
    expect(response.body.status).toBe('error');
    expect(await helpers.getTransactions({ raw: true })).toHaveLength(0);
    expect((await helpers.getAccount({ id: account.id, raw: true })).currentBalance).toBe(1000);
    expect((await helpers.getLoanById({ id: loan.id, raw: true })).currentBalance).toBe(-1000);
  });

  it('creates an ordinary expense with a valid category', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({ initialBalance: 1000 }),
      raw: true,
    });
    const payload = helpers.buildTransactionPayload({ accountId: account.id, amount: 100 });
    const response = await createTransaction({ payload });
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.response).toHaveLength(1);
    const [expense] = helpers.extractResponse(response);
    expect(expense).toMatchObject({ id: expect.any(String), categoryId: payload.categoryId, amount: 100 });
    expect((await helpers.getAccount({ id: account.id, raw: true })).currentBalance).toBe(900);
  });

  it.each(['absent', 'invalid'] as const)(
    'rejects an ordinary expense with category %s without changing balances',
    async (category) => {
      const account = await helpers.createAccount({
        payload: helpers.buildAccountPayload({ initialBalance: 1000 }),
        raw: true,
      });
      const payload = helpers.buildTransactionPayload({ accountId: account.id, amount: 100 });
      if (category === 'absent') delete payload.categoryId;
      else payload.categoryId = 'not-a-uuid' as RecordId;
      const response = await createTransaction({ payload });
      expect(response.statusCode).toBe(422);
      expect(response.body.status).toBe('error');
      expect(response.body.response).toMatchObject({
        validationErrors: expect.arrayContaining([
          expect.objectContaining({ path: expect.arrayContaining(['categoryId']) }),
        ]),
      });
      expect(await helpers.getTransactions({ raw: true })).toHaveLength(0);
      expect((await helpers.getAccount({ id: account.id, raw: true })).currentBalance).toBe(1000);
    },
  );
});
