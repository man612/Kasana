import { type Locator, chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  apiGet,
  completeOnboarding,
  createAuthenticatedApiContext,
  createVehicle,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

const AMOUNTS = [20_000_000.5, 9_876_543_210.25, -9_876_543.21, 0, 0.01, -0.01];
const WIDTHS = [390, 320, 1280];
const TOLERANCE = 1;

const readCharacters = async ({ amount }: { amount: Locator }) =>
  amount.evaluate((element) => {
    const visual = element.querySelector('[data-amount-visual]') ?? element;
    const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT);
    const characters: { value: string; x: number; y: number; width: number; height: number }[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode;
      for (let index = 0; index < (text.textContent?.length ?? 0); index++) {
        const range = document.createRange();
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        const { x, y, width, height } = range.getBoundingClientRect();
        characters.push({ value: text.textContent![index]!, x, y, width, height });
      }
    }
    return characters;
  });

const checkLegibility = async ({ amount }: { amount: Locator }) => {
  const characters = await readCharacters({ amount });
  const text = characters
    .map((part) => part.value)
    .join('')
    .trim();
  const viewport = await amount.page().evaluate(() => innerWidth);
  const clip = await amount.evaluate((element) => {
    let left = 0;
    let right = innerWidth;
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).overflowX !== 'visible') {
        const rectangle = ancestor.getBoundingClientRect();
        left = Math.max(left, rectangle.left);
        right = Math.min(right, rectangle.right);
      }
    }
    return { left, right };
  });
  for (const character of characters.filter((part) => /\S/u.test(part.value))) {
    expect(character.width, 'Every financial character must be rendered').toBeGreaterThan(0);
    expect(character.x, 'Financial characters must not be clipped left').toBeGreaterThanOrEqual(-TOLERANCE);
    expect(character.x + character.width, 'Financial characters must not be clipped right').toBeLessThanOrEqual(
      viewport + TOLERANCE,
    );
    expect(character.x, 'Financial characters must survive ancestor clipping').toBeGreaterThanOrEqual(
      clip.left - TOLERANCE,
    );
    expect(character.x + character.width, 'Financial characters must survive ancestor clipping').toBeLessThanOrEqual(
      clip.right + TOLERANCE,
    );
  }
  // Every uninterrupted digit group must stay on one line; a decimal tail
  // stays attached to the last integer group rather than becoming a new value.
  const offset = characters
    .map((part) => part.value)
    .join('')
    .indexOf(text);
  for (const group of text.matchAll(/\d+(?:,\d{1,2})?/g)) {
    const digits = characters.slice(offset + group.index, offset + group.index + group[0].length);
    expect(
      Math.max(...digits.map((part) => part.y)) - Math.min(...digits.map((part) => part.y)),
      'An amount digit group or decimal tail split across lines',
    ).toBeLessThanOrEqual(TOLERANCE);
  }
  return text;
};

const checkPercentage = async ({ percentage }: { percentage: Locator }) => {
  await checkLegibility({ amount: percentage });
  const characters = (await readCharacters({ amount: percentage })).filter((part) => /\S/u.test(part.value));
  expect(
    Math.max(...characters.map((part) => part.y)) - Math.min(...characters.map((part) => part.y)),
    'Keep the percentage together when its amount moves to another line',
  ).toBeLessThanOrEqual(TOLERANCE);
};

