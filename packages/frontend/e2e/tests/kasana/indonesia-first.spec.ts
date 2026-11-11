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

test.describe('Kasana Indonesia-first browser smoke (disposable stack only)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('displays IDR spending on mobile, supports 80% zoom and account deep-link return', async ({
    page,
    playwright,
  }) => {
    const credentials = buildTestCredentials({ prefix: 'kasana-idr' });
    const accountName = 'Dompet Uji Kasana IDR';

    await signUpAndVerify({ creds: credentials });
    const api = await signInViaApi({
      playwright,
      email: credentials.email,
      password: credentials.password,
    });

    try {
      await completeOnboarding({ request: api, currencyCode: 'IDR' });
      const account = await createAccount({
        request: api,
        name: accountName,
        currencyCode: 'IDR',
        initialBalance: 1_000_000,
      });
      const accountId = extractId(account);

      await createTransaction({
        request: api,
        accountId,
        amount: 125_000,
        note: 'Belanja simulasi Kasana',
      });

      await loginViaUI({
        page,
        email: credentials.email,
        password: credentials.password,
      });

      await page.goto('/accounts');
      await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 20_000 });

      // New tab has the authenticated cookie but no prior app navigation
      // history. It must still have an explicit, reliable Back destination.
      const deepLink = await page.context().newPage();
      try {
        await deepLink.goto('/account/' + accountId);
        await expect(deepLink.getByText(accountName).first()).toBeVisible({ timeout: 20_000 });
        await expect(deepLink.getByText(/875[.,]000/).first()).toBeVisible({ timeout: 20_000 });

        const back = deepLink.getByRole('button', { name: /Kembali|Back/i });
        await expect(back).toBeVisible();

        // Root CSS zoom changes scrollWidth's coordinate space: at 80%,
        // a perfectly fitting 390px page reports ~488px scrollWidth.
        // Normalize to rendered pixels before checking horizontal overflow.
        const measureHorizontalOverflow = () =>
          deepLink.evaluate(() => {
            const rootZoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
            const scrollWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
            return scrollWidth * rootZoom - window.innerWidth;
          });

        expect(await measureHorizontalOverflow(), 'Account detail must fit the 390px viewport at 100%').toBeLessThanOrEqual(2);

        await deepLink.evaluate(() => {
          document.documentElement.style.zoom = '0.8';
        });
        expect(await measureHorizontalOverflow(), 'Account detail must fit the 390px viewport at 80%').toBeLessThanOrEqual(2);
        await expect(
          deepLink.getByRole('button', { name: /Buka menu navigasi|Open navigation menu/i }),
        ).toBeVisible();

        await back.click();
        await expect(deepLink).toHaveURL(/\/accounts(?:\?.*)?$/);
      } finally {
        await deepLink.close();
      }
    } finally {
      await api.dispose();
    }
  });
});
