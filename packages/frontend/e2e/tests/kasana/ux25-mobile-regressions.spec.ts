import { expect, test } from '@playwright/test';

import {
  completeOnboarding,
  createAccount,
  createTransaction,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
import { loginViaUI } from '../../helpers/auth';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

// Each test owns a disposable test.local user; this suite runs only on the
// isolated CI stack. Never connect these tests to operator data.
test.describe('Lajur UX-25 mobile regression gates', () => {
  test.use({ viewport: { width: 320, height: 700 } });

  test('saved views are Indonesian and the transaction table scrolls locally', async ({ page, playwright }) => {
    test.setTimeout(90_000);
    const creds = buildTestCredentials({ prefix: 'lajur-ux25-table' });
    await signUpAndVerify({ creds });
    const api = await signInViaApi({ playwright, email: creds.email, password: creds.password });
    try {
      await completeOnboarding({ request: api, currencyCode: 'IDR' });
      const accountId = extractId(
        await createAccount({ request: api, name: 'Dompet pengujian tabel', currencyCode: 'IDR', initialBalance: 2_000_000 }),
      );
      await createTransaction({ request: api, accountId, amount: 1_435_560, note: 'Transaksi UI tabel' });
      await loginViaUI({ page, email: creds.email, password: creds.password });
      await page.goto('/transactions');

      const views = page.getByRole('button', { name: /^Tampilan$/i });
      await expect(views).toBeVisible({ timeout: 20_000 });
      const viewsChevron = views.locator('svg').last();
      await expect(viewsChevron).not.toHaveClass(/rotate-180/);
      await views.click();
      await expect(viewsChevron).toHaveClass(/rotate-180/);
      await expect(page.getByText('Belum ada tampilan tersimpan. Atur filter, lalu simpan sebagai tampilan.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Simpan sebagai tampilan baru' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(viewsChevron).not.toHaveClass(/rotate-180/);

      // UX25 #13: no selection means no bulk mutations. The explanation is
      // inline and does not require a hover-only tooltip.
      const withoutSelection = page.getByRole('button', { name: 'Pilih transaksi dahulu untuk menggunakan tindakan ini.' });
      await expect(withoutSelection).toHaveAttribute('aria-disabled', 'true');
      await withoutSelection.click();
      await expect(page.getByRole('status').filter({ hasText: 'Pilih transaksi dahulu untuk menggunakan tindakan ini.' })).toBeVisible();

      await page.getByRole('button', { name: 'Lainnya', exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'Tampilan tabel' }).click();

      const tableRoot = page.locator('[data-no-nav-swipe]').filter({ has: page.getByRole('table') }).first();
      await expect(tableRoot.getByRole('table')).toBeVisible();
      const viewport = tableRoot.locator('[data-reka-scroll-area-viewport]').first();
      await expect(viewport).toBeVisible();

      // At 320px the amount columns need their full width, not ellipsis.
      // Scroll only inside the table; never shift the whole document.
      await expect.poll(() => viewport.evaluate((element) => element.scrollWidth - element.clientWidth))
        .toBeGreaterThan(50);
      await viewport.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(50);
      const pageOverflow = await page.evaluate(
        () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      );
      expect(pageOverflow, 'Only the transaction table may overflow horizontally').toBeLessThanOrEqual(2);
      await expect(tableRoot.getByText('Geser tabel ke samping untuk melihat kolom lainnya.')).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test('new loan remains unsavable until valid and can be cancelled on a narrow phone', async ({ page, playwright }) => {
    test.setTimeout(90_000);
    const creds = buildTestCredentials({ prefix: 'lajur-ux25-loan' });
    await signUpAndVerify({ creds });
    const api = await signInViaApi({ playwright, email: creds.email, password: creds.password });
    try {
      await completeOnboarding({ request: api, currencyCode: 'IDR' });
      await loginViaUI({ page, email: creds.email, password: creds.password });
      await page.goto('/loans');
      await page.getByRole('button', { name: /Tambah pinjaman pertama|Tambah pinjaman/i }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Tambah pinjaman' });
      await expect(dialog).toBeVisible();
      const submit = dialog.getByRole('button', { name: /Buat pinjaman/i });
      const cancel = dialog.getByRole('button', { name: /^Batal$/i });
      await expect(submit).toBeDisabled();
      await expect(cancel).toBeVisible();
      await dialog.locator('input').first().fill('Pinjaman belum lengkap');
      await expect(submit, 'A name alone cannot make a financial form valid').toBeDisabled();
      await cancel.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Pinjaman', exact: true })).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});
