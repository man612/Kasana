import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  apiPatch,
  apiPost,
  completeOnboarding,
  createAccount,
  createAuthenticatedApiContext,
  createLoan,
  createTransaction,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

test.describe('Lajur. mobile dashboard and interaction regressions', () => {
  test.use({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Jakarta' });
  let api: APIRequestContext;
  let accountId: string;
  let loanId: string;

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
    loanId = extractId(
      await createLoan({ request: api, name: 'Pinjaman regresi Lajur.', currencyCode: 'IDR', balance: 120_000 }),
    );
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
    await expect(latest.getByRole('link', { name: 'Ke halaman transaksi', exact: true })).toBeVisible();
    await expect(summary.locator('[data-transaction-row]')).toHaveCount(0);
    await latest.getByTestId('latest-transactions-compact-toggle').click();
    await expect(latest.locator('[data-transaction-row]').first()).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    const trackers = page.locator('[data-widget-id="trackers"]');
    await expect(trackers.getByRole('heading', { name: 'Pelacak Pengeluaran', exact: true })).toBeVisible();
    await expect(trackers.getByText('Belum ada pelacak aktif', { exact: true })).toBeVisible();
  });

  test('keeps the period bar stable and saves the latest-transactions clock separately', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 620 });
    await page.goto('/dashboard');
    const bar = page.getByTestId('dashboard-period-bar');
    await expect(bar).toBeVisible();
    const before = (await bar.boundingBox())!;
    const viewport = page.locator('[data-reka-scroll-area-viewport]').filter({ has: bar }).first();
    await viewport.evaluate((element) => {
      element.scrollTop = 180;
    });
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect.poll(async () => Math.abs((await bar.boundingBox())!.y - before.y)).toBeLessThanOrEqual(1);
    expect((await bar.boundingBox())!.height).toBeCloseTo(before.height, 0);
    await viewport.evaluate((element) => {
      element.scrollTop = 0;
    });

    const widget = page.locator('[data-widget-id="latest-records"]');
    await widget.getByTestId('latest-transactions-compact-toggle').click();
    await expect(widget.locator('[data-transaction-row]').first()).toBeVisible();
    await widget.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    const clock = page.getByTestId('lr-show-time-switch');
    const wasEnabled = (await clock.getAttribute('aria-checked')) === 'true';
    if (!wasEnabled) await clock.click();
    await expect(clock).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(widget.locator('time').first()).toContainText(/\d{2}:\d{2} WIB/);
    await page.reload();
    await widget.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    await expect(clock).toBeChecked();
  });

  test('routes title shortcuts and reopens only the active sidebar group', async ({ page }) => {
    await page.goto('/accounts');
    const title = page.getByTestId('section-navigation-title');
    await title.click();
    await page.getByRole('menuitem', { name: 'Pinjaman', exact: true }).click();
    await expect(page).toHaveURL(/\/loans$/);
    await expect(page.locator('nav a[href="/accounts"]:visible').last()).toHaveAttribute('aria-current', 'page');

    const sidebar = page.locator('[data-mobile-sidebar]');
    const openSidebar = page.getByRole('button', { name: 'Buka menu navigasi' });
    await openSidebar.click();
    const accounts = sidebar.getByRole('button', { name: 'Akun', exact: true });
    const transactions = sidebar.getByRole('button', { name: 'Transaksi', exact: true });
    await expect(accounts).toHaveAttribute('aria-expanded', 'true');
    await transactions.click();
    await expect(transactions).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(sidebar).toBeHidden();
    await openSidebar.click();
    await expect(accounts).toHaveAttribute('aria-expanded', 'true');
    await expect(transactions).toHaveAttribute('aria-expanded', 'false');
  });

  test('snaps both balance trend charts to real points and selects dates from the detail table', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 780 });
    let balanceRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/stats/combined-balance-history')) balanceRequests++;
    });

    await page.goto('/dashboard');
    const trend = page.locator('[data-widget-id="balance-trend"]');
    const tabs = trend.getByTestId('balance-trend-components');
    const loans = tabs.getByRole('button', { name: 'Pinjaman', exact: true });
    await loans.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(loans).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => {
        const track = (await tabs.boundingBox())!;
        const active = (await loans.boundingBox())!;
        return Math.max(track.x - active.x, active.x + active.width - track.x - track.width, 0);
      })
      .toBeLessThanOrEqual(1);
    const total = tabs.getByRole('button', { name: 'Total', exact: true });
    await total.click();
    await expect(total).toHaveAttribute('aria-pressed', 'true');

    const sparkline = trend.getByTestId('balance-trend-sparkline');
    await expect(sparkline).toHaveAttribute('aria-busy', 'false');
    const miniChart = sparkline.locator('svg');
    await expect(miniChart).toBeVisible();
    const tooltip = page.getByTestId('balance-trend-tooltip');
    // Hover in the unpainted upper-right area: the whole chart must be interactive.
    const bounds = (await miniChart.boundingBox())!;
    await miniChart.hover({ position: { x: bounds.width - 4, y: 2 } });
    await expect(tooltip).toBeVisible();
    const miniGuide = miniChart.locator('g').filter({ has: page.getByTestId('balance-trend-guide') });
    await expect(miniGuide).toBeVisible();

    await trend.getByTestId('balance-trend-details').click();
    const details = page.getByRole('dialog').filter({ has: page.getByTestId('balance-trend-summary') });
    const row = details.getByRole('table').locator('tbody tr').last();
    await row.getByRole('button').click();
    await expect(row.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    await expect(details.locator('g[visibility=visible] .hover-line')).toHaveCount(1);
    expect(await details.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const requestsAfterSelection = balanceRequests;

    const chartOverlay = details.locator('svg rect.overlay');
    await chartOverlay.scrollIntoViewIfNeeded();
    const plot = (await chartOverlay.boundingBox())!;
    await chartOverlay.hover({ position: { x: 2, y: plot.height / 2 } });
    const activeRow = details
      .getByRole('table')
      .locator('tbody tr')
      .filter({ has: page.locator('button[aria-pressed=true]') });
    await expect(activeRow).toHaveCount(1);
    await expect(tooltip).toContainText((await activeRow.locator('td').last().innerText()).trim());
    await expect(details.locator('g[visibility=visible] .hover-line')).toHaveCount(1);

    const touch = await page.context().newCDPSession(page);
    const touchY = Math.round(plot.y + plot.height / 2);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: Math.round(plot.x + 4), y: touchY }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(plot.x + plot.width - 4), y: touchY }],
    });
    await expect(tooltip).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(tooltip).toBeHidden();
    await expect(details).toBeVisible();
    expect(balanceRequests).toBe(requestsAfterSelection);
  });

  test('navigates months in a separate layer and keeps date and time edits in the draft', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-23T05:11:00.000Z') });
    await page.goto('/dashboard');
    await page.locator('.shadow-header').getByRole('button', { name: 'Tambah', exact: true }).first().click();
    const form = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
    const dateTrigger = form.getByTestId('date-field-calendar-trigger').first();
    const initialMinute = (await dateTrigger.innerText()).replace(/:\d{2} WIB$/, '');
    await dateTrigger.click();
    const picker = page.getByTestId('transaction-date-dialog');
    const monthTrigger = picker.getByTestId('calendar-month-trigger');
    await expect(monthTrigger).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Tutup', exact: true })).toHaveCount(0);
    await monthTrigger.click();
    const monthPicker = page.getByTestId('calendar-month-picker');
    const saveMonth = monthPicker.getByRole('button', { name: 'Simpan', exact: true });
    await expect(saveMonth).toBeDisabled();
    await monthPicker.getByRole('button', { name: 'Tahun', exact: true }).click();
    await expect(monthPicker.getByRole('spinbutton', { name: 'Tahun' })).toBeVisible();
    await monthPicker.getByRole('button', { name: 'Februari', exact: true }).click();
    await expect(saveMonth).toBeEnabled();
    await saveMonth.click();
    await expect(monthPicker).toBeHidden();
    await expect(monthTrigger).toContainText('Februari');
    await monthTrigger.click();
    await page.keyboard.press('Escape');
    await expect(monthPicker).toBeHidden();
    await expect(picker).toBeVisible();
    await expect(picker.getByTestId('date-dialog-save')).toBeDisabled();
    await picker.getByTestId('date-dialog-time-input').fill('17:45');
    await picker.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(dateTrigger).toContainText(initialMinute);
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
    const timeToggle = page.getByRole('switch', { name: 'Tampilkan jam' });
    await expect(timeToggle).toBeChecked();
    await expect(timeToggle).toBeDisabled();
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

  test('keeps detail navigation usable and validation in the focused automation shell', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/accounts');
    const account = page.locator(`a[href="/account/${accountId}"]`).first();
    for (let i = 0; i < 3; i++) {
      await account.click();
      await expect(page).toHaveURL(new RegExp(`/account/${accountId}$`));
      await expect(page.locator('[data-testid="route-page"]:not([inert])')).toBeVisible();
      await page.goBack();
      await expect(account).toBeVisible();
    }
    await page.goto('/loans');
    await page.getByRole('link', { name: /^Pinjaman regresi Lajur\./ }).click();
    await expect(page).toHaveURL(new RegExp(`/loans/${loanId}$`));
    await page.locator('.shadow-header').getByRole('button', { name: 'Kembali', exact: true }).click();
    await expect(page).toHaveURL(/\/loans$/);
    const viewport = page.viewportSize();
    if (viewport) {
      await page.setViewportSize({ width: 1024, height: viewport.height });
      await page.getByRole('button', { name: 'Tambah pinjaman', exact: true }).first().click();
      const createDialog = page.getByRole('dialog', { name: 'Tambah pinjaman', exact: true });
      const title = createDialog.getByRole('heading', { name: 'Tambah pinjaman', exact: true });
      await expect(title).toHaveCSS('text-align', 'center');
      await expect
        .poll(async () => {
          const dialogBox = await createDialog.boundingBox();
          const titleBox = await title.boundingBox();
          if (!dialogBox || !titleBox) return Infinity;
          return Math.abs(dialogBox.x + dialogBox.width / 2 - titleBox.x - titleBox.width / 2);
        })
        .toBeLessThan(2);
      await createDialog.getByRole('button', { name: 'Batal', exact: true }).click();
      await expect(createDialog).toBeHidden();
      await page.setViewportSize(viewport);
    }
    await page.goto('/transactions/automations/new');
    await expect(page.locator('.shadow-header')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Simpan', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Pilih rincian transaksi, Catatan' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Pilih syarat, memuat/ })).toBeVisible();
    const name = page.getByRole('textbox', { name: /Nama otomatisasi/i });
    await name.focus();
    await name.press('Tab');
    const error = page.getByRole('alert').filter({ hasText: /Masukkan nama/i });
    await expect(error).toBeVisible();
    await name.fill('Aturan uji valid');
    await expect(error).toBeHidden();
    await name.fill('');
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

  test('reads a loan payment from its activity before opening the loan editor', async ({ page }) => {
    const transactionId = extractId(
      await createTransaction({ request: api, accountId, amount: 8000, note: 'Cicilan fixture regresi' }),
    );
    await apiPost({
      request: api,
      path: `/api/v1/loans/${loanId}/link-payments`,
      data: { transactionIds: [transactionId] },
    });

    await page.goto(`/loans/${loanId}`);
    await page.getByRole('tab', { name: 'Aktivitas', exact: true }).click();
    await page.locator('[data-transaction-row]').first().click();
    const details = page.getByTestId('transaction-read-view');
    await expect(details.getByText('Dompet regresi Lajur.', { exact: true })).toBeVisible();
    await expect(details.getByRole('link', { name: 'Pinjaman regresi Lajur.', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Sunting', exact: true }).click();
    await expect(details).toBeHidden();
    await page.getByRole('button', { name: 'Tutup', exact: true }).click();
    await expect(details).toBeVisible();
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
