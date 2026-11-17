import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('private cache middleware is installed before auth and other API routes', () => {
  const source = read('packages/backend/src/setup-middleware.ts');
  assert.match(source, /app\.use\(privateApiCacheMiddleware\)/);
  assert.ok(
    source.indexOf('app.use(privateApiCacheMiddleware)') < source.indexOf('app.use(requestIdMiddleware)'),
    'Cache headers must be initialized before API/auth routing',
  );
});

test('authenticated financial attachment and image downloads never override no-store', () => {
  for (const path of [
    'packages/backend/src/controllers/attachments.controller.ts',
    'packages/backend/src/controllers/logo-images.controller.ts',
  ]) {
    const source = read(path);
    assert.match(source, /res\.setHeader\('Cache-Control', 'private, no-store'\)/, path);
    assert.doesNotMatch(source, /res\.setHeader\('Cache-Control', '[^']*(?:max-age|immutable|public)/, path);
  }
});

test('same-origin Nginx proxy does not turn on API response caching', () => {
  const entrypoint = read('self-hosting/frontend/docker-entrypoint.sh');
  assert.match(entrypoint, /location \/api\/ \{/);
  assert.match(entrypoint, /proxy_pass \$\{BACKEND_URL\};/);
  const block = entrypoint.match(/location \/api\/ \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.ok(block, 'Expected generated Nginx API proxy block');
  assert.doesNotMatch(block, /proxy_cache\s+(?!off\b)|proxy_ignore_headers|proxy_hide_header\s+Cache-Control/);
});
