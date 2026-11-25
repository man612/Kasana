import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  apiGet,
  apiPatch,
  completeOnboarding,
  createAccount,
  createAuthenticatedApiContext,
  createVehicle,
  createTransaction,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

test.describe('Lajur planned pages and optimization', () => {
  test.use({ viewport: { width: 320, height: 680 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Jakarta' });
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    api = await createAuthenticatedApiContext({
      playwright,
      ...buildTestCredentials({ prefix: 'lajur-planned-audit' }),
    });
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    const accountId = extractId(
      await createAccount({
        request: api,
        name: 'Rekening uji',
        currencyCode: 'IDR',
        initialBalance: 1_250_000,
      }),
    );
    const user = await apiGet({ request: api, path: '/api/v1/user' });
    const categoryId = (user.response ?? user).defaultCategoryId;
    expect(categoryId).toBeTruthy();
    await createTransaction({
      request: api,
      accountId,
      categoryId,
      amount: 20_000,
      note: 'Catatan uji belum dikategorikan',
    });
    await createVehicle({ request: api, name: 'Mobil uji inventaris', currencyCode: 'IDR', purchasePrice: 90_000_000 });
    await apiPatch({ request: api, path: '/api/v1/user/settings', data: { locale: 'id' } });
  });

  test.beforeEach(async ({ page, context }) => {
    await context.addCookies((await api.storageState()).cookies);
    await page.addInitScript(() => localStorage.setItem('preferred-locale', 'id'));
  });

  test.afterAll(async () => api?.dispose());

  test('uses one account navigation source for inventory, vehicle details and loans', async ({ page }) => {
    await page.goto('/accounts');
    const title = page.locator('[data-testid="route-page"]:not([inert])').getByTestId('section-navigation-title');
    await title.click();
    await page.getByRole('menuitem', { name: 'Inventaris', exact: true }).click();
    await expect(page).toHaveURL(/\/accounts\/inventory$/);
    await expect(title).toHaveText('Inventaris');
    await expect(page.getByText('Mobil uji inventaris', { exact: true })).toBeVisible();
    await title.click();
    await expect(page.getByRole('menuitem', { name: 'Inventaris', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByRole('menuitem', { name: 'Pinjaman', exact: true }).click();
    await expect(page).toHaveURL(/\/loans$/);
    await page.goBack();
    await expect(title).toHaveText('Inventaris');
    await page.reload();
    await expect(title).toHaveText('Inventaris');
  });

  test('localizes planned entry points and uses a single create action with Rupiah forms', async ({ page }) => {
    await page.goto('/budget');
    await expect(page.getByRole('heading', { name: 'Atur uangmu sebelum digunakan' })).toBeVisible();
    const title = page.locator('[data-testid="route-page"]:not([inert])').getByTestId('section-navigation-title');
    await title.click();
    await page.getByRole('menuitem', { name: 'Tujuan Keuangan' }).click();
    const newGoal = page.getByRole('button', { name: 'Buat tujuan', exact: true });
    await expect(newGoal).toHaveCount(1);
    await newGoal.click();
    const goal = page.getByRole('dialog', { name: 'Buat tujuan' });
    await expect(goal.getByText('Rp', { exact: true })).toBeVisible();
    await expect(goal.getByRole('button', { name: 'Buat tujuan', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(goal).toBeHidden();

    await title.click();
    await page.getByRole('menuitem', { name: 'Pelacak Pengeluaran' }).click();
    await expect(page.getByText('Belum ada pelacak', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buat pelacak', exact: true })).toHaveCount(1);

    await title.click();
    await page.getByRole('menuitem', { name: 'Biaya Berulang' }).click();
    await page.getByRole('button', { name: 'Tambah Biaya Berulang', exact: true }).click();
    const recurring = page.getByRole('dialog');
    await expect(recurring.getByText('Rp', { exact: true })).toBeVisible();
    await expect(recurring.getByRole('button', { name: 'Cicilan', exact: true })).toBeVisible();
    const width = await recurring.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(width).toBeLessThanOrEqual(1);
  });

  test('explains an unavailable AI action without blocking transfer matching', async ({ page }) => {
    let triggerRequests = 0;
    await page.route('**/api/v1/user/ai/categorization/trigger', async (route) => {
      triggerRequests++;
      await route.abort();
    });

    await page.goto('/transactions/optimizations');
    const matching = page.getByRole('link', { name: /Cari transfer yang belum terhubung/i });
    await expect(matching).toBeEnabled();
    const categorization = page.getByRole('link', { name: /Rapikan kategori dengan AI/i });
    await expect(categorization).toBeVisible();
    await categorization.click();
    await expect(page).toHaveURL(/\/optimizations\/ai-categorization$/);
    const run = page.getByRole('button', { name: /Kategorikan dengan AI/i });
    await expect(run).toHaveAttribute('aria-disabled', 'true');
    await run.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('link', { name: 'Buka pengaturan AI' })).toBeVisible();
    expect(triggerRequests).toBe(0);
  });

  test('closes the empty history sheet before creating a rule and restores its context', async ({ page }) => {
    await page.goto('/transactions/optimizations');
    const trigger = page.getByRole('button', { name: /Jalankan aturan pada transaksi lama/i });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Jalankan aturan' });
    await expect(sheet.getByText(/Belum ada otomatisasi/)).toBeVisible();
    const create = sheet.getByRole('button', { name: 'Buat otomatisasi', exact: true });
    const cancel = sheet.getByRole('button', { name: 'Batal', exact: true });
    const cancelBox = (await cancel.boundingBox())!;
    const createBox = (await create.boundingBox())!;
    expect(Math.abs(cancelBox.x + cancelBox.width / 2 - createBox.x - createBox.width / 2)).toBeLessThan(2);
    await cancel.click();
    await expect(sheet).toBeHidden();
    await trigger.click();
    await create.click();
    await expect(page.getByRole('heading', { name: 'Buat otomatisasi' })).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await page.getByRole('link', { name: 'Kembali ke Optimasi' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Buat otomatisasi', exact: true })).toBeVisible();
  });
});
