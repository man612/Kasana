import { type APIRequestContext, type Locator, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

import {
  acceptShareInvitation,
  apiGet,
  apiPost,
  completeOnboarding,
  createAuthenticatedApiContext,
  createShareInvitation,
  extractId,
} from '../../helpers/api-client';
import { buildTestCredentials } from '../../helpers/test-setup';

const LONG_NAME = 'Kendaraan keluarga untuk perjalanan antarkota — Toyota Avanza Veloz Premium Demonstration Vehicle';
const LONG_TRIM = 'Premium touring edition — Paket keluarga ' + 'LongUnbrokenTrimIdentifier'.repeat(2);
const WIDTHS = [320, 360, 390, 430, 1280];
const VIEWPORT_HEIGHT = 844;
const MIN_TOUCH_TARGET = 44;
const GEOMETRY_TOLERANCE = 1;
const PURCHASE_PRICE = 20_000_000.5;
const LABELS = {
  id: {
    override: 'Timpa nilai',
    edit: 'Sunting',
    delete: 'Hapus kendaraan?',
    cancel: 'Batal',
    disclaimer: 'Ini bukan harga jual pasar terkini; kilometer kendaraan belum memengaruhi perhitungan.',
  },
  en: {
    override: 'Override value',
    edit: 'Edit',
    delete: 'Delete vehicle?',
    cancel: 'Cancel',
    disclaimer: 'This is not a live resale price; vehicle mileage does not currently affect the calculation.',
  },
};

type Rect = { x: number; y: number; width: number; height: number };
const overlapArea = ({ a, b }: { a: Rect; b: Rect }) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

const textRects = async ({ locator }: { locator: Locator }): Promise<Rect[]> =>
  locator.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return [...range.getClientRects()].map(({ x, y, width, height }) => ({ x, y, width, height }));
  });

let ownerApi: APIRequestContext;
let viewerApi: APIRequestContext;
let vehicleId: string;
let accountId: string;

