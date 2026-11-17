import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('frontend access log never records raw URL query strings or Referer', () => {
  const config = readFileSync(path.join(root, 'packages/frontend/nginx.conf'), 'utf8');
  const format = config.match(/^\s*log_format\s+main\s+([\s\S]*?);/m)?.[1];
  assert.ok(format, 'Nginx main log_format must exist');
  assert.match(format, /\$request_method\b/);
  assert.match(format, /\$uri\b/);
  assert.match(format, /\$status\b/);
  assert.doesNotMatch(format, /\$(?:request(?:_uri)?|args|query_string|http_referer)\b/);
});

test('reset password responses suppress referrers even after SPA fallback', () => {
  const config = readFileSync(path.join(root, 'packages/frontend/nginx.conf'), 'utf8');
  assert.ok(config.includes('map $request_uri $lajur_referrer_policy {'));
  assert.ok(config.includes('"~^/reset-password(\\?|$)" "no-referrer";'));
  const policies = [...config.matchAll(/add_header Referrer-Policy ([^;]+);/g)].map((entry) => entry[1]);
  assert.ok(policies.length >= 3);
  assert.ok(policies.every((value) => value === '$lajur_referrer_policy always'),
    'Every Referrer-Policy header must use the route-specific map');
});