for (const currency of ['IDR', 'USD']) {
  test.describe(`${currency} vehicle amount presentation`, () => {
    let vehicleId: string;
    let api: Awaited<ReturnType<typeof createAuthenticatedApiContext>>;
    test.beforeAll(async ({ playwright }) => {
      api = await createAuthenticatedApiContext({
        playwright,
        ...buildTestCredentials({ prefix: `amount-${currency.toLowerCase()}` }),
      });
      await completeOnboarding({ request: api, currencyCode: currency });
      vehicleId = extractId(
        await createVehicle({
          request: api,
          name: 'Amount readability',
          currencyCode: currency,
          purchasePrice: 20_000_000.5,
        }),
      );
    });
    test.afterAll(async () => {
      if (api && vehicleId) {
        const stored = (await apiGet({ request: api, path: '/api/v1/vehicles/' + vehicleId })).response;
        expect(stored.purchasePrice).toBe(20_000_000.5);
        expect(stored.account.currentBalance).toBe(20_000_000.5);
      }
      await api?.dispose();
    });
    for (const value of AMOUNTS) {
      test(`full value ${value} remains legible`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.context().addCookies((await api.storageState()).cookies);
        // Display-only response fixtures include negative/zero/large balances;
        // they do not alter stored values or assert negative vehicle-value support.
        await page.route('**/api/v1/vehicles/' + vehicleId, async (route) => {
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          const body = await response.json();
          body.response.account.currentBalance = value;
          await route.fulfill({ response, json: body });
        });
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto('/accounts/vehicles/' + vehicleId);
          const hero = page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: 'Amount readability', exact: true }) })
            .first();
          const amount = hero.locator('.text-3xl').first();
          await expect(amount).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const initialFont = await page.evaluate(() =>
            Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
          );
          const expected = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency,
            minimumFractionDigits: currency === 'IDR' ? 0 : 2,
            maximumFractionDigits: 2,
          }).format(value || 0);
          for (const scale of [1, 2]) {
            await page.evaluate(
              ({ size }) => document.documentElement.style.setProperty('font-size', `${size}px`, 'important'),
              { size: initialFont * scale },
            );
            await page.evaluate(
              () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
            );
            await amount.scrollIntoViewIfNeeded();
            await page.screenshot({
              path: test.info().outputPath(`${currency}-${value}-${width}-${scale}x.png`),
              fullPage: true,
            });
            expect(await checkLegibility({ amount })).toBe(expected);
            const visual = amount.locator('[data-amount-visual]');
            await expect(visual).toHaveAttribute('aria-hidden', 'true');
            await expect(amount.locator('.sr-only')).toHaveText(expected);
            await checkPercentage({ percentage: hero.locator('span.inline-flex > span.font-normal') });
            // Purchase, depreciation and five-year projection cards use the same
            // presentation contract while keeping their own calculated values.
            const cards = page.getByTestId('vehicle-kpi-money');
            await expect(cards).toHaveCount(3);
            for (const card of await cards.all()) {
              await checkLegibility({ amount: card });
            }
            await checkPercentage({ percentage: page.getByTestId('vehicle-kpi-percentage') });
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
              TOLERANCE,
            );
          }
        }
      });
    }
    test.describe('native browser zoom', () => {
      for (const width of [320, 390]) {
        test(`native 200% browser zoom at ${width}px preserves every amount`, async () => {
          test.setTimeout(120_000);
          // A fresh, task-owned browser profile keeps the user's zoom settings intact.
          const profile = await mkdtemp(join(tmpdir(), 'lajur-amount-zoom-'));
          const launchOptions = test.info().project.use.launchOptions;
          const context = await chromium.launchPersistentContext(profile, {
            ...launchOptions,
            // Native settings need full Chromium rather than its headless-shell binary.
            channel: 'chromium',
            headless: true,
            viewport: null,
            // Explicit presence prevents Playwright injecting its device preset's DPR.
            deviceScaleFactor: undefined,
            baseURL: test.info().project.use.baseURL,
            args: [...(launchOptions?.args ?? []), `--window-size=${width * 2},1688`, '--force-device-scale-factor=1'],
          });
          try {
            await context.addCookies((await api.storageState()).cookies);
            const page = context.pages()[0] ?? (await context.newPage());
            let value = AMOUNTS[0]!;
            await page.route('**/api/v1/vehicles/' + vehicleId, async (route) => {
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              const body = await response.json();
              body.response.account.currentBalance = value;
              await route.fulfill({ response, json: body });
            });
            await page.goto('/accounts/vehicles/' + vehicleId);
            const hero = page
              .locator('section')
              .filter({ has: page.getByRole('heading', { name: 'Amount readability', exact: true }) })
              .first();
            const amount = hero.locator('.text-3xl').first();
            await expect(amount).toBeVisible();
            const metrics = () =>
              page.evaluate(() => ({
                innerWidth,
                outerWidth,
                devicePixelRatio,
                visualViewportScale: visualViewport?.scale,
                cssZoom: getComputedStyle(document.documentElement).zoom,
                rootFont: getComputedStyle(document.documentElement).fontSize,
              }));
            const before = await metrics();
            const settings = await context.newPage();
            await settings.goto('chrome://settings/appearance');
            await settings.locator('#zoomLevel').selectOption('2');
            await page.bringToFront();
            await expect.poll(async () => (await metrics()).devicePixelRatio).toBe(2 * before.devicePixelRatio);
            const after = await metrics();
            expect(after.innerWidth).toBe(width);
            expect(after.outerWidth).toBe(before.outerWidth);
            expect(after.cssZoom).toBe('1');
            expect(after.visualViewportScale).toBe(1);
            // At 200% browser zoom, 780px becomes 390 CSS px, crossing our
            // 768px density breakpoint. Native zoom must be allowed to switch
            // from dense desktop typography (12.8px) to readable mobile (16px),
            // rather than requiring a fixed root font-size across the resize.
            const expectedRootFont = (cssWidth: number) => (cssWidth <= 767 ? 16 : 12.8);
            expect(Number.parseFloat(before.rootFont), 'initial responsive rem baseline').toBeCloseTo(
              expectedRootFont(before.innerWidth),
              1,
            );
            expect(Number.parseFloat(after.rootFont), 'native zoom responsive rem baseline').toBeCloseTo(
              expectedRootFont(after.innerWidth),
              1,
            );
            await writeFile(test.info().outputPath('native-zoom.json'), JSON.stringify({ before, after }, null, 2));
            const session = await context.newCDPSession(page);
            const capture = async ({ name }: { name: string }) => {
              // Playwright's CSS-pixel clip crops a natively zoomed window. Capture
              // its complete compositor surface without changing viewport metrics.
              const screenshot = await session.send('Page.captureScreenshot', {
                format: 'png',
                captureBeyondViewport: false,
              });
              const png = Buffer.from(screenshot.data, 'base64');
              expect(png.readUInt32BE(16), 'Capture the complete zoomed window width').toBe(
                after.innerWidth * after.devicePixelRatio,
              );
              await writeFile(test.info().outputPath(name), png);
            };
            for (value of AMOUNTS) {
              await page.reload();
              await expect(amount).toBeVisible();
              await page.evaluate(() => document.fonts.ready);
              const expected = new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency,
                minimumFractionDigits: currency === 'IDR' ? 0 : 2,
                maximumFractionDigits: 2,
              }).format(value || 0);
              expect(await checkLegibility({ amount })).toBe(expected);
              await expect(amount.locator('.sr-only')).toHaveText(expected);
              await checkPercentage({ percentage: hero.locator('span.inline-flex > span.font-normal') });
              const cards = page.getByTestId('vehicle-kpi-money');
              await expect(cards).toHaveCount(3);
              for (const card of await cards.all()) {
                await checkLegibility({ amount: card });
              }
              await checkPercentage({ percentage: page.getByTestId('vehicle-kpi-percentage') });
              expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(
                TOLERANCE,
              );
              await capture({ name: `${currency}-${value}-native-200.png` });
              await cards.first().scrollIntoViewIfNeeded();
              await capture({ name: `${currency}-${value}-kpi-native-200.png` });
            }
          } finally {
            await context.close();
            await rm(profile, { recursive: true, force: true });
          }
        });
      }
    });
  });
}
