import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPublicDeploymentEnv } from './check-public-deployment-env.mjs';

const valid = () => ({
  NODE_ENV: 'production',
  AUTH_ORIGIN: 'https://finance.example.org',
  BETTER_AUTH_URL: 'https://finance.example.org',
  HTTP_PORT: '127.0.0.1:8080',
  SYSTEM_MAX_SIGNUPS_ALLOWED: '0',
  APPLICATION_JWT_SECRET: 'a'.repeat(48),
  APP_SESSION_ID_SECRET: 'b'.repeat(48),
  BETTER_AUTH_SECRET: 'c'.repeat(48),
  APPLICATION_DB_PASSWORD: 'd'.repeat(32),
  RESEND_API_KEY: 're_' + 'e'.repeat(40),
  RESEND_FROM_EMAIL: 'no-reply@mail.example.org',
  AUTH_RP_ID: 'example.org',
});

test('public preflight accepts controlled staging shape without touching the network', () => {
  assert.deepEqual(checkPublicDeploymentEnv(valid()), []);
  assert.deepEqual(checkPublicDeploymentEnv({ ...valid(), SYSTEM_MAX_SIGNUPS_ALLOWED: '12' }), []);
});

test('missing/invalid signup cap never silently passes public preflight', () => {
  for (const raw of [undefined, '', 'NaN', 'Infinity', '-1', '1.2', '99999999999999999999']) {
    const errors = checkPublicDeploymentEnv({ ...valid(), SYSTEM_MAX_SIGNUPS_ALLOWED: raw });
    assert.ok(errors.some((msg) => msg.startsWith('SYSTEM_MAX_SIGNUPS_ALLOWED:')), String(raw));
  }
});

test('refuses local HTTP, split domains, exposed port or wrong WebAuthn domain', () => {
  for (const override of [
    { AUTH_ORIGIN: 'http://finance.example.org' },
    { BETTER_AUTH_URL: 'https://other.example.org' },
    { HTTP_PORT: '8080' },
    { HTTP_PORT: '0.0.0.0:8080' },
    { API_HTTP: 'https://api.example.org' },
    { AUTH_RP_ID: 'attacker.example.org' },
  ]) {
    assert.notEqual(checkPublicDeploymentEnv({ ...valid(), ...override }).length, 0);
  }
});

test('rejects missing sender, missing Resend key, default placeholders and duplicate auth keys', () => {
  const values = [
    { RESEND_API_KEY: '' },
    { RESEND_FROM_EMAIL: 'onboarding@resend.dev' },
    { APPLICATION_JWT_SECRET: '__REPLACE_ME__' },
    { APP_SESSION_ID_SECRET: 'a'.repeat(48) },
  ];
  for (const override of values) {
    assert.notEqual(checkPublicDeploymentEnv({ ...valid(), ...override }).length, 0);
  }
});

test('messages never print raw secrets or request provider connections', () => {
  const raw = 're_QUIET_TEST_PRIVATE_VALUE_MARKER_1234567890';
  const env = { ...valid(), RESEND_API_KEY: raw, BETTER_AUTH_URL: 'http://localhost:8080' };
  const errors = checkPublicDeploymentEnv(env).join('\n');
  assert.ok(errors.includes('BETTER_AUTH_URL'));
  assert.ok(!errors.includes(raw));
  assert.ok(!errors.includes(env.APPLICATION_DB_PASSWORD));
});
