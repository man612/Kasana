import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve('@modelcontextprotocol/sdk/server/mcp.js'));
const { Hono } = sdkRequire('hono');
const { serve } = sdkRequire('@hono/node-server');
const ajvRequire = createRequire(sdkRequire.resolve('ajv'));
const uri = ajvRequire('fast-uri');
const { AjvJsonSchemaValidator } = sdkRequire('../validation/ajv-provider.js');
const rateLimitRequire = createRequire(sdkRequire.resolve('express-rate-limit'));
const { Address6 } = rateLimitRequire('ip-address');
const expressRequire = createRequire(require.resolve('express'));
const qs = expressRequire('qs');

test('Hono wildcard authorization covers broader routes and encoded line terminators', async () => {
  const app = new Hono();
  app.use('/admin/*', (context) => context.text('Unauthorized', 401));
  app.get('/admin*', (context) => context.text('private'));
  app.get('/public', (context) => context.text('public'));
  for (const pathname of ['/admin/profile', '/admin/%0Aprofile', '/admin/%E2%80%A8profile']) {
    assert.equal((await app.request('http://localhost' + pathname)).status, 401, pathname);
  }
  assert.equal((await app.request('http://localhost/public')).status, 200);
});

test('the SDK-supported Node adapter serves requests and retains authorization', async () => {
  const app = new Hono();
  app.use('/private/*', (context) => context.text('Unauthorized', 401));
  app.get('/private/*', (context) => context.text('private'));
  app.get('/health', (context) => context.json({ ok: true }));
  const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
  try {
    if (!server.listening) await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await (await fetch(url + '/health')).json(), { ok: true });
    assert.equal((await fetch(url + '/private/secret')).status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('URI normalization does not activate encoded schemes; MCP JSON-schema references still validate', () => {
  for (const input of ['%6Aavascript:alert(1)', '%u006Aavascript:alert(1)']) {
    assert.notEqual(uri.parse(input).scheme, 'javascript');
    assert.throws(() => uri.resolve('https://safe.example/', input), /scheme is malformed/);
  }
  assert.equal(uri.resolve('https://safe.example/a/', '../b'), 'https://safe.example/b');
  const validator = new AjvJsonSchemaValidator().getValidator({
    type: 'object',
    properties: { amount: { $ref: '#/$defs/amount' } },
    required: ['amount'],
    additionalProperties: false,
    $defs: { amount: { type: 'number' } },
  });
  assert.equal(validator({ amount: 20000.5 }).valid, true);
  assert.equal(validator({ amount: '20000.5' }).valid, false);
  assert.equal(validator({}).valid, false);
});

test('the rate-limiter IPv6 dependency rejects the advisory payload and preserves normal addresses', () => {
  assert.equal(Address6.isValid('%'.repeat(100_000) + '\n'), false);
  assert.equal(Address6.isValid('2001:db8::1'), true);
  assert.equal(new Address6('2001:db8::1').correctForm(), '2001:db8::1');
});

test('Express query dependency handles hostile comma arrays without throwing', () => {
  const payload = JSON.parse('{"a":[{"toString":"x"}]}');
  for (const encodeValuesOnly of [false, true]) {
    assert.doesNotThrow(() => qs.stringify(payload, { arrayFormat: 'comma', encodeValuesOnly }));
  }
  assert.deepEqual(qs.parse('currency=IDR&amount=20000.5'), { currency: 'IDR', amount: '20000.5' });
  assert.equal(qs.stringify({ a: [1, 2] }, { arrayFormat: 'comma' }), 'a=1%2C2');
});
