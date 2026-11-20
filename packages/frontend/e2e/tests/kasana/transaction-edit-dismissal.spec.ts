import { expect, test } from '@playwright/test';

import {
  completeOnboarding,
  createAccount,
  createTransaction,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

test.use({ viewport: { width: 360, height: 780 }, hasTouch: true });

test('saves an edited transaction without a discard prompt and retains a failed draft', async ({
  page,
  playwright,
}) => {
  const credentials = buildTestCredentials({ prefix: 'lajur-edit-dismissal' });
  await signUpAndVerify({ creds: credentials });
  const api = await signInViaApi({ playwright, email: credentials.email, password: credentials.password });
  const original = 'Original note for edit check';
  const updated = 'Saved note for edit check';
  try {
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    const accountId = extractId(
      await createAccount({
        request: api,
        name: 'Wallet for edit check',
        currencyCode: 'IDR',
        initialBalance: 100_000,
      }),
    );
    const transactionId = extractId(
      await createTransaction({ request: api, accountId, amount: 12_000, note: original }),
    );
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto('/transactions', { waitUntil: 'domcontentloaded' });
    await page.getByText(original, { exact: true }).tap({ noWaitAfter: true });

    const form = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
    const note = form.getByPlaceholder(/^(Catatan|Note)$/i);
    const submit = form.getByRole('button', { name: /^(Sunting transaksi|Edit transaction)$/i });
    const discard = page.getByRole('alertdialog').filter({ hasText: /Tutup tanpa menyimpan|Close without saving/i });
    const endpoint = (url: URL) => url.pathname.endsWith(`/transactions/${transactionId}`);

    await expect(note).toHaveValue(original);
    await expect(submit).toBeDisabled();
    await note.fill(updated);
    const gate = Promise.withResolvers<void>();
    await page.route(endpoint, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      await gate.promise;
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    const failedSave = page.waitForResponse(
      (response) => endpoint(new URL(response.url())) && response.status() === 503,
    );
    try {
      await submit.tap({ noWaitAfter: true });
      await expect(submit).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(discard).toBeHidden();
    } finally {
      gate.resolve();
    }
    await failedSave;
    await expect(submit).toBeEnabled();
    await expect(note).toHaveValue(updated);
    await expect(discard).toBeHidden();
    await page.unroute(endpoint);

    await page.keyboard.press('Escape');
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: /^(Batal|Cancel)$/i }).click();
    await expect(note).toHaveValue(updated);

    const saved = page.waitForResponse(
      (response) => endpoint(new URL(response.url())) && response.request().method() === 'PUT' && response.ok(),
    );
    await submit.tap({ noWaitAfter: true });
    await saved;
    await expect(form).toBeHidden();
    await expect(discard).toBeHidden();
    await expect(page.getByText(updated, { exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
