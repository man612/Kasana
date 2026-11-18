import { expect, test, type Locator } from '@playwright/test';

import {
  apiPut,
  completeOnboarding,
  createAccount,
  createTransaction,
  dismissOnboarding,
  extractId,
  signInViaApi,
} from '../../helpers/api-client';
import { loginViaUI } from '../../helpers/auth';
import { buildTestCredentials, signUpAndVerify } from '../../helpers/test-setup';

// Playwright supports synthetic TouchEvents for legacy touch gesture handlers.
// Use the real target geometry, so the same sequence works at 320 and 390px.
async function swipeElement(element: Locator, from: number, to: number) {
  await element.evaluate((node, { from, to }) => {
    const rect = node.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const touch = (x: number) => new Touch({
      identifier: 1,
      target: node,
      clientX: rect.left + rect.width * x,
      clientY: y,
    });
    const initial = touch(from);
    node.dispatchEvent(new TouchEvent('touchstart', {
      touches: [initial],
      targetTouches: [initial],
      changedTouches: [initial],
      bubbles: true,
      cancelable: true,
    }));
    const finalTouch = touch(to);
    node.dispatchEvent(new TouchEvent('touchend', {
      touches: [],
      targetTouches: [],
      changedTouches: [finalTouch],
      bubbles: true,
      cancelable: true,
    }));
  }, { from, to });
}

