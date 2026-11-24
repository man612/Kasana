import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiPatch, completeOnboarding, createAccount, createAuthenticatedApiContext } from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

test.describe('Lajur. transaction sheet and calendar on mobile', () => {
  test.use({ viewport: { width: 320, height: 568 }, timezoneId: 'Asia/Jakarta', isMobile: true, hasTouch: true });
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    api = await createAuthenticatedApiContext({ playwright, ...buildTestCredentials({ prefix: 'lajur-sheet' }) });
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    await createAccount({ request: api, name: 'Dompet uji', currencyCode: 'IDR', initialBalance: 100_000 });
    await createAccount({ request: api, name: 'Tabungan uji', currencyCode: 'IDR', initialBalance: 50_000 });
    await apiPatch({ request: api, path: '/api/v1/user/settings', data: { locale: 'id' } });
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies((await api.storageState()).cookies);
    await context.addInitScript(() => localStorage.setItem('preferred-locale', 'id'));
  });

  test.afterAll(async () => api?.dispose());

  test('keeps future-date help in the account section and the footer visible during changes', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.shadow-header').getByRole('button', { name: 'Tambah', exact: true }).first().tap();
    const typePicker = page.getByTestId('transaction-type-switcher');
    const sheet = page.getByRole('dialog').filter({ has: typePicker });
    const account = sheet.getByTestId('transaction-account-section');
    const help = account.getByTestId('transaction-account-planned-help');
    const planned = account.getByRole('switch');
    const category = sheet.getByText('Kategori', { exact: true }).first();
    await expect(planned).toBeVisible();
    await planned.tap();
    await expect(planned).toBeChecked();
    await expect(help).toContainText(/Tanggal mendatang/i);

    await expect
      .poll(async () => {
        const bounds = await help.boundingBox();
        const next = await category.boundingBox();
        return bounds && next ? next.y - bounds.y - bounds.height : -1;
      })
      .toBeGreaterThanOrEqual(4);
    await planned.tap();
    await expect(planned).not.toBeChecked();
    await expect(help.locator('xpath=../..')).toHaveAttribute('inert', '');

    // Rapid mode changes must only animate in-flow rows. The outer sheet keeps
    // its intrinsic height and its capped body leaves the footer reachable.
    const motion = await sheet.evaluate(async (element) => {
      const picker = element.querySelector('[data-testid="transaction-type-switcher"]')!;
      const transfers = [...picker.querySelectorAll('button')];
      const footer = [...element.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Buat')!;
      const frames: { heightAnimation: boolean; footerBottom: number; viewportBottom: number }[] = [];
      for (let frame = 0; frame < 24; frame++) {
        await new Promise(requestAnimationFrame);
        if (frame === 0) transfers[2]!.click();
        if (frame === 4) transfers[1]!.click();
        if (frame === 8) transfers[0]!.click();
        frames.push({
          heightAnimation: element
            .getAnimations()
            .some(
              (animation) =>
                animation.effect instanceof KeyframeEffect &&
                animation.effect.getKeyframes().some((keyframe) => 'height' in keyframe),
            ),
          footerBottom: footer.getBoundingClientRect().bottom,
          viewportBottom: window.innerHeight,
        });
      }
      return frames;
    });
    expect(motion.every((frame) => !frame.heightAnimation)).toBe(true);
    expect(motion.every((frame) => frame.footerBottom <= frame.viewportBottom + 1)).toBe(true);
    await expect(typePicker.getByText('Pengeluaran', { exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(category).toBeVisible();
  });

  test('animates the year and month selections, saves month navigation separately, and opens the native time picker', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLInputElement.prototype.showPicker = function () {
        this.dataset.pickerOpened = 'true';
        this.value = '17:45';
        this.dispatchEvent(new Event('input', { bubbles: true }));
      };
    });
    await page.clock.install({ time: new Date('2026-11-23T05:11:00.000Z') });
    await page.goto('/dashboard');
    await page.locator('.shadow-header').getByRole('button', { name: 'Tambah', exact: true }).first().tap();
    const sheet = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
    const dateTrigger = sheet.getByTestId('date-field-calendar-trigger');
    await dateTrigger.tap();
    const date = page.getByTestId('transaction-date-dialog');
    await expect(date).toBeVisible();
    const monthTrigger = date.getByTestId('calendar-month-trigger');
    await monthTrigger.tap();
    const picker = page.getByTestId('calendar-month-picker');
    const save = picker.getByRole('button', { name: 'Simpan', exact: true });
    await expect(save).toBeDisabled();
    await picker.getByRole('button', { name: 'Tahun', exact: true }).tap();
    const yearGrid = picker.getByTestId('calendar-year-grid');
    await expect(yearGrid.getByRole('button', { name: '2026', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await yearGrid.getByRole('button', { name: '2025', exact: true }).tap();
    const selectedYear = yearGrid.getByRole('button', { name: '2025', exact: true });
    await expect(selectedYear).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => {
        const indicator = await yearGrid.locator('.calendar-picker-indicator').boundingBox();
        const option = await selectedYear.boundingBox();
        return indicator && option ? Math.abs(indicator.x - option.x) + Math.abs(indicator.y - option.y) : Infinity;
      })
      .toBeLessThanOrEqual(1);
    await expect(save).toBeEnabled();
    await yearGrid.getByRole('button', { name: '2026', exact: true }).tap();
    await expect(save).toBeDisabled();

    const months = picker.getByTestId('calendar-month-grid');
    await months.getByRole('button', { name: 'Februari', exact: true }).tap();
    await expect(months.getByRole('button', { name: 'Februari', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(save).toBeEnabled();
    await save.tap();
    await expect(picker).toBeHidden();
    await expect(monthTrigger).toContainText('Februari 2026');
    await expect(date.getByTestId('date-dialog-save')).toBeDisabled();

    const time = date.getByTestId('date-dialog-time-input');
    await expect(time).toHaveText('12:11');
    await expect(time.locator('svg')).toHaveCount(0);
    await time.tap();
    await expect(date.locator('input[type="time"]')).toHaveAttribute('data-picker-opened', 'true');
    await expect(time).toHaveText('17:45');
    await expect(date.getByText('Jam (WIB)')).toBeVisible();
    await date.getByTestId('date-dialog-save').tap();
    await expect(dateTrigger).toContainText('17:45:00');
  });
});
