import { expect, test } from '@playwright/test';

/** CSS viewport breakpoints must agree with CUSTOM_BREAKPOINTS.uiMobile (767px).
 * Emulate both narrow Android viewports and desktop widths without CSS zoom.
 */
test.describe('Mobile-first UI density and readable auth forms', () => {
  test('uses full native text density through 767px and keeps 80% on wider screens', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('form').first()).toBeVisible();

    for (const width of [320, 375, 390, 430, 767, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width < 768 ? 720 : 800 });
      const dimensions = await page.evaluate(() => ({
        fontSize: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        scaleToken: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kasana-ui-scale')),
        rootZoom: getComputedStyle(document.documentElement).zoom,
        horizontalOverflow: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth,
      }));

      const expectedScale = width <= 767 ? 1 : 0.8;
      expect(dimensions.scaleToken, `density CSS variable at width ${width}`).toBe(expectedScale);
      expect(dimensions.fontSize, `root font size at width ${width}`).toBeCloseTo(16 * expectedScale, 1);
      expect(Number(dimensions.rootZoom), `root CSS zoom must remain disabled at ${width}px`).toBe(1);
      expect(dimensions.horizontalOverflow, `no page-wide horizontal scrolling at ${width}px`).toBeLessThanOrEqual(2);
    }
  });

  for (const path of ['/sign-in', '/sign-up']) {
    test(`${path} remains readable and scrollable on a short 320px phone`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(path);

      const form = page.locator('form').first();
      await expect(form).toBeVisible();

      const heading = form.locator('h1').first();
      const submit = form.locator('button[type="submit"]').first();
      await expect(heading).toBeVisible();
      await expect(submit).toBeVisible();

      // Larger font/spacing may make the auth card taller than the visual viewport.
      // Both ends must remain physically reachable by scrolling the form viewport.
      await submit.scrollIntoViewIfNeeded();
      await expect.poll(async () => (await submit.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(0);
      const submitBounds = await submit.boundingBox();
      expect(submitBounds).not.toBeNull();
      expect(submitBounds!.y + submitBounds!.height, 'submit must fit in the visible viewport').toBeLessThanOrEqual(570);

      await heading.scrollIntoViewIfNeeded();
      const headingBounds = await heading.boundingBox();
      expect(headingBounds).not.toBeNull();
      expect(headingBounds!.y, 'heading must be reachable above the fold').toBeGreaterThanOrEqual(0);
      expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(570);
    });
  }
});
