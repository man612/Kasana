import { expect, test } from '@playwright/test';

import { completeOnboarding, createAccount, signInViaApi } from '../../helpers/api-client';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('one backdrop tap dismisses only the top interactive layer and never reaches a background control', async ({
  page,
  playwright,
}) => {
  test.setTimeout(90_000);
  const credentials = buildTestCredentials({ prefix: 'lajur-modal-backdrop' });
  await signUpAndVerify({ creds: credentials });
  const api = await signInViaApi({ playwright, email: credentials.email, password: credentials.password });

  try {
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    await createAccount({ request: api, name: 'Backdrop test account', currencyCode: 'IDR', initialBalance: 0 });
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto('/transactions');

    const views = page.getByRole('button', { name: /^(Tampilan|Views)$/i, includeHidden: true });
    await expect(views).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
      const target = document.createElement('button');
      target.textContent = 'Backdrop test control';
      target.id = 'backdrop-test-control';
      target.dataset.presses = '0';
      target.addEventListener('click', () => {
        target.dataset.presses = String(Number(target.dataset.presses) + 1);
      });
      Object.assign(target.style, {
        position: 'fixed',
        top: '4px',
        left: '4px',
        width: '32px',
        height: '32px',
        zIndex: 'calc(var(--z-dialog) - 1)',
      });
      document.body.append(target);
    });
    const target = page.locator('#backdrop-test-control');
    const bounds = (await target.boundingBox())!;
    const tapBackdrop = async () => {
      await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    };

    await tapBackdrop();
    await expect(target).toHaveAttribute('data-presses', '1');

    await views.tap();
    await expect(views).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[data-lajur-overlay-layer="open"]') !== null))
      .toBe(true);
    await tapBackdrop();
    await expect(views).toHaveAttribute('aria-expanded', 'false');
    await expect(views).toBeFocused();
    await expect(target).toHaveAttribute('data-presses', '1');

    const add = page
      .locator('.shadow-header')
      .getByRole('button', { name: /^(Tambah|Add|Transaksi Baru|New transaction)$/i })
      .first();
    await add.tap();
    const form = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
    const date = form.getByTestId('date-field-calendar-trigger');
    await date.tap();
    const calendar = page.getByRole('dialog', { name: /Pilih tanggal|Select date|Pick date/i });
    await expect(calendar).toBeVisible();
    await tapBackdrop();
    await expect(calendar).toBeHidden();
    await expect(form).toBeVisible();
    await expect(date).toBeFocused();
    await expect(target).toHaveAttribute('data-presses', '1');

    await form.getByRole('textbox', { name: /^(Catatan|Note)$/i }).fill('Unsaved overlay audit note');
    await tapBackdrop();
    const discard = page.getByRole('alertdialog').filter({ hasText: /Tutup tanpa menyimpan|Close without saving/i });
    await expect(discard).toBeVisible();
    await tapBackdrop();
    await expect(discard).toBeHidden();
    await expect(form.getByRole('textbox', { name: /^(Catatan|Note)$/i })).toHaveValue('Unsaved overlay audit note');
    await expect(target).toHaveAttribute('data-presses', '1');
  } finally {
    await api.dispose();
  }
});
