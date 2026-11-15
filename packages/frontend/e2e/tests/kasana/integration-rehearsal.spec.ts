import { expect, test } from '@playwright/test';

import {
  completeOnboarding,
  createAccount,
  createPortfolio,
  createVehicle,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
import { loginViaUI } from '../../helpers/auth';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

// Only synthetic test.local users; the CI harness owns its disposable stack.
test('combined category dialog, vehicle picker/disclaimer and fractional IDR cash entry', async ({
  page,
  playwright,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  const credentials = buildTestCredentials({ prefix: 'lajur-rc' });
  await signUpAndVerify({ creds: credentials });
  const api = await signInViaApi({ playwright, email: credentials.email, password: credentials.password });
  try {
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    await createAccount({ request: api, name: 'RC synthetic wallet', currencyCode: 'IDR', initialBalance: 1_000_000 });
    const vehicleId = extractId(
      await createVehicle({
        request: api,
        name: 'RC synthetic vehicle',
        currencyCode: 'IDR',
        purchasePrice: 20_000_000.5,
      }),
    );
    const portfolioId = extractId(await createPortfolio({ request: api, name: 'RC synthetic portfolio' }));
    await loginViaUI({ page, email: credentials.email, password: credentials.password });

    await page.goto('/dashboard');
    await page
      .getByRole('button', { name: /Transaksi Baru|New transaction/i })
      .first()
      .click();
    const transaction = page.getByRole('dialog').first();
    const category = transaction.locator('[data-test="category-select-field"]').first();
    await category.locator('button').first().click();
    const categories = page.getByRole('dialog').last();
    await expect(categories.getByRole('option').first()).toBeVisible();
    const scrollRegions = await categories.evaluate(
      (element) =>
        [...element.querySelectorAll('*')].filter((child) => {
          const style = getComputedStyle(child);
          return /auto|scroll/.test(style.overflowY) && child.scrollHeight > child.clientHeight + 2;
        }).length,
    );
    expect(scrollRegions, 'Category picker should have one scrolling region').toBeLessThanOrEqual(1);
    await categories.getByRole('option').first().click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    // The clear control is a sibling, never a nested button or another picker trigger.
    const clear = category.locator('button').nth(1);
    await expect(clear).toBeVisible();
    expect(await clear.evaluate((element) => element.parentElement?.closest('button') === null)).toBe(true);
    await clear.click();
    await expect(category.locator('button')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');

    await page.goto('/accounts/vehicles/' + vehicleId);
    const disclaimer = page
      .locator('p')
      .filter({ hasText: /harga pasar|market (price|valuation)|bukan.*penawaran|not.*appraisal/i })
      .first();
    await expect(disclaimer).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('vehicle-disclaimer-desktop.png'), fullPage: true });
    await page
      .getByRole('button', { name: /Edit|Ubah/i })
      .first()
      .click();
    const edit = page.getByRole('dialog').first();
    const year = edit.locator('input[inputmode="numeric"][maxlength="4"]');
    await expect(year).toHaveValue('2020');
    await year.fill('2021');
    await expect(year).toHaveValue('2021');
    await edit.getByRole('button', { name: /Kelas kendaraan|Vehicle class/i }).click();
    const classes = page.getByRole('dialog').last();
    await expect(classes.locator('button[aria-pressed]')).toHaveCount(7);
    await classes.getByRole('button', { name: /SUV/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(disclaimer).toBeVisible();

    await page.goto('/portfolios/' + portfolioId);
    await page.getByRole('button', { name: /Tambah transaksi|Add transaction/i }).click();
    const cash = page.getByRole('dialog').first();
    const amount = cash.locator('input[inputmode="decimal"]').first();
    await expect(amount).toBeDisabled();
    await cash.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /IDR/ }).first().click();
    await expect(amount).toBeEnabled();
    await amount.fill('20.000,50');
    await expect(amount).toHaveValue('20.000,50');
    await page.screenshot({ path: test.info().outputPath('fractional-idr-cash-entry.png'), fullPage: true });
    const submitted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/portfolios/') &&
        response.url().includes('/cash'),
    );
    await cash.locator('button[type="submit"]').click();
    const response = await submitted;
    expect(response.status(), await response.text()).toBe(200);
    expect(response.request().postDataJSON().amount).toBe('20000.5');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/20\.000,5(?:0)?/).first()).toBeVisible();
  } finally {
    await api.dispose();
  }
});
