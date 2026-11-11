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

  test('displays IDR spending on mobile, fits the viewport at 80% UI density and supports account deep-link return', async ({
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

        // 80% density uses rem typography instead of root CSS zoom.
        // Unlike CSS zoom, viewport dimensions and teleported overlay anchors
        // must remain in one coordinate space at the default density.
        const viewportGeometry = await deepLink.evaluate(() => {
          const shell = document.querySelector<HTMLElement>('.h-dvh');
          const shellRect = shell?.getBoundingClientRect();
          return {
            rootZoom: getComputedStyle(document.documentElement).zoom,
            overflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
            shellRight: shellRect?.right ?? -1,
            shellBottom: shellRect?.bottom ?? -1,
          };
        });
        expect(Number(viewportGeometry.rootZoom)).toBe(1);
        expect(viewportGeometry.overflow, 'Account page must not overflow horizontally').toBeLessThanOrEqual(2);
        expect(viewportGeometry.shellRight, 'Dashboard shell must fill viewport width').toBeGreaterThanOrEqual(389);
        expect(viewportGeometry.shellBottom, 'Dashboard shell must fill viewport height').toBeGreaterThanOrEqual(843);

        await expect(
          deepLink.getByRole('button', { name: /Buka menu navigasi|Open navigation menu/i }),
        ).toBeVisible();

        await back.click();
        await expect(deepLink).toHaveURL(/\/accounts(?:\?.*)?$/);
      } finally {
        await deepLink.close();
      }

      // The accent is independent of light/dark mode and survives navigation
      // and reload. Test the actual settings controls, not just stored tokens.
      await page.goto('/settings/appearance');
      const accents = page.getByRole('group', { name: /Warna aksen|Accent color/i });
      await expect(accents).toBeVisible();
      await expect(accents.getByRole('button', { name: /Ungu|Purple/i })).toHaveAttribute('aria-pressed', 'true');
      await accents.getByRole('button', { name: /Hijau|Green/i }).click();
      await expect(accents.getByRole('button', { name: /Hijau|Green/i })).toHaveAttribute('aria-pressed', 'true');
      expect(await page.evaluate(() => localStorage.getItem('kasana-accent'))).toBe('green');
      await page.reload();
      const restoredAccents = page.getByRole('group', { name: /Warna aksen|Accent color/i });
      await expect(restoredAccents.getByRole('button', { name: /Hijau|Green/i })).toHaveAttribute('aria-pressed', 'true');
      await restoredAccents.getByRole('button', { name: /Ungu|Purple/i }).click();

      // A portal is expected, but the dropdown must still visually touch its
      // trigger (within a small design-system gap), including on narrow screens.
      await page.goto('/settings/general');
      const trigger = page.getByRole('combobox').first();
      await expect(trigger).toBeVisible();
      await trigger.click();
      const dropdown = page.getByRole('listbox').first();
      await expect(dropdown).toBeVisible();
      const triggerBox = await trigger.boundingBox();
      const dropdownBox = await dropdown.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(dropdownBox).not.toBeNull();
      if (triggerBox && dropdownBox) {
        const verticalGap = Math.min(
          Math.abs(dropdownBox.y - (triggerBox.y + triggerBox.height)),
          Math.abs(triggerBox.y - (dropdownBox.y + dropdownBox.height)),
        );
        expect(verticalGap, 'Select dropdown should stay near its triggering field').toBeLessThanOrEqual(20);
        expect(dropdownBox.x).toBeGreaterThanOrEqual(-2);
        expect(dropdownBox.x + dropdownBox.width).toBeLessThanOrEqual(392);
      }
      await page.keyboard.press('Escape');
    } finally {
      await api.dispose();
    }
  });
});
