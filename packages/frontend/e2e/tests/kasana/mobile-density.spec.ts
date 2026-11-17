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
      if (width <= 767) {
        const mobileEmailField = await page.locator('input[type="email"]').first().evaluate((node) => ({
          fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
          height: node.getBoundingClientRect().height,
        }));
        expect(mobileEmailField.fontSize, `mobile text field at ${width}px should not trigger iOS focus zoom`).toBeGreaterThanOrEqual(16);
        expect(mobileEmailField.height, `mobile touch field height at ${width}px`).toBeGreaterThanOrEqual(43);
      }
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

test.describe('iPhone viewport accessibility', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test('does not limit user pinch zoom to 100% after app initialization', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(?:\.0)?(?:,|\s|$)/);
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
  });
});
