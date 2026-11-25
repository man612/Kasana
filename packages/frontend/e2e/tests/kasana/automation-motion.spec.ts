import { expect, test } from '@playwright/test';

import { completeOnboarding, signInViaApi } from '../../helpers/api-client';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

test.use({ viewport: { width: 320, height: 620 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });

test('the automation editor animates both ways and retains a draft until discard is confirmed', async ({
  page,
  playwright,
}) => {
  const credentials = buildTestCredentials({ prefix: 'lajur-automation-motion' });
  await signUpAndVerify({ creds: credentials });
  const api = await signInViaApi({ playwright, email: credentials.email, password: credentials.password });
  try {
    await completeOnboarding({ request: api, currencyCode: 'IDR' });
    await page.context().addCookies((await api.storageState()).cookies);
    await page.addInitScript(() => localStorage.setItem('preferred-locale', 'id'));
    await page.goto('/transactions/automations');
    await page.evaluate(() => {
      document.addEventListener('animationstart', (event) => {
        if (event.target instanceof HTMLElement && event.target.hasAttribute('data-focus-page-body')) {
          document.body.dataset.editorEntered = 'true';
        }
      });
      document.addEventListener('transitionrun', (event) => {
        const target = event.target;
        if (
          !(target instanceof HTMLElement) ||
          target.dataset.testid !== 'route-page' ||
          event.propertyName !== 'opacity'
        ) {
          return;
        }
        if (
          target.classList.contains('lajur-focus-page-leave-active') &&
          target.querySelector('[data-focus-page-body]')
        ) {
          document.body.dataset.editorLeftInert = String(target.inert);
        }
      });
    });
    await page.getByRole('link', { name: /Buat otomatisasi/i }).click();
    await expect(page.locator('body')).toHaveAttribute('data-editor-entered', 'true');

    const heading = page.getByRole('heading', { name: 'Buat otomatisasi', exact: true });
    const name = page.getByRole('textbox', { name: /Nama otomatisasi/i });
    const back = page.getByRole('link', { name: 'Kembali ke otomatisasi' });
    const status = page.locator('header').getByRole('status');
    await expect(heading).toBeVisible();
    await expect(status).toBeEmpty();
    const titleTop = (await heading.boundingBox())!.y;
    const backTop = (await back.boundingBox())!.y;
    await name.fill('Draft Otomatisasi');
    await expect(status).toHaveText('Perubahan belum disimpan');
    expect((await heading.boundingBox())!.y).toBeCloseTo(titleTop, 0);
    expect((await back.boundingBox())!.y).toBeCloseTo(backTop, 0);
    await name.fill('');
    await expect(status).toBeEmpty();
    await name.fill('Draft Otomatisasi');

    await back.click();
    const confirmation = page.getByRole('alertdialog', { name: 'Buang perubahan yang belum disimpan?' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Batal', exact: true }).click();
    await expect(name).toHaveValue('Draft Otomatisasi');
    await back.click();
    await confirmation.getByRole('button', { name: 'Buang perubahan', exact: true }).click();
    await expect(page).toHaveURL(/\/transactions\/automations$/);
    await expect(page.locator('body')).toHaveAttribute('data-editor-left-inert', 'true');
    await expect(page.getByTestId('route-page')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Otomatisasi', exact: true })).toBeVisible();
  } finally {
    await api.dispose();
  }
});
