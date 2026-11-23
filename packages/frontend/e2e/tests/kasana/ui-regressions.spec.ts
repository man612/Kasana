import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  apiPatch,
  completeOnboarding,
  createAccount,
  createAuthenticatedApiContext,
  createTransaction,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

test.describe('Lajur. mobile dashboard and interaction regressions', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jakarta' });
  let api: APIRequestContext;
  let accountId: string;

  test.beforeAll(async ({ playwright }) => {
    api = await createAuthenticatedApiContext({
      playwright,
      ...buildTestCredentials({ prefix: 'lajur-regressions' }),
    });
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    const account = await createAccount({
      request: api,
      name: 'Dompet regresi Lajur.',
      currencyCode: 'IDR',
      initialBalance: 1_000_000,
    });
    accountId = extractId(account);
    await createTransaction({ request: api, accountId, amount: 12000, note: 'Catatan fixture regresi' });
    await apiPatch({
      request: api,
      path: '/api/v1/user/settings',
      data: {
        locale: 'id',
        dashboard: {
          widgets: [
            { widgetId: 'balance-trend', colSpan: 1 },
            { widgetId: 'latest-records', colSpan: 1, config: { compact: true } },
            { widgetId: 'trackers', colSpan: 1 },
          ],
        },
        ui: { transactionsTable: { mobileView: 'list' }, transactionsList: { timeGrouping: 'day' } },
      },
    });
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies((await api.storageState()).cookies);
    await context.addInitScript(() => localStorage.setItem('preferred-locale', 'id'));
  });

  test.afterAll(async () => api?.dispose());

  test('keeps the balance and latest-record summaries compact and opens their details in place', async ({ page }) => {
    await page.goto('/dashboard');
    const trend = page.locator('[data-widget-id="balance-trend"]');
    await expect(trend.getByTestId('balance-trend-components').getByRole('button', { name: 'Total' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(trend.getByRole('combobox')).toHaveCount(0);
    await expect(trend.getByTestId('balance-trend-sparkline').locator('svg')).toBeVisible();
    const detailsTrigger = trend.getByTestId('balance-trend-details');
    const previousHeight = (await trend.boundingBox())!.height;
    await detailsTrigger.click();
    const details = page.getByRole('dialog').filter({ has: page.getByTestId('balance-trend-summary') });
    await expect(details.getByRole('table')).toBeVisible();
    await expect(details.locator('svg[role="group"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();
    expect(Math.abs((await trend.boundingBox())!.height - previousHeight)).toBeLessThanOrEqual(1);

    const latest = page.locator('[data-widget-id="latest-records"]');
    const summary = latest.getByTestId('latest-transactions-compact-summary');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('link')).toHaveCount(0);
    await expect(summary.locator('[data-transaction-row]')).toHaveCount(0);
    await latest.getByTestId('latest-transactions-compact-toggle').click();
    await expect(latest.locator('[data-transaction-row]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    const trackers = page.locator('[data-widget-id="trackers"]');
    await expect(trackers.getByRole('heading', { name: 'Pelacak', exact: true })).toBeVisible();
    await expect(trackers.getByText('Belum ada pelacak aktif', { exact: true })).toBeVisible();
  });

  test('navigates months in a separate layer and keeps date and time edits in the draft', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-23T05:11:22.000Z'));
    await page.goto('/dashboard');
    await page.locator('.shadow-header').getByRole('button', { name: 'Tambah', exact: true }).first().click();
    const form = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
    const dateTrigger = form.getByTestId('date-field-calendar-trigger').first();
    const oldLabel = await dateTrigger.textContent();
    await dateTrigger.click();
    const picker = page.getByTestId('transaction-date-dialog');
    const monthTrigger = picker.getByTestId('calendar-month-trigger');
    await expect(monthTrigger).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Tutup', exact: true })).toHaveCount(0);
    await monthTrigger.click();
    const monthPicker = page.getByTestId('calendar-month-picker');
    await expect(monthPicker.getByRole('spinbutton', { name: 'Tahun' })).toBeVisible();
    await monthPicker.getByRole('button', { name: 'Februari', exact: true }).click();
    await expect(monthPicker).toBeHidden();
    await expect(monthTrigger).toContainText('Februari');
    await monthTrigger.click();
    await page.keyboard.press('Escape');
    await expect(monthPicker).toBeHidden();
    await expect(picker).toBeVisible();
    await picker.getByTestId('date-dialog-time-input').fill('17:45');
    await picker.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dateTrigger).toHaveText(oldLabel ?? '');
    await dateTrigger.click();
    await picker.getByTestId('date-dialog-time-input').fill('17:45');
    await picker.getByRole('button', { name: 'Simpan', exact: true }).click();
    await expect(dateTrigger).toContainText('17:45:00');
    await expect(form).toBeVisible();
  });

  test('closes grouping choices, preserves date context and displays the local time zone', async ({ page }) => {
    await page.goto('/transactions');
    const views = page.getByRole('button', { name: 'Tampilan', exact: true }).first();
    const rowTime = page.locator('[data-transaction-row] time').first();
    await expect(rowTime).toHaveText(/^\d{2}:\d{2} WIB$/);
    await views.click();
    const timeToggle = page.getByRole('button', { name: 'Tampilkan jam' });
    await expect(timeToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(timeToggle).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('.lajur-scrim-menu:visible')).toHaveCount(1);
    await page.getByRole('button', { name: 'Per minggu', exact: true }).click();
    await expect(timeToggle).toBeHidden();
    await expect(views).toBeFocused();
    await expect(rowTime).toHaveText(/\d+ \p{L}+ 20\d{2}/u);
    await views.click();
    await timeToggle.click();
    await expect(rowTime).toContainText('WIB');
    await page.getByRole('button', { name: 'Tanpa pengelompokan', exact: true }).click();
    await expect(timeToggle).toBeHidden();
    await expect(rowTime).toContainText('WIB');
  });

  test('keeps the account route mounted on browser back and uses the focused automation shell', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/accounts');
    const account = page.locator(`a[href="/account/${accountId}"]`).first();
    for (let i = 0; i < 3; i++) {
      await account.click();
      await expect(page).toHaveURL(new RegExp(`/account/${accountId}$`));
      await expect(page.getByTestId('route-page')).toBeVisible();
      await page.goBack();
      await expect(account).toBeVisible();
    }
    await page.goto('/transactions/automations/new');
    await expect(page.locator('.shadow-header')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simpan', exact: true })).toBeVisible();
    await page.getByRole('link', { name: /Kembali/i }).click();
    await expect(page.locator('.shadow-header')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('closes focus mode settings with Escape and keeps focus mode active', async ({ page }) => {
    await page.goto('/transactions');
    await page.getByRole('button', { name: 'Lainnya', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Mode fokus', exact: true }).click();
    const exit = page.getByRole('button', { name: 'Keluar mode fokus', exact: true });
    await expect(exit).toBeVisible();
    const settings = page.getByRole('button', { name: 'Pengaturan tabel', exact: true }).last();
    await settings.click();
    const columns = page.getByRole('button', { name: /^Kolom/ }).last();
    await expect(page.locator('.lajur-scrim-menu:visible')).toHaveCount(1);
    await columns.click();
    await expect(page.getByRole('checkbox', { name: 'Tanggal', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(columns).toBeHidden();
    await expect(settings).toBeFocused();
    await expect(exit).toBeVisible();
    await exit.click();
    await expect(exit).toBeHidden();
  });

  test('updates the document language when the user changes locale', async ({ page }) => {
    await page.goto('/settings/language');
    const documentRoot = page.locator('html');
    await expect(documentRoot).toHaveAttribute('lang', 'id');
    await page.getByRole('button', { name: /^English/ }).click();
    await expect(documentRoot).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: /^Українська/ }).click();
    await expect(documentRoot).toHaveAttribute('lang', 'uk');
    await page.getByRole('button', { name: /^Bahasa/ }).click();
    await expect(documentRoot).toHaveAttribute('lang', 'id');
  });
});