test.describe('Vehicle header responsive geometry', () => {
  test.beforeAll(async ({ playwright }) => {
    const owner = buildTestCredentials({ prefix: 'vehicle-header-owner' });
    const viewer = buildTestCredentials({ prefix: 'vehicle-header-viewer' });
    ownerApi = await createAuthenticatedApiContext({ playwright, ...owner });
    viewerApi = await createAuthenticatedApiContext({ playwright, ...viewer });
    await completeOnboarding({ request: ownerApi, currencyCode: 'IDR' });
    await completeOnboarding({ request: viewerApi, currencyCode: 'IDR' });
    const created = await apiPost({
      request: ownerApi,
      path: '/api/v1/vehicles',
      data: {
        name: LONG_NAME,
        make: 'Toyota',
        model: 'Avanza Veloz',
        trim: LONG_TRIM,
        year: 2020,
        currencyCode: 'IDR',
        purchasePrice: PURCHASE_PRICE,
        purchaseDate: '2020-01-01',
        depreciationPreset: 'custom',
        customAnnualRatePct: 0,
        vehicleClass: 'sedan',
      },
    });
    vehicleId = extractId(created);
    accountId = created.response.accountId;
    expect(accountId).toMatch(/^[0-9a-f-]{36}$/i);
    const invitation = await createShareInvitation({
      request: ownerApi,
      inviteeEmail: viewer.email,
      resourceId: accountId,
      permission: 'read',
    });
    await acceptShareInvitation({ request: viewerApi, token: invitation.token });
    const accounts = await apiGet({ request: viewerApi, path: '/api/v1/accounts' });
    expect(accounts.response.find((account: { id: string }) => account.id === accountId).share).toMatchObject({
      isOwner: false,
      permission: 'read',
    });
    expect(extractId(await apiGet({ request: viewerApi, path: '/api/v1/vehicles/' + vehicleId }))).toBe(vehicleId);
  });

  test.afterAll(async () => {
    if (ownerApi && vehicleId) {
      const persisted = (await apiGet({ request: ownerApi, path: '/api/v1/vehicles/' + vehicleId })).response;
      expect(persisted).toMatchObject({ year: 2020, trim: LONG_TRIM, customAnnualRatePct: 0 });
      expect(persisted.account.currentBalance).toBe(PURCHASE_PRICE);
    }
    await ownerApi?.dispose();
    await viewerApi?.dispose();
  });

  for (const locale of ['id', 'en'] as const) {
    for (const role of ['owner', 'viewer'] as const) {
      for (const width of WIDTHS) {
        test(`${locale} ${role} ${width}px — normal and doubled text`, async ({ page }) => {
          test.setTimeout(90_000);
          await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
          await page.addInitScript(({ language }) => localStorage.setItem('preferred-locale', language), {
            language: locale,
          });
          // Temporary capture-only diagnostics for a browser regression where
          // an alert CANCEL unexpectedly precedes a vehicle DELETE request.
          // Never modify application events; retain original user interactions.
          await page.addInitScript(() => {
            const events: string[] = [];
            (window as Window & { __lajurVehicleDialogEvents?: string[] }).__lajurVehicleDialogEvents = events;
            const record = (event: Event) => {
              const target = event.target instanceof Element ? event.target.closest('button') : null;
              if (!target) return;
              const label = (target.getAttribute('aria-label') || target.textContent || '').trim().slice(0, 60);
              if (!target.closest('[role="alertdialog"]') && !/vehicle|kendaraan|Hapus|Delete|Cancel|Batal/i.test(label))
                return;
              events.push(
                `${Math.round(event.timeStamp)} ${event.type} ${label} detail=${event instanceof MouseEvent ? event.detail : '-'}`,
              );
              if (events.length > 80) events.shift();
            };
            for (const name of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'click']) {
              document.addEventListener(name, record, true);
            }
          });
          const api = role === 'owner' ? ownerApi : viewerApi;
          // This suite tests responsive geometry and dialog cancellation, NOT
          // destructive writes. Protect the shared beforeAll fixture: if a UI
          // regression accidentally submits DELETE, fail this test explicitly
          // without destroying the vehicle for subsequent viewport cases.
          const unexpectedDeletePhases: string[] = [];
          let interactionPhase = 'initial page load';
          if (role === 'owner') {
            await page.route('**/api/v1/vehicles/**', async (route) => {
              if (route.request().method() === 'DELETE') {
                unexpectedDeletePhases.push(interactionPhase);
                await route.fulfill({
                  status: 409,
                  contentType: 'application/json',
                  body: JSON.stringify({
                    status: 'error',
                    response: { message: 'Vehicle deletion blocked in UI geometry smoke test' },
                  }),
                });
              } else {
                await route.continue();
              }
            });
          }
          await page.context().addCookies((await api.storageState()).cookies);
          await page.goto('/accounts/vehicles/' + vehicleId);
          const heading = page.getByRole('heading', { name: LONG_NAME, exact: true });
          const hero = page.locator('section').filter({ has: heading }).first();
          const metadata = hero.locator('h1 + div');
          const disclaimer = hero.locator('p').filter({ hasText: LABELS[locale].disclaimer });
          await expect(heading).toBeVisible();
          await expect(metadata).toContainText(LONG_TRIM);
          await expect(disclaimer).toBeVisible();
          const initialFontSize = await page.evaluate(() =>
            Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
          );

          for (const scale of [1, 2]) {
            await page.evaluate(
              ({ fontSize }) => document.documentElement.style.setProperty('font-size', `${fontSize}px`, 'important'),
              {
                fontSize: initialFontSize * scale,
              },
            );
            // Resolved layout, rather than a screenshot taken during the route/resize transition.
            await heading.scrollIntoViewIfNeeded();
            await page.evaluate(
              () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
            );
            const card = await hero.boundingBox();
            const title = await heading.boundingBox();
            const details = await metadata.boundingBox();
            expect(card).not.toBeNull();
            expect(title).not.toBeNull();
            expect(details).not.toBeNull();
            const override = hero.getByRole('button', { name: LABELS[locale].override, exact: true });
            const edit = hero.getByRole('button', { name: LABELS[locale].edit, exact: true });
            const actions = role === 'owner' ? override.locator('..').getByRole('button') : hero.getByRole('button');
            const actionRects: Rect[] = [];
            if (role === 'owner') {
              await expect(actions).toHaveCount(3);
              for (const action of await actions.all()) {
                const rect = await action.boundingBox();
                expect(rect).not.toBeNull();
                actionRects.push(rect!);
              }
            }
            const geometry = {
              width,
              locale,
              role,
              scale,
              card,
              title,
              details,
              actionRects,
              rootFont: await page.evaluate(() => getComputedStyle(document.documentElement).fontSize),
              actionPosition:
                role === 'owner'
                  ? await override.locator('..').evaluate((element) => getComputedStyle(element).position)
                  : null,
            };
            const geometryPath = test.info().outputPath(`geometry-${scale}x.json`);
            await writeFile(geometryPath, JSON.stringify(geometry, null, 2));
            await test.info().attach(`geometry-${scale}x`, { path: geometryPath, contentType: 'application/json' });
            await page.screenshot({
              path: test.info().outputPath(`${locale}-${role}-${width}-${scale}x.png`),
              fullPage: true,
            });
            if (!card || !title || !details) throw new Error('Vehicle header must have measurable content');
            const viewportWidth = await page.evaluate(() => innerWidth);
            expect(card.x, 'Header card must not be clipped outside the viewport').toBeGreaterThanOrEqual(
              -GEOMETRY_TOLERANCE,
            );
            expect(card.x + card.width, 'Header card must fit the viewport').toBeLessThanOrEqual(
              viewportWidth + GEOMETRY_TOLERANCE,
            );
            expect(overlapArea({ a: title, b: details }), 'Title and metadata must not overlap').toBeLessThanOrEqual(
              GEOMETRY_TOLERANCE,
            );
            for (const rect of actionRects) {
              expect(overlapArea({ a: title, b: rect }), 'Owner action overlaps vehicle title').toBeLessThanOrEqual(
                GEOMETRY_TOLERANCE,
              );
              expect(
                overlapArea({ a: details, b: rect }),
                'Owner action overlaps vehicle metadata',
              ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
              expect(rect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
              expect(rect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
              expect(rect.x).toBeGreaterThanOrEqual(card.x - GEOMETRY_TOLERANCE);
              expect(rect.x + rect.width).toBeLessThanOrEqual(card.x + card.width + GEOMETRY_TOLERANCE);
              expect(rect.y).toBeGreaterThanOrEqual(card.y - GEOMETRY_TOLERANCE);
              expect(rect.y + rect.height).toBeLessThanOrEqual(card.y + card.height + GEOMETRY_TOLERANCE);
            }
            for (let index = 0; index < actionRects.length; index++) {
              for (const other of actionRects.slice(index + 1)) {
                expect(
                  overlapArea({ a: actionRects[index]!, b: other }),
                  'Owner actions must not overlap each other',
                ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
              }
            }
            for (const content of [heading, metadata, disclaimer]) {
              for (const line of await textRects({ locator: content })) {
                expect(line.x, 'Header text must remain inside its card').toBeGreaterThanOrEqual(
                  card.x - GEOMETRY_TOLERANCE,
                );
                expect(line.x + line.width, 'Header text must wrap without clipping').toBeLessThanOrEqual(
                  card.x + card.width + GEOMETRY_TOLERANCE,
                );
              }
            }
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
              'Page must not overflow horizontally',
            ).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
            await disclaimer.scrollIntoViewIfNeeded();
            await expect(disclaimer).toBeInViewport();

            if (role === 'owner') {
              const remove = hero.getByRole('button', { name: LABELS[locale].delete, exact: true });
              await expect(remove).toHaveCount(1);
              for (const action of [override, edit, remove]) {
                const actionName = action === remove ? 'delete' : action === edit ? 'edit' : 'override';
                interactionPhase = `${scale}x/${actionName}/activate`;
                await action.scrollIntoViewIfNeeded();
                await action.focus();
                await expect(action).toBeFocused();
                if (scale === 1) await action.click();
                else await page.keyboard.press('Enter');
                const dialog = page.locator('[role="dialog"], [role="alertdialog"]').last();
                await expect(dialog).toBeVisible();
                if (action === remove) {
                  expect(unexpectedDeletePhases, 'Opening a confirmation must not submit DELETE').toEqual([]);
                  interactionPhase = `${scale}x/delete/cancel-click`;
                  await dialog.getByRole('button', { name: LABELS[locale].cancel, exact: true }).click();
                  // Cancellation must be observable in the backend, not only
                  // through a disappearing alert dialog.
                  expect(extractId(await apiGet({
                    request: ownerApi,
                    path: '/api/v1/vehicles/' + vehicleId,
                  }))).toBe(vehicleId);
                } else await page.keyboard.press('Escape');
                await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
                const dialogEvents = await page.evaluate(
                  () => (window as Window & { __lajurVehicleDialogEvents?: string[] }).__lajurVehicleDialogEvents ?? [],
                );
                expect(
                  unexpectedDeletePhases,
                  `Unexpected vehicle DELETE during ${interactionPhase}; recent dialog events: ${dialogEvents.join(' | ')}`,
                ).toEqual([]);
              }
            } else {
              await expect(hero.getByRole('button')).toHaveCount(0);
              await expect(override).toHaveCount(0);
              await expect(edit).toHaveCount(0);
              await expect(hero.getByRole('button', { name: LABELS[locale].delete, exact: true })).toHaveCount(0);
            }
          }
          expect(unexpectedDeletePhases, 'Cancel must not dispatch a destructive vehicle DELETE').toEqual([]);
        });
      }
    }
  }
});
