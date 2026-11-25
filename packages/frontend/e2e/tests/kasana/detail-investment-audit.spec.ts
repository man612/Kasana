import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  addUserCurrencies,
  apiPatch,
  apiPost,
  completeOnboarding,
  createAccount,
  createHolding,
  createAuthenticatedApiContext,
  createPortfolio,
  createTransaction,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

test.describe('Lajur detail pages and investments', () => {
  test.use({ viewport: { width: 320, height: 680 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Jakarta' });

  let api: APIRequestContext;
  let accountId: string;
  let portfolioName: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createAuthenticatedApiContext({
      playwright,
      ...buildTestCredentials({ prefix: 'lajur-detail-investasi' }),
    });
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    await apiPatch({ request: api, path: '/api/v1/user/settings', data: { locale: 'id' } });
    accountId = extractId(
      await createAccount({
        request: api,
        name: 'Rekening panjang untuk audit navigasi detail',
        initialBalance: 250_000,
        currencyCode: 'IDR',
      }),
    );
    await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        createTransaction({
          request: api,
          accountId,
          amount: 1_000,
          note: `Catatan sintetis ${index}`,
        }),
      ),
    );
    portfolioName = 'Portofolio sintetis';
    const { response: portfolio } = await createPortfolio({ request: api, name: portfolioName });
    await apiPost({
      request: api,
      path: `/api/v1/investments/portfolios/${portfolio.id}/cash-transaction`,
      data: { type: 'withdrawal', amount: '5000', currencyCode: 'IDR', date: '2026-11-25' },
    });
    await addUserCurrencies({ request: api, currencyCode: 'USD' });
    const { response: assetPortfolio } = await createPortfolio({ request: api, name: 'Portofolio aset sintetis' });
    await createHolding({
      request: api,
      portfolioId: assetPortfolio.id,
      symbol: 'ETEST',
      currencyCode: 'USD',
    });
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies((await api.storageState()).cookies);
    await context.addInitScript(() => localStorage.setItem('preferred-locale', 'id'));
  });

  test.afterAll(async () => api?.dispose());

  test('keeps the account tabs pinned and restores mobile navigation on upward scroll', async ({ page }) => {
    await page.goto('/accounts');
    await page.getByText('Rekening panjang untuk audit navigasi detail', { exact: true }).click();
    const transactions = page.getByRole('tab', { name: 'Transaksi', exact: true });
    await transactions.click();
    const tabTop = (await transactions.boundingBox())!.y;
    const viewport = page.locator('.lajur-detail-scroll-viewport');
    const navigation = page.locator('nav[aria-label="Navigasi utama"]').locator('../../..');
    const navigationHeight = () => navigation.evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(navigationHeight).toBeGreaterThan(30);
    await expect
      .poll(() => viewport.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(30);
    await viewport.evaluate((element) => {
      element.scrollTop = 100;
    });
    await expect.poll(navigationHeight).toBe(0);
    expect(Math.abs((await transactions.boundingBox())!.y - tabTop)).toBeLessThan(2);
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect.poll(navigationHeight).toBeGreaterThan(30);
  });

  test('keeps portfolio mobile actions reachable, preserves Rupiah cash, and opens a narrow asset list', async ({
    page,
  }) => {
    await page.goto('/investments');
    await page.getByRole('link', { name: new RegExp(portfolioName) }).click();
    const navigation = page.locator('nav[aria-label="Navigasi utama"]').locator('../../..');
    await expect.poll(() => navigation.evaluate((element) => element.getBoundingClientRect().height)).toBe(0);
    await expect(page.getByText('Kas negatif', { exact: true })).toBeVisible();
    const cash = page.getByText('Saldo Kas', { exact: true }).locator('../..');
    await cash.getByRole('button', { name: /aksi|tindakan/i }).click();
    await page.getByRole('menuitem', { name: /transaksi kas/i }).click();
    const dialog = page.getByRole('dialog', { name: 'Transaksi Tunai' });
    await expect(dialog.getByText('Rp', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Mata Uang', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.goto('/investments');
    await page.getByRole('link', { name: /Portofolio aset sintetis/ }).click();
    await page.getByRole('tab', { name: /aset|kepemilikan/i }).click();
    const security = page.getByRole('button', { name: 'ETEST', exact: true });
    await security.click();
    await expect(security).toHaveAttribute('aria-expanded', 'true');
    const holdingTable = page.locator('table').filter({ has: security });
    expect(await holdingTable.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(320);
    await page.getByRole('link', { name: /impor/i }).click();
    await expect(page).toHaveURL(/import-transactions$/);
  });
});