test.describe('Kasana Indonesia-first browser smoke (disposable stack only)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('displays IDR spending on full-size mobile UI, fits the viewport and supports account deep-link return', async ({
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

      // The generic onboarding fixture deliberately permanently dismisses the guide.
      // Reopen it for this isolated timer check, then restore the fixture's original
      // dismissed state before continuing the other interaction smoke assertions.
      await apiPut({
        request: api,
        path: '/api/v1/user/settings/onboarding',
        data: { isDismissed: false, dismissedAt: null },
      });
      // A short, cross-tab Quick Start hide must expire without reloading.
      // The timer is owned by the Pinia store even when the floating button is hidden.
      await page.goto('/dashboard');
      const quickStart = page.locator('button.fixed:has(svg.lucide-rocket)');
      await expect(quickStart).toBeVisible({ timeout: 20_000 });
      await page.evaluate(() => {
        const key = 'kasana.quick-start-hidden-until-v1';
        const hiddenUntil = String(Date.now() + 2_500);
        localStorage.setItem(key, hiddenUntil);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: hiddenUntil }));
      });
      await expect(quickStart).toBeHidden();
      await expect(quickStart).toBeVisible({ timeout: 8_000 });
      await dismissOnboarding({ request: api });
      await page.reload();
      await expect(quickStart).toBeHidden();

      // Swipe from just inside the system-back edge to open the app sidebar.
      const shell = page.locator('.h-dvh').first();
      await swipeElement(shell, 0.14, 0.74);
      const sidebarSheet = page.locator('[role="dialog"][data-state="open"]').first();
      await expect(sidebarSheet).toBeVisible();
      await swipeElement(sidebarSheet.locator(':scope > div.h-full').first(), 0.80, 0.18);
      await expect(sidebarSheet).toBeHidden();

      // Swiping the four-item bottom navbar moves one destination at a time.
      const navGestureTarget = page.getByRole('navigation', { name: 'Navigasi utama' });
      await swipeElement(navGestureTarget, 0.85, 0.15);
      await expect(page).toHaveURL(/\/accounts(?:\?.*)?$/);
      await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 20_000 });

      // The mobile account menu is deliberately an anchored popover, not a
      // centered confirmation. Outside taps dismiss it, and launching the
      // vehicle form must close the menu first to avoid competing focus layers.
      const accountMenuTrigger = page.getByRole('button', { name: /Tindakan akun|Account actions/i });
      await accountMenuTrigger.click();
      const accountMenu = page.getByRole('dialog', { name: /Tindakan akun|Account actions/i });
      await expect(accountMenu).toBeVisible();
      await expect(accountMenu.getByRole('button', { name: /Buat akun|Create account/i })).toBeVisible();
      await expect(accountMenu.getByRole('button', { name: /Tambah kendaraan|Add vehicle/i })).toBeVisible();
      await page.mouse.click(4, 4);
      await expect(accountMenu).toBeHidden();
      await accountMenuTrigger.click();
      await accountMenu.getByRole('button', { name: /Tambah kendaraan|Add vehicle/i }).click();
      await expect(accountMenu).toBeHidden();
      await expect(page.getByRole('dialog', { name: /Tambah kendaraan|Add vehicle/i })).toBeVisible();
      await page.keyboard.press('Escape');

      // New tab has the authenticated cookie but no prior app navigation
      // history. It must still have an explicit, reliable Back destination.
      const deepLink = await page.context().newPage();
      try {
        await deepLink.goto('/account/' + accountId);
        await expect(deepLink.getByText(accountName).first()).toBeVisible({ timeout: 20_000 });
        await expect(deepLink.getByText(/875[.,]000/).first()).toBeVisible({ timeout: 20_000 });

        const back = deepLink.getByRole('button', { name: /Kembali|Back/i });
        await expect(back).toBeVisible();

        // Mobile 100% and desktop 80% use rem typography, never root zoom.
        // Root zoom previously clipped fullscreen panels and displaced portals.
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

        // Account detail is a genuinely populated screen, not just the empty
        // sign-in shell. Check its header, total and horizontal reflow after
        // increasing mobile typography to its native 100% size.
        for (const width of [320, 375, 430, 767, 768, 1280]) {
          await deepLink.setViewportSize({ width, height: 844 });
          await expect(deepLink.getByText(accountName).first()).toBeVisible();
          const metrics = await deepLink.evaluate(() => ({
            scale: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kasana-ui-scale')),
            overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
            documentZoom: getComputedStyle(document.documentElement).zoom,
          }));
          expect(metrics.scale, `account UI scale at ${width}px`).toBe(width <= 767 ? 1 : 0.8);
          expect(Number(metrics.documentZoom)).toBe(1);
          expect(metrics.overflow, `account detail horizontal overflow at ${width}px`).toBeLessThanOrEqual(2);
        }
        await deepLink.setViewportSize({ width: 390, height: 844 });

        await expect(deepLink.getByRole('button', { name: /Buka menu navigasi|Open navigation menu/i })).toBeVisible();

        // Account actions must expose their purpose to assistive technology and
        // work with the keyboard, not only with pointer clicks on styled text.
        const renameAction = deepLink.getByRole('button', { name: /Edit Nama Akun|Edit Account Name/i });
        await expect(renameAction).toBeVisible();
        await renameAction.focus();
        await deepLink.keyboard.press('Enter');
        await expect(deepLink.getByRole('textbox', { name: /Nama akun|Account name/i })).toBeVisible();
        await deepLink.keyboard.press('Escape');

        const adjustBalanceAction = deepLink.getByRole('button', { name: /Sesuaikan saldo|Adjust balance/i });
        await expect(adjustBalanceAction).toBeVisible();
        await adjustBalanceAction.focus();
        await deepLink.keyboard.press('Enter');
        await expect(deepLink.getByRole('dialog', { name: /Sesuaikan Saldo|Adjust Balance/i })).toBeVisible();
        await deepLink.keyboard.press('Escape');

        await back.click();
        await expect(deepLink).toHaveURL(/\/accounts(?:\?.*)?$/);
      } finally {
        await deepLink.close();
      }

      // Full-size mobile fonts must not push the transaction save control off
      // the viewport when the bottom sheet is open on a short 320px phone.
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto('/dashboard');
      const mobileNav = page.getByRole('navigation', { name: 'Navigasi utama' });
      await expect(mobileNav).toBeVisible();
      for (const label of [/Dasbor|Dashboard/i, /Akun|Accounts/i, /Transaksi|Transactions/i, /Analitik|Analytics/i]) {
        await expect(mobileNav.getByRole('link', { name: label })).toBeVisible();
      }
      const mobileNewTransaction = page.locator('.shadow-header').getByRole('button', { name: /^(Tambah|Add|Transaksi Baru|New transaction)$/i }).first();
      await expect(mobileNewTransaction).toBeVisible();
      await mobileNewTransaction.click();
      const mobileForm = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
      await expect(mobileForm).toBeVisible();
      // At 320px, the date is on a separate row but its time remains
      // directly editable, just like other transaction date-time fields.
      const amountDateStack = mobileForm.getByTestId('transaction-amount-date-stack');
      const primaryAmount = amountDateStack.locator('input[inputmode="decimal"]').first();
      const mobileDateInput = amountDateStack.getByTestId('date-field-numeric-input');
      await expect(primaryAmount).toBeVisible();
      await expect(mobileDateInput).toBeVisible();
      await expect(amountDateStack).toHaveCSS('flex-direction', 'column');
      // The sheet animates into the viewport with a transform. Two awaited
      // boundingBox() calls can sample *different animation frames*, making
      // correctly stacked fields look as though they overlap. Read both DOM
      // rectangles in one browser evaluation (the same rendering snapshot).
      // Keep the real geometry requirement: no overlap, even at 320px.
      await expect
        .poll(
          () =>
            amountDateStack.evaluate((stack) => {
              const amount = stack.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
              const date = stack.querySelector<HTMLInputElement>('[data-testid="date-field-numeric-input"]');
              if (!amount || !date) return Number.NEGATIVE_INFINITY;
              return date.getBoundingClientRect().top - amount.getBoundingClientRect().bottom;
            }),
          { message: '320px amount and date must be vertically separate', timeout: 8_000 },
        )
        .toBeGreaterThanOrEqual(4);
      await expect(mobileForm.getByTestId('date-field-time-input')).toBeVisible();

      // Closing account selection without picking must clear its search filter.
      const accountPickerTrigger = mobileForm.locator('[data-test="account-select-trigger"]').first();
      await expect(accountPickerTrigger).toBeVisible();
      await accountPickerTrigger.click();
      const accountPicker = page.locator('[data-test="account-select-dialog"]').last();
      const accountPickerSearch = accountPicker.locator('[data-test="account-select-search"]');
      await expect(accountPicker).toBeVisible();
      await accountPickerSearch.fill('this-account-does-not-exist');
      // Use the explicit close control: Escape on type=search can clear the
      // native search field before it dismisses the surrounding dialog.
      await accountPicker.getByRole('button', { name: /Tutup|Close/i }).click();
      await expect(accountPicker).toBeHidden();
      await accountPickerTrigger.click();
      await expect(accountPicker).toBeVisible();
      await expect(accountPickerSearch).toHaveValue('');
      await expect(accountPicker.getByText(accountName).first()).toBeVisible();
      await accountPicker.getByText(accountName).first().click();
      await expect(accountPicker).toBeHidden();

      const payeePickerTrigger = mobileForm.locator('[data-test="payee-select-field"]').first();
      await expect(payeePickerTrigger).toBeVisible();
      await payeePickerTrigger.click();
      const payeePicker = page.getByRole('dialog').filter({ has: page.locator('[data-test="payee-select-search"]') }).last();
      await expect(payeePicker).toBeVisible();
      await payeePicker.locator('[data-test="payee-select-search"]').fill('recipient-that-does-not-exist');
      // A recipient search field can own keyboard handling; exercise the
      // explicit dialog X independently of the account selector's Escape path.
      await payeePicker.getByRole('button', { name: /Tutup|Close/i }).click();
      await expect(payeePicker).toBeHidden();
      await payeePickerTrigger.click();
      await expect(payeePicker.locator('[data-test="payee-select-search"]')).toHaveValue('');
      await payeePicker.getByRole('button', { name: /Tutup|Close/i }).click();

      const mobileAmountMetrics = await primaryAmount.evaluate((element) => ({
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        height: element.getBoundingClientRect().height,
      }));
      expect(mobileAmountMetrics.fontSize, '320px money input text should remain readable').toBeGreaterThanOrEqual(16);
      expect(mobileAmountMetrics.height, '320px money input should have a full touch target').toBeGreaterThanOrEqual(43);
      const mobileSave = mobileForm.getByRole('button', { name: /Buat transaksi|Create transaction/i });
      await expect(mobileSave).toBeVisible();
      // Vaul animates the bottom sheet into the viewport. A nonzero box and
      // toBeVisible() do NOT imply the entrance animation has settled.
      // Poll the actual bounding rectangle; keep this test red if the footer
      // remains clipped after the transition has had time to complete.
      await expect
        .poll(
          async () => {
            const bounds = await mobileSave.boundingBox();
            return bounds ? bounds.y + bounds.height : Number.POSITIVE_INFINITY;
          },
          { message: '320px mobile Save must fully enter the 568px viewport', timeout: 8_000 },
        )
        .toBeLessThanOrEqual(570);
      const mobileSaveBox = await mobileSave.boundingBox();
      expect(mobileSaveBox).not.toBeNull();
      expect(mobileSaveBox!.x, '320px mobile save button left').toBeGreaterThanOrEqual(-2);
      expect(mobileSaveBox!.x + mobileSaveBox!.width, '320px mobile save button right').toBeLessThanOrEqual(322);

      // On a short mobile viewport, templates must use a centered dialog with
      // reachable bottom actions, not a clipped nested bottom sheet.
      await mobileForm.getByRole('button', { name: /^Templat|^Template/i }).first().click();
      const templateDialog = page.getByRole('dialog', { name: /^Templat|^Template/i });
      await expect(templateDialog).toBeVisible();
      const templateBounds = await templateDialog.boundingBox();
      expect(templateBounds).not.toBeNull();
      expect(templateBounds!.y).toBeGreaterThanOrEqual(-2);
      expect(templateBounds!.y + templateBounds!.height).toBeLessThanOrEqual(570);
      // The first popup is a TEMPLATE LIST, not the template editor. Open
      // "Save template" to inspect the second, editable popup and its Cancel.
      await templateDialog.getByRole('button', { name: /Simpan templat|Save .*template/i }).click();
      const templateEditor = page.getByRole('dialog', { name: /^(Simpan sebagai templat|Save as template)$/i });
      await expect(templateEditor).toBeVisible();
      // UX25 #2: discard confirmation must layer above the editor. Cancelling
      // the warning preserves the user's unsaved input; confirming discards it.
      const cancelTemplate = templateEditor.getByRole('button', { name: /^(Batal|Cancel)$/i });
      const templateName = templateEditor.getByPlaceholder('mis. Kopi pagi');
      await expect(cancelTemplate).toBeVisible();
      await templateName.fill('Templat tidak boleh tersimpan');
      await cancelTemplate.click();
      const discardTemplate = page.getByRole('alertdialog').last();
      await expect(discardTemplate).toBeVisible();
      await expect(discardTemplate.getByText(/Tutup tanpa menyimpan|Close without saving/i)).toBeVisible();
      await discardTemplate.getByRole('button', { name: /^(Batal|Cancel)$/i }).click();
      await expect(templateEditor).toBeVisible();
      await expect(templateName).toHaveValue('Templat tidak boleh tersimpan');
      await cancelTemplate.click();
      await discardTemplate.getByRole('button', { name: /Buang|Discard/i }).click();
      await expect(templateEditor).toBeHidden();
      await expect(mobileForm).toBeVisible();
      // A tap on the transaction sheet close button must work on Vaul too.
      // With unsaved input it must ask before discarding, not silently close.
      await primaryAmount.fill('1234');
      await mobileForm.getByRole('button', { name: /Tutup|Close/i }).click();
      const discardConfirmation = page.getByRole('alertdialog');
      await expect(discardConfirmation.getByText(/Tutup tanpa menyimpan|Close without saving/i)).toBeVisible();
      // Cancel must retain the form and must not dispatch the destructive action.
      await discardConfirmation.getByRole('button', { name: /^(Batal|Cancel)$/i }).click();
      await expect(mobileForm).toBeVisible();
      await mobileForm.getByRole('button', { name: /Tutup|Close/i }).click();
      await expect(discardConfirmation).toBeVisible();
      await discardConfirmation.getByRole('button', { name: /Buang|Discard/i }).click();
      await expect(mobileForm).toBeHidden();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/dashboard');
      const mobileDateTransaction = page.locator('.shadow-header').getByRole('button', { name: /^(Tambah|Add|Transaksi Baru|New transaction)$/i }).first();
      await mobileDateTransaction.click();
      const mobileDateForm = page.getByRole('dialog').filter({ has: page.getByTestId('transaction-type-switcher') });
      await expect(mobileDateForm).toBeVisible();
      await mobileDateForm.getByTestId('date-field-calendar-trigger').first().click();
      const mobileDatePicker = page.getByTestId('transaction-date-dialog');
      await expect(mobileDatePicker).toBeVisible();
      const mobilePickerBox = await mobileDatePicker.boundingBox();
      expect(mobilePickerBox).not.toBeNull();
      expect(mobilePickerBox!.x).toBeGreaterThanOrEqual(-2);
      expect(mobilePickerBox!.x + mobilePickerBox!.width).toBeLessThanOrEqual(392);
      expect(mobilePickerBox!.y).toBeGreaterThanOrEqual(-2);
      expect(mobilePickerBox!.y + mobilePickerBox!.height).toBeLessThanOrEqual(846);
      const mobileUnusedScroll = await mobileDatePicker.evaluate((node) => node.scrollHeight - node.clientHeight);
      expect(mobileUnusedScroll, '390px mobile date picker should not require needless scrolling').toBeLessThanOrEqual(2);
      await page.keyboard.press('Escape');

      // The accent is independent of light/dark mode and survives navigation
      // and reload. Test the actual settings controls, not just stored tokens.
      await page.goto('/settings/appearance');
      const accents = page.getByRole('group', { name: /Warna aksen|Accent color/i });
      await expect(accents).toBeVisible();
      // Fresh accounts default to blue in Lajur. Mobile UX Round 2; purple
      // remains a selectable user preference, not the initial default.
      await expect(accents.getByRole('button', { name: /Biru|Blue/i })).toHaveAttribute('aria-pressed', 'true');
      await expect(accents.getByRole('button', { name: /Ungu|Purple/i })).toHaveAttribute('aria-pressed', 'false');
      const accentSaved = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/api/v1/user/settings') &&
          response.status() === 200,
      );
      await accents.getByRole('button', { name: /Hijau|Green/i }).click();
      await accentSaved;
      await expect(accents.getByRole('button', { name: /Hijau|Green/i })).toHaveAttribute('aria-pressed', 'true');
      const perAccountAccents = await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('kasana-accent:user:'))
          .map((key) => localStorage.getItem(key)),
      );
      expect(perAccountAccents).toContain('green');
      await page.reload();
      const restoredAccents = page.getByRole('group', { name: /Warna aksen|Accent color/i });
      await expect(restoredAccents.getByRole('button', { name: /Hijau|Green/i })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await restoredAccents.getByRole('button', { name: /Ungu|Purple/i }).click();

      // A portal is expected, but the dropdown must still visually touch its
      // trigger (within a small design-system gap), including on narrow screens.
      await page.goto('/settings/general');
      const trigger = page.getByRole('combobox').first();
      await expect(trigger).toBeVisible();
      // Capture the trigger geometry before opening the popup. Reka UI's
      // modal focus scope may temporarily hide outside controls from the
      // accessibility tree while the listbox is open, although the trigger
      // remains in the DOM and the popup is correctly anchored to it.
      const triggerBox = await trigger.boundingBox();
      expect(triggerBox).not.toBeNull();
      await trigger.click();
      const dropdown = page.getByRole('listbox').first();
      await expect(dropdown).toBeVisible();
      const dropdownBox = await dropdown.boundingBox();
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

      // Real Chromium style checks: motion runs normally but OS preference
      // suppresses decorative movement. Do not test just class names.
      const readRouteMotionSeconds = () =>
        page.evaluate(() => {
          const probe = document.createElement('div');
          probe.className = 'kasana-section-enter-active';
          document.body.appendChild(probe);
          const durations = getComputedStyle(probe)
            .transitionDuration.split(',')
            .map((value) => {
              const trimmed = value.trim();
              const number = Number.parseFloat(trimmed);
              return trimmed.endsWith('ms') ? number / 1000 : number;
            });
          probe.remove();
          return Math.max(...durations);
        });
      const readSelectionMotionSeconds = () =>
        page.evaluate(() => {
          const indicator = document.createElement('span');
          indicator.className = 'kasana-selection-indicator';
          indicator.dataset.state = 'checked';
          document.body.appendChild(indicator);
          const duration = getComputedStyle(indicator).animationDuration.trim();
          indicator.remove();
          const number = Number.parseFloat(duration);
          return duration.endsWith('ms') ? number / 1000 : number;
        });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      expect(await readRouteMotionSeconds()).toBeGreaterThan(0.1);
      expect(await readSelectionMotionSeconds()).toBeGreaterThan(0.1);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await readRouteMotionSeconds()).toBeLessThan(0.005);
      expect(await readSelectionMotionSeconds()).toBeLessThan(0.005);
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      // On desktop, navigating between settings sections must keep the parent
      // navigator mounted. The former dashboard route.path key re-created it.
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/settings/appearance');
      const settingsNavigation = page
        .locator('nav')
        .filter({
          has: page.locator('a[href="/settings/general"]'),
        })
        .first();
      await expect(settingsNavigation).toBeVisible();
      await settingsNavigation.evaluate((node) => {
        node.dataset.kasanaNavPersist = 'true';
      });
      await settingsNavigation.locator('a[href="/settings/general"]').click();
      await expect(page).toHaveURL(/\/settings\/general(?:\?.*)?$/);
      await expect(page.locator('nav[data-kasana-nav-persist="true"]')).toBeVisible();

      // Switching the nested AI/Security tabs should not recreate their parent tab bar.
      // The child view is keyed independently from the persistent Settings shell.
      await page.goto('/settings/ai/features');
      const aiTabs = page.getByRole('tablist').filter({
        has: page.locator('a[href="/settings/ai/models"]'),
      });
      await expect(aiTabs).toBeVisible();
      await aiTabs.evaluate((node) => {
        node.dataset.kasanaTabsPersist = 'true';
      });
      const aiIndicator = aiTabs.getByTestId('kasana-active-tab-indicator');
      await expect(aiIndicator).toBeVisible();
      const aiIndicatorBefore = await aiIndicator.boundingBox();
      expect(aiIndicatorBefore?.width).toBeGreaterThan(0);
      await aiTabs.locator('a[href="/settings/ai/models"]').click();
      await expect(page).toHaveURL(/\/settings\/ai\/models(?:\?.*)?$/);
      await expect(page.locator('[role="tablist"][data-kasana-tabs-persist="true"]')).toBeVisible();
      // Verify physical position, not merely CSS class changes or selected tab text.
      await expect.poll(async () => (await aiIndicator.boundingBox())?.x).not.toBe(aiIndicatorBefore?.x);

      await page.goto('/settings/security/login-methods');
      const securityTabs = page.getByRole('tablist').filter({
        has: page.locator('a[href="/settings/security/sessions"]'),
      });
      await expect(securityTabs).toBeVisible();
      await securityTabs.evaluate((node) => {
        node.dataset.kasanaTabsPersist = 'true';
      });
      await securityTabs.locator('a[href="/settings/security/sessions"]').click();
      await expect(page).toHaveURL(/\/settings\/security\/sessions(?:\?.*)?$/);
      await expect(page.locator('[role="tablist"][data-kasana-tabs-persist="true"]')).toBeVisible();

      // The transaction form has a native date input plus a centered calendar dialog.
      // The nested dialog must fit the viewport, and the parent's save action
      // must remain visible outside the scrollable form region.
      await page.setViewportSize({ width: 1280, height: 680 });
      await page.goto('/dashboard');
      const addTransaction = page.getByRole('button', { name: /Transaksi Baru|New transaction/i }).first();
      await expect(addTransaction).toBeVisible();
      await addTransaction.click();
      const txDialog = page.getByRole('dialog').first();
      await expect(txDialog).toBeVisible();

      const manifestResponse = await page.request.get('/site.webmanifest');
      expect(manifestResponse.ok()).toBe(true);
      expect((await manifestResponse.json()).name).toBe(await page.title());

      const modeSelector = txDialog.getByTestId('transaction-type-switcher');
      const selectionIndicator = modeSelector.getByTestId('transaction-type-indicator');
      const oldIndicatorPosition = await selectionIndicator.boundingBox();
      await modeSelector.getByRole('button', { name: /Pemasukan|Income/i }).click();
      await expect.poll(async () => (await selectionIndicator.boundingBox())?.x).not.toBe(oldIndicatorPosition?.x);
      await modeSelector.getByRole('button', { name: /Pengeluaran|Expense/i }).click();

      // Revealing the multiple-account payment editor should be reversible.
      // No transaction is submitted during this visual interaction test.
      const multipleAccounts = txDialog.locator('[data-test="multi-account-toggle"]');
      await expect(multipleAccounts).toBeVisible();
      await multipleAccounts.click();
      await expect(multipleAccounts).toHaveCount(1);
      await expect(multipleAccounts).toHaveAttribute('aria-pressed', 'true');
      // An additional payment amount must not be editable before its account is chosen.
      const accountFirstGuard = txDialog.getByRole('button', {
        name: /Pilih rekening terlebih dahulu|Choose an account before/i,
      });
      await expect(accountFirstGuard).toBeVisible();
      await accountFirstGuard.click();
      await expect(
        txDialog.getByRole('status').filter({
          hasText: /Pilih rekening terlebih dahulu|Choose an account before/i,
        }),
      ).toBeVisible();
      // This warning is inline. Escape would intentionally close the parent transaction dialog.

      await multipleAccounts.click();
      await expect(multipleAccounts).toHaveCount(1);
      await expect(multipleAccounts).toHaveAttribute('aria-pressed', 'false');
      // UX25 #3: removing the payment legs must not autofocus the original
      // amount input, which would reopen a phone's virtual keyboard.
      await expect(txDialog.locator('input[inputmode="decimal"]').first()).not.toBeFocused();

      // Selecting and unselecting a tag are reversible form edits, not deletion:
      // neither should launch a destructive confirmation.
      const tagPickerTrigger = txDialog.getByTestId('tag-picker-trigger');
      await tagPickerTrigger.click();
      const tagPicker = page.getByTestId('tag-picker-dialog');
      await expect(tagPicker).toBeVisible();
      const existingTag = tagPicker.locator('button[aria-pressed]').first();
      if (await existingTag.count()) {
        const initial = await existingTag.getAttribute('aria-pressed');
        await existingTag.click();
        await expect(existingTag).toHaveAttribute('aria-pressed', initial === 'true' ? 'false' : 'true');
        await existingTag.click();
        await expect(existingTag).toHaveAttribute('aria-pressed', initial ?? 'false');
        await expect(page.getByRole('alertdialog')).toHaveCount(0);
      }
      await page.keyboard.press('Escape');

      // The unchecked left inset should match the checked right inset.
      const createAnotherSwitch = txDialog
        .locator('label')
        .filter({ hasText: /Buat lagi|Create more/i })
        .getByRole('switch');
      await expect(createAnotherSwitch).toBeVisible();
      const readSwitchInsets = () =>
        createAnotherSwitch.evaluate((element) => {
          const thumb = element.querySelector<HTMLElement>('span');
          if (!thumb) return null;
          const parent = element.getBoundingClientRect();
          const circle = thumb.getBoundingClientRect();
          return { left: circle.left - parent.left, right: parent.right - circle.right };
        });
      const offInset = await readSwitchInsets();
      expect(offInset).not.toBeNull();
      await createAnotherSwitch.click();
      await expect(createAnotherSwitch).toHaveAttribute('data-state', 'checked');
      // Off: thumb hugs left edge. On: it should hug right edge by the same margin.
      // Poll until the CSS thumb movement has settled.
      await expect
        .poll(async () => {
          const onInset = await readSwitchInsets();
          return offInset && onInset ? Math.abs(onInset.right - offInset.left) : 999;
        })
        .toBeLessThanOrEqual(2);
      await createAnotherSwitch.click();

      const saveTransaction = txDialog.getByRole('button', { name: /Buat transaksi|Create transaction/i });
      await expect(saveTransaction).toBeVisible();
      const footerBounds = await saveTransaction.boundingBox();
      const dialogBounds = await txDialog.boundingBox();
      expect(footerBounds).not.toBeNull();
      expect(dialogBounds).not.toBeNull();
      if (footerBounds && dialogBounds) {
        expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(dialogBounds.y + dialogBounds.height + 2);
      }
      await txDialog.getByTestId('date-field-calendar-trigger').first().click();
      const txDatePopover = page.getByTestId('transaction-date-dialog');
      await expect(txDatePopover).toBeVisible();
      const pickerBounds = await txDatePopover.boundingBox();
      expect(pickerBounds).not.toBeNull();
      if (pickerBounds) {
        // The picker is centered rather than squeezed into the field's remaining space.
        expect(Math.abs(pickerBounds.x + pickerBounds.width / 2 - 640)).toBeLessThan(18);
        expect(Math.abs(pickerBounds.y + pickerBounds.height / 2 - 340)).toBeLessThan(18);
        expect(pickerBounds.x).toBeGreaterThanOrEqual(-2);
        expect(pickerBounds.x + pickerBounds.width).toBeLessThanOrEqual(1282);
        expect(pickerBounds.y).toBeGreaterThanOrEqual(-2);
        expect(pickerBounds.y + pickerBounds.height).toBeLessThanOrEqual(682);
      }
      const unusedScroll = await txDatePopover.evaluate((element) => element.scrollHeight - element.clientHeight);
      expect(unusedScroll).toBeLessThanOrEqual(2);
      await page.keyboard.press('Escape');
      await expect(saveTransaction).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});
