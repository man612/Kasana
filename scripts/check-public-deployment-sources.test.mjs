import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  checkPublicDeploymentFiles,
  checkPublicDeploymentSources,
} from './check-public-deployment-env.mjs';

function validCompose() {
  return {
    NODE_ENV: 'production',
    AUTH_ORIGIN: 'https://finance.example.org',
    BETTER_AUTH_URL: 'https://finance.example.org',
    HTTP_PORT: '127.0.0.1:8080',
    API_HTTP: '',
    SYSTEM_MAX_SIGNUPS_ALLOWED: '0',
    APPLICATION_JWT_SECRET: 'a'.repeat(48),
    APP_SESSION_ID_SECRET: 'b'.repeat(48),
    BETTER_AUTH_SECRET: 'c'.repeat(48),
    APPLICATION_DB_HOST: 'db',
    APPLICATION_DB_PORT: '5432',
    APPLICATION_DB_USERNAME: 'lajur_synthetic',
    APPLICATION_DB_PASSWORD: 'd'.repeat(32),
    APPLICATION_DB_DATABASE: 'lajur_synthetic',
    APPLICATION_PORT: '8081',
    SYSTEM_DEMO_DISABLED: 'true',
    RESEND_API_KEY: 're_' + 'e'.repeat(40),
    RESEND_FROM_EMAIL: 'no-reply@mail.example.org',
    AUTH_RP_ID: 'example.org',
  };
}

test('accepts controlled private Compose sources with no Portainer overrides', () => {
  assert.deepEqual(checkPublicDeploymentSources({ composeEnv: validCompose() }), []);
});

test('stack.env can supply effective backend Resend settings; it cannot spoof host ports', () => {
  const base = validCompose();
  base.RESEND_API_KEY = '';
  base.RESEND_FROM_EMAIL = '';
  const stack = {
    RESEND_API_KEY: 're_' + 'g'.repeat(40),
    RESEND_FROM_EMAIL: 'no-reply@mail.example.org',
  };
  assert.deepEqual(checkPublicDeploymentSources({ composeEnv: base, stackEnv: stack }), []);
  const errors = checkPublicDeploymentSources({
    composeEnv: { ...base, HTTP_PORT: '0.0.0.0:8080' },
    stackEnv: { ...stack, HTTP_PORT: '127.0.0.1:8080' },
  });
  assert.ok(errors.some((e) => e.startsWith('HTTP_PORT:')));
});

test('last-file backend overrides are validated, not ignored', () => {
  for (const stackEnv of [
    { SYSTEM_MAX_SIGNUPS_ALLOWED: '' },
    { AUTH_ORIGIN: 'http://insecure.example.org' },
    { BETTER_AUTH_URL: 'https://attacker.example.org' },
    { NODE_ENV: 'development' },
    { AUTH_RP_ID: 'attacker.example.org' },
    { RESEND_API_KEY: '' },
    { RESEND_FROM_EMAIL: 'onboarding@resend.dev' },
    { BETTER_AUTH_SECRET: '__REPLACE_ME__' },
  ]) {
    assert.notEqual(checkPublicDeploymentSources({ composeEnv: validCompose(), stackEnv }).length, 0,
      'Override must not silently pass ' + Object.keys(stackEnv).join(','));
  }
});

test('database and backend listener mismatches across Compose and Portainer fail closed', () => {
  for (const key of [
    'APPLICATION_DB_HOST', 'APPLICATION_DB_PORT', 'APPLICATION_DB_USERNAME',
    'APPLICATION_DB_PASSWORD', 'APPLICATION_DB_DATABASE', 'APPLICATION_PORT',
  ]) {
    const stackValue = key === 'APPLICATION_DB_PASSWORD'
      ? 'SECRET_MARKER_NOT_TO_LOG_' + 'Q'.repeat(25) : 'changed-value';
    const errors = checkPublicDeploymentSources({
      composeEnv: validCompose(),
      stackEnv: { [key]: stackValue },
    });
    assert.ok(errors.some((e) => e.startsWith(key + ':')), key);
    assert.ok(!errors.join('\n').includes(stackValue), 'Never print a value for ' + key);
  }
});

test('missing Compose-side credentials, demo mode and unresolved placeholders are rejected', () => {
  const x = validCompose();
  delete x.APPLICATION_DB_USERNAME;
  x.SYSTEM_DEMO_DISABLED = 'false';
  x.RESEND_API_KEY = '$' + '{RESEND_API_KEY}';
  const errors = checkPublicDeploymentSources({ composeEnv: x });
  for (const key of ['APPLICATION_DB_USERNAME:', 'SYSTEM_DEMO_DISABLED:', 'RESEND_API_KEY:']) {
    assert.ok(errors.some((e) => e.startsWith(key)), key);
  }
});

test('reads optional stack.env next to .env without calling Docker or printing secrets', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'lajur-public-config-'));
  try {
    const toEnv = (object) =>
      Object.entries(object).map(([key, value]) => key + '=' + value).join('\n') + '\n';
    const file = path.join(directory, '.env');
    writeFileSync(file, toEnv(validCompose()), { mode: 0o600 });
    assert.deepEqual(checkPublicDeploymentFiles(file), []);

    writeFileSync(path.join(directory, 'stack.env'), 'SYSTEM_MAX_SIGNUPS_ALLOWED=\n', { mode: 0o600 });
    const errors = checkPublicDeploymentFiles(file);
    assert.ok(errors.some((e) => e.startsWith('SYSTEM_MAX_SIGNUPS_ALLOWED:')));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
