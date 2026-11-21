import { expect, test } from '@playwright/test';

import {
  completeOnboarding,
  createAccount,
  createPortfolio,
  createVehicle,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
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
    // Reuse the successful API session used to seed this synthetic user. The original
    // smoke covers UI login; a duplicate login here hits the production auth throttle.
    await page.context().addCookies((await api.storageState()).cookies);

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
    // Required categories can be replaced. Splitting remains a separate icon action.
    await expect(category.getByRole('button', { name: /Hapus pilihan|Clear selection/i })).toHaveCount(0);
    const split = category.locator('[data-test="split-toggle"]');
    await expect(split).toBeVisible();
    await expect(split).toHaveAttribute('aria-pressed', 'false');
    expect(await split.evaluate((element) => element.parentElement?.closest('button') === null)).toBe(true);
    await expect(transaction).toBeVisible();
    await page.keyboard.press('Escape');

    await page.goto('/accounts/vehicles/' + vehicleId);
    // The valuation caveat now lives in an accessible contextual-help dialog.
    // Verify that the explanation remains available rather than requiring
    // it to occupy the vehicle page's permanent layout.
    const valuationHelp = page.getByRole('button', {
      name: /Estimasi nilai saat ini|Estimated current value/i,
    });
    const disclaimer = page
      .getByRole('dialog')
      .filter({ hasText: /Ini bukan harga jual pasar terkini|This is not a live resale price/i });
    await valuationHelp.click();
    await expect(disclaimer).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('vehicle-disclaimer-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: /Buka menu navigasi|Open navigation menu/i })).toBeVisible();
    await valuationHelp.click();
    await expect(disclaimer).toBeVisible();
    await expect(disclaimer).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
    await page.screenshot({ path: test.info().outputPath('vehicle-disclaimer-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.reload();
    await page
      .getByRole('button', { name: /Edit|Ubah|Sunting/i })
      .first()
      .click();
    const edit = page.getByRole('dialog').first();
    const year = edit.locator('input[inputmode="numeric"][maxlength="4"]');
    await expect(year).toHaveValue('2020');
    await year.fill('2021');
    await expect(year).toHaveValue('2021');
    await edit.getByRole('button', { name: /^(Kategori kendaraan|Vehicle (class|category))$/i }).click();
    const classes = page.getByRole('dialog').last();
    const cars = classes.getByRole('button', { name: /^(Mobil|Cars)$/i });
    await expect(cars).toHaveAttribute('aria-expanded', 'false');
    await classes.getByRole('button', { name: /^(Buka semua|Expand all)$/i }).click();
    await expect(cars).toHaveAttribute('aria-expanded', 'true');
    await classes.getByRole('button', { name: /^(Tutup semua|Collapse all)$/i }).click();
    await expect(cars).toHaveAttribute('aria-expanded', 'false');
    await cars.click();
    await expect(cars).toHaveAttribute('aria-expanded', 'true');
    await expect(classes.getByRole('button', { name: /^SUV$/i })).toBeVisible();
    await classes.getByRole('button', { name: /SUV/i }).click();
    // Wait for the nested picker to unmount before using the parent close action.
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
    await edit.getByRole('button', { name: /^(Batal|Cancel)$/i }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('2020 Toyota Corolla', { exact: true })).toBeVisible();
    await valuationHelp.click();
    await expect(disclaimer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(disclaimer).toBeHidden();

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
    expect(extractId(await response.json())).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(/20\.000,5(?:0)?/).first()).toBeVisible();
  } finally {
    await api.dispose();
  }
});
