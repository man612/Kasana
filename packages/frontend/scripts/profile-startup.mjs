import { chromium, devices, request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

const base = new URL(process.env.LAJUR_PROFILE_ORIGIN ?? 'http://localhost:8851').origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('Use an isolated loopback frontend and synthetic API.');
}
const runName = process.argv[2] ?? 'baseline';
const seedMinimalFixture = async () => {
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  const email = `perf-${randomUUID()}@test.local`;
  const password = 'SyntheticAudit-123456!';

  async function send(method, path, data) {
    const response = await api.fetch(`/api/v1${path}`, { method, data });
    if (path === '/tests/verify-email' && response.status() === 404) return;
    if (!response.ok())
      throw new Error(`${method} ${path} HTTP ${response.status()}: ${(await response.text()).slice(0, 200)}`);
    return response.json();
  }
  await send('POST', '/auth/sign-up/email', { email, password, name: 'Audit sintetis' });
  await send('POST', '/tests/verify-email', { email });
  await send('POST', '/auth/sign-in/email', { email, password });
  await send('POST', '/user/currencies/base', { currencyCode: 'IDR' });
  await send('POST', '/user/currencies', { currencies: [{ currencyCode: 'IDR' }] });
  await send('PUT', '/user/settings/onboarding', { isDismissed: true, dismissedAt: new Date().toISOString() });
  const { response } = await send('POST', '/accounts', {
    name: 'Dompet audit',
    initialBalance: 1800000,
    creditLimit: 0,
    accountCategory: 'general',
    currencyCode: 'IDR',
  });
  const accountId = Array.isArray(response) ? response[0].id : response.id;
  const result = await send('GET', '/categories');
  const categories = result.response ?? result;
  for (let index = 0; index < 7; index++) {
    await send('POST', '/transactions', {
      accountId,
      categoryId: categories[0].id,
      amount: 25000 + index * 100,
      transactionType: 'expense',
      paymentType: 'creditCard',
      transferNature: 'not_transfer',
      time: new Date(Date.now() - index * 86400000).toISOString(),
      note: `Transaksi sintetis ${index + 1}`,
    });
  }
  const cookies = (await api.storageState()).cookies;
  await api.dispose();
  return cookies;
};
const fixtureState = process.env.LAJUR_AUDIT_STATE_PATH;
const cookies = fixtureState ? JSON.parse(await readFile(fixtureState, 'utf8')).cookies : await seedMinimalFixture();

for (let retry = 0; !(await fetch(`${base}/dashboard`)).ok; retry++) {
  if (retry >= 240) throw new Error('Dashboard build unavailable');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const profile = await mkdtemp('/tmp/lajur-perf-profile-');
const launch = () =>
  chromium.launchPersistentContext(profile, {
    ...devices['Pixel 7'],
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: ['--no-sandbox'],
    headless: true,
  });
const round = (value) => Math.round(value ?? 0);
let browser = await launch();
await browser.addCookies(cookies);
let page = browser.pages()[0];
const observe = () => {
  const stats = (window.__auditTiming = { lcp: 0, longTasks: 0, blocking: 0, cls: 0, shell: 0, trend: 0 });
  const targets = new MutationObserver(() => {
    if (!stats.shell && document.querySelector('[data-testid="dashboard-period-bar"]')) stats.shell = performance.now();
    if (!stats.trend && document.querySelector('[data-testid="balance-trend-sparkline"] svg'))
      stats.trend = performance.now();
  });
  targets.observe(document, { subtree: true, childList: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) stats.lcp = entry.startTime;
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      stats.longTasks++;
      stats.blocking += Math.max(0, entry.duration - 50);
    }
  }).observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) if (!entry.hadRecentInput) stats.cls += entry.value;
  }).observe({ type: 'layout-shift', buffered: true });
};

async function connect() {
  await page.addInitScript(observe);
  const cdp = await browser.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.LAJUR_PROFILE_CPU_RATE ?? 1) });
  const responses = new Map();
  let started = false;
  cdp.on('Network.requestWillBeSent', ({ requestId, request, timestamp }) => {
    if (started && request.url.startsWith(base))
      responses.set(requestId, { url: request.url, method: request.method, timestamp });
  });
  cdp.on('Network.responseReceived', ({ requestId, response }) => {
    const request = responses.get(requestId);
    if (request)
      Object.assign(request, {
        status: response.status,
        sw: !!response.fromServiceWorker,
        disk: !!response.fromDiskCache,
      });
  });
  cdp.on('Network.requestServedFromCache', ({ requestId }) => {
    const request = responses.get(requestId);
    if (request) request.memory = true;
  });
  cdp.on('Network.loadingFinished', ({ requestId, encodedDataLength, timestamp }) => {
    const request = responses.get(requestId);
    if (request)
      Object.assign(request, { bytes: encodedDataLength, ms: round((timestamp - request.timestamp) * 1000) });
  });
  return {
    cdp,
    responses,
    start() {
      responses.clear();
      started = true;
    },
    stop() {
      started = false;
    },
  };
}
let monitor = await connect();

