import { expect, test } from '@playwright/test';

import {
  completeOnboarding,
  createAccount,
  createTransaction,
  createTransactionGroup,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

test.use({ viewport: { width: 360, height: 730 }, hasTouch: true });

test('keeps group expansion inside the list and persists its selection display preference', async ({
  page,
  playwright,
}) => {
  const creds = buildTestCredentials({ prefix: 'lajur-tx-display' });
  await signUpAndVerify({ creds });
  const api = await signInViaApi({ playwright, email: creds.email, password: creds.password });
  try {
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    const accountId = extractId(
      await createAccount({ request: api, name: 'Dompet Tampilan', currencyCode: 'IDR', initialBalance: 100_000 }),
    );
    const now = Date.now();
    const transactions = [];
    for (let index = 0; index < 12; index += 1) {
      const result = await createTransaction({
        request: api,
        accountId,
        amount: 1000,
        note: `Tampilan audit ${index}`,
        time: new Date(now - 2 * 86_400_000 - index * 1000).toISOString(),
      });
      transactions.push(extractId(result));
    }
    await createTransactionGroup({
      request: api,
      name: 'Grup Tampilan',
      transactionIds: transactions.slice(-4),
    });
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto('/transactions', { waitUntil: 'domcontentloaded' });
    const views = page.getByRole('button', { name: /^(Tampilan|Views)$/i }).first();
    const groupButton = page.getByRole('button', { name: /(Expand|Collapse|Perluas|Buka|Tutup).*Grup Tampilan/i });
    const viewport = page.locator('[data-reka-scroll-area-viewport]').filter({ has: groupButton }).last();
    await groupButton.scrollIntoViewIfNeeded();
    await expect(groupButton).toHaveAttribute('aria-expanded', 'false');
    const offset = await viewport.evaluate((element) => element.scrollTop);
    const viewsTop = (await views.boundingBox())!.y;
    await groupButton.click();
    await expect(groupButton).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(offset);
    expect((await views.boundingBox())!.y).toBeCloseTo(viewsTop, 0);

    const rowCheckbox = page.locator('[data-transaction-row]').getByRole('checkbox').first();
    await rowCheckbox.check();
    await views.click();
    const perDay = page.getByRole('button', { name: /^(Per hari|By day)$/i });
    await expect(perDay).toHaveAttribute('aria-pressed', 'true');
    const toggle = page.getByRole('switch', { name: /^(Tampilkan checkbox|Show checkboxes)$/i });
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-transaction-row]').getByRole('checkbox')).toHaveCount(0);

    await views.click();
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(rowCheckbox).not.toBeChecked();

    await views.click();
    await toggle.click();
    await page.keyboard.press('Escape');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await views.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^(Lainnya|More)$/i }).click();
    await page.getByRole('menuitemradio', { name: /Tampilan tabel|Table view/i }).click();
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('checkbox')).toHaveCount(0);
    await views.click();
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(table.getByRole('checkbox').first()).not.toBeChecked();
  } finally {
    await api.dispose();
  }
});
