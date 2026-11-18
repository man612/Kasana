import { expect, test } from '@playwright/test';

import {
  apiDelete,
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

      // UX11 #7: an empty Trash explains itself without navigating to an
      // empty destination or disabling the tap target entirely.
      const more = page.getByRole('button', { name: 'Lainnya', exact: true });
      await more.click();
      const trash = page.getByRole('menuitem', { name: /Tempat Sampah|Trash/i });
      await expect(trash).toHaveAttribute('data-trash-empty', 'true', { timeout: 15_000 });
      await trash.click();
      await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/);
      await expect(page.getByText('Tempat Sampah masih kosong')).toBeVisible();

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

      // UX25 #13: financial bulk actions must remain unavailable, but the
      // dimmed explanation trigger itself must be operable by touch, pointer,
      // and keyboard. ARIA-disabled would incorrectly block this help action.
      const withoutSelection = page.getByRole('button', { name: 'Pilih transaksi dahulu untuk menggunakan tindakan ini.' });
      await expect(withoutSelection).toHaveAttribute('data-selection-required', 'true');
      await withoutSelection.click();
      await expect(page.getByRole('status').filter({ hasText: 'Pilih transaksi dahulu untuk menggunakan tindakan ini.' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: /Hapus|Delete/i })).toHaveCount(0);

      await page.getByRole('button', { name: 'Lainnya', exact: true }).click();
      await page.getByRole('menuitemradio', { name: 'Tampilan tabel' }).click();

      const tableRoot = page.locator('[data-no-nav-swipe]').filter({ has: page.getByRole('table') }).first();
      await expect(tableRoot.getByRole('table')).toBeVisible();
      const viewport = tableRoot.locator('[data-reka-scroll-area-viewport]').first();
      await expect(viewport).toBeVisible();
      // UX11 #5: vertical movement belongs to the table, not to the filters
      // and view toolbar above it.
      const moreTopBefore = await more.evaluate((node) => node.getBoundingClientRect().top);
      await viewport.evaluate((node) => { node.scrollTop = node.scrollHeight; });
      const moreTopAfter = await more.evaluate((node) => node.getBoundingClientRect().top);
      expect(Math.abs(moreTopAfter - moreTopBefore)).toBeLessThanOrEqual(1);

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
      // The first form input is a hidden IDR currency field; type into the
      // actual visible loan-name control instead.
      await dialog.locator('input:not([type="hidden"])').first().fill('Pinjaman belum lengkap');
      await expect(submit, 'A name alone cannot make a financial form valid').toBeDisabled();
      await cancel.click();
      await expect(dialog).toBeHidden();
      await expect(page.getByRole('heading', { name: 'Pinjaman', exact: true })).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test('Trash supports back navigation and confirm-only empty-all for disposable transactions', async ({ page, playwright }) => {
    test.setTimeout(120_000);
    const creds = buildTestCredentials({ prefix: 'lajur-ux11-trash' });
    await signUpAndVerify({ creds });
    const api = await signInViaApi({ playwright, email: creds.email, password: creds.password });
    try {
      await completeOnboarding({ request: api, currencyCode: 'IDR' });
      const accountId = extractId(
        await createAccount({ request: api, name: 'Dompet uji sampah', currencyCode: 'IDR', initialBalance: 3_000_000 }),
      );
      const firstId = extractId(await createTransaction({
        request: api, accountId, amount: 102_000, note: 'Transaksi uji sampah satu',
      }));
      const secondId = extractId(await createTransaction({
        request: api, accountId, amount: 203_000, note: 'Transaksi uji sampah dua',
      }));
      await apiDelete({ request: api, path: `/api/v1/transactions/${firstId}` });
      await apiDelete({ request: api, path: `/api/v1/transactions/${secondId}` });
      await loginViaUI({ page, email: creds.email, password: creds.password });
      await page.goto('/transactions');

      const more = page.getByRole('button', { name: 'Lainnya', exact: true });
      await more.click();
      const trashMenuItem = page.getByRole('menuitem', { name: /Tempat Sampah|Trash/i });
      await expect(trashMenuItem).not.toHaveAttribute('data-trash-empty', 'true');
      await trashMenuItem.click();
      await expect(page.getByRole('heading', { name: 'Tempat Sampah' })).toBeVisible();
      const emptyAll = page.getByRole('button', { name: 'Kosongkan Semua' });
      await expect(emptyAll).toBeVisible();

      await emptyAll.click();
      const confirm = page.getByRole('alertdialog').last();
      await expect(confirm).toBeVisible();
      // UX11 #7/#9: outside tap cancels, never permanently deletes.
      await page.mouse.click(4, 4);
      await expect(confirm).toBeHidden();
      await expect(emptyAll).toBeVisible();

      await emptyAll.click();
      await expect(confirm).toBeVisible();
      await confirm.getByRole('button', { name: 'Kosongkan Semua' }).click();
      await expect(page.getByText('Tempat Sampah masih kosong')).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: /Kembali|Back/i }).first().click();
      await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/);
    } finally {
      await api.dispose();
    }
  });

});