async function measure(name, navigate, { failed = false, sameDocument = false } = {}) {
  const before = await monitor.cdp.send('Performance.getMetrics');
  process.stderr.write(`Profiling ${runName}: ${name}\n`);
  const start = Date.now();
  monitor.start();
  const navigation = await navigate();
  let ready = false;
  if (!failed) {
    ready = await page
      .locator('[data-testid="balance-trend-sparkline"] svg')
      .first()
      .waitFor({ timeout: 65_000 })
      .then(
        () => true,
        () => false,
      );
  } else {
    await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => {});
  }
  const elapsed = Date.now() - start;
  await page.waitForTimeout(failed ? 1200 : 3000);
  monitor.stop();
  const after = await monitor.cdp.send('Performance.getMetrics');
  const values = Object.fromEntries(after.metrics.map(({ name, value }) => [name, value]));
  const earlier = Object.fromEntries(before.metrics.map(({ name, value }) => [name, value]));
  const timings = await page
    .evaluate(async () => {
      const connection = navigator.serviceWorker?.controller?.scriptURL;
      const keys = await caches.keys();
      const cachedAssets = (
        await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).length))
      ).reduce((a, b) => a + b, 0);
      const persisted = await new Promise((resolve) => {
        const open = indexedDB.open('budget-tracker');
        open.onerror = () => resolve([]);
        open.onupgradeneeded = () => {
          open.transaction.abort();
          resolve([]);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('query-cache')) {
            db.close();
            resolve([]);
            return;
          }
          const read = db.transaction('query-cache', 'readonly').objectStore('query-cache').getAllKeys();
          read.onsuccess = () => {
            db.close();
            resolve(read.result);
          };
          read.onerror = () => {
            db.close();
            resolve([]);
          };
        };
      });
      return {
        ...window.__auditTiming,
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        controlled: Boolean(connection),
        cachedAssets,
        persisted,
        standalone: matchMedia('(display-mode: standalone)').matches,
        path: location.pathname,
        online: navigator.onLine,
        documentTitle: document.title,
        dark: document.documentElement.classList.contains('dark'),
        lang: document.documentElement.lang,
      };
    })
    .catch(() => ({}));
  const entries = [...monitor.responses.values()];
  const assets = entries.filter(({ url }) => new URL(url).pathname.startsWith('/assets/'));
  const optionalSdkAssets = assets.filter(({ url }) => /\/(?:posthog(?:-core)?|sentry)-/.test(url));
  const queries = entries.filter(({ url }) => new URL(url).pathname.startsWith('/api/'));
  const duplicates = Object.entries(
    Object.groupBy(queries, ({ method, url }) => `${method} ${url.slice(base.length)}`),
  ).flatMap(([key, values]) => (values.length > 1 ? [[key, values.length]] : []));
  const result = {
    runName,
    name,
    ready,
    status: navigation?.status?.(),
    elapsed,
    ...timings,
    ...(sameDocument && { fcp: undefined, lcp: undefined, shell: undefined, trend: undefined }),
    api: queries.length,
    requestList: queries.map(({ url, ms, status, bytes }) => [url.slice(base.length), status, ms, bytes]),
    duplicates,
    assetRequests: assets.length,
    assetFromSW: assets.filter(({ sw }) => sw).length,
    assetFromDisk: assets.filter(({ disk, sw, memory }) => disk && !sw && !memory).length,
    assetFromMemory: assets.filter(({ memory, sw }) => memory && !sw).length,
    sdkRequests: optionalSdkAssets.map(({ url, bytes }) => [new URL(url).pathname, bytes]),
    assetWire: assets.reduce((sum, { bytes }) => sum + (bytes ?? 0), 0),
    apiWire: queries.reduce((sum, { bytes }) => sum + (bytes ?? 0), 0),
    jsHeapMB: Math.round(values.JSHeapUsedSize / 1e6),
    layoutCount: values.LayoutCount - (earlier.LayoutCount ?? 0),
    scriptMs: round((values.ScriptDuration - (earlier.ScriptDuration ?? 0)) * 1000),
  };
  console.log(JSON.stringify(result));
}

const goto = () => page.goto(`${base}/dashboard`, { waitUntil: 'commit' });
try {
  await measure('cold', goto);
  await page
    .waitForFunction(async () => Boolean(await navigator.serviceWorker?.getRegistration()), {
      timeout: 10_000,
    })
    .catch(() => {});
  await measure('warm-1', () => page.reload({ waitUntil: 'commit' }));
  await measure('warm-2', () => page.reload({ waitUntil: 'commit' }));
  await measure('hard-refresh', async () => {
    const loaded = page.waitForEvent('domcontentloaded');
    await monitor.cdp.send('Page.reload', { ignoreCache: true });
    await loaded.catch(() => {});
  });
  const navLink = page.locator('a[href="/transactions"]:visible').last();
  if (await navLink.isVisible()) {
    await navLink.click();
    await page.waitForURL('**/transactions');
    await measure('revisit', () => page.locator('a[href="/dashboard"]:visible').last().click(), { sameDocument: true });
  }
  await browser.close();
  browser = await launch();
  page = browser.pages()[0];
  monitor = await connect();
  await measure('browser-reopen', goto);
  await monitor.cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 160,
    downloadThroughput: 200000,
    uploadThroughput: 75000,
  });
  await measure('slow-warm', () => page.reload({ waitUntil: 'commit' }));
  await monitor.cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await browser.setOffline(true);
  await measure('offline', () => page.reload({ waitUntil: 'commit' }), { failed: true });
  await browser.setOffline(false);
  await page.route('**/api/v1/auth/get-session', (route) =>
    route.fulfill({ status: 503, json: { message: 'Synthetic 503' } }),
  );
  await measure('api-503', goto, { failed: true });
} finally {
  await browser.close();
  await rm(profile, { force: true, recursive: true });
}
