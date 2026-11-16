import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { checkSecurityLockfiles } from './security-lockfile-check.mjs';

const main = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const docs = JSON.parse(readFileSync(new URL('../packages/docs/package-lock.json', import.meta.url), 'utf8'));
const audit = (locks) => checkSecurityLockfiles({ ...locks, log: () => {} });

test('the committed patched root and docs lockfiles meet the selected floors', () => {
  assert.deepEqual(audit({ main, docs }), []);
});

for (const version of ['7.30.1', '7.30.0', '7.30.2-rc.1']) {
  test(`rejects Undici ${version} in each root 7.x dependency location`, () => {
    const paths = Object.entries(main.packages)
      .filter(([key, item]) => key.endsWith('/undici') && item.version?.startsWith('7.'))
      .map(([key]) => key);
    assert.ok(paths.length > 0, 'the fixture must exercise a real Undici 7 lockfile entry');
    for (const key of paths) {
      const mutated = structuredClone(main);
      mutated.packages[key].version = version;
      assert.deepEqual(audit({ main: mutated, docs }), [`root ${key}@${version} below 7.30.2`]);
    }
  });
}

test('accepts the exact Undici 7.30.2 vendor floor', () => {
  const mutated = structuredClone(main);
  for (const [key, item] of Object.entries(mutated.packages)) {
    if (key.endsWith('/undici') && item.version?.startsWith('7.')) item.version = '7.30.2';
  }
  assert.deepEqual(audit({ main: mutated, docs }), []);
});

test('checks nested docs dependencies independently of the root', () => {
  const mutated = structuredClone(docs);
  const key = Object.keys(mutated.packages).find((entry) => entry.endsWith('/undici'));
  assert.ok(key);
  mutated.packages[key].version = '8.12.3';
  assert.deepEqual(audit({ main, docs: mutated }), [`docs ${key}@8.12.3 below 8.12.4`]);
});

for (const version of ['0.2.2', '0.4.3', '0.5.0']) {
  test(`rejects advisory-affected decoder ${version}`, () => {
    const mutated = structuredClone(main);
    const key = Object.keys(mutated.packages).find((entry) => entry.endsWith('/decode-uri-component'));
    assert.ok(key);
    mutated.packages[key].version = version;
    assert.deepEqual(audit({ main: mutated, docs }), [`root ${key}@${version} below 0.5.1`]);
  });
}

test('rejects reintroduced Zod 3 and retains explicit reporting of unreviewed majors', () => {
  const mutated = structuredClone(main);
  mutated.packages['node_modules/legacy-provider/node_modules/zod'] = { version: '3.25.76' };
  mutated.packages['node_modules/future-provider/node_modules/zod'] = { version: '99.0.0' };
  const messages = [];
  assert.deepEqual(checkSecurityLockfiles({ main: mutated, docs, log: (message) => messages.push(message) }), [
    'root node_modules/legacy-provider/node_modules/zod@3.25.76 below 4.6.6',
  ]);
  assert.ok(messages.some((message) => message.startsWith('UNRESOLVED: ') && message.includes('Zod v3')));
  assert.ok(messages.some((message) => message.startsWith('REVIEW: ') && message.includes('not covered')));
});

for (const [suffix, version, minimum] of [
  ['hono', '4.13.15', '4.13.16'],
  ['@hono/node-server', '1.19.18', '1.19.19'],
  ['@hono/node-server', '2.1.2', '2.1.3'],
  ['fast-uri', '3.1.8', '3.1.9'],
  ['ip-address', '10.7.3', '10.7.4'],
  ['qs', '6.16.0', '6.16.1'],
]) {
  test(`rejects advisory-affected ${suffix}@${version}`, () => {
    const mutated = structuredClone(main);
    const key = `node_modules/${suffix}`;
    assert.ok(mutated.packages[key]);
    mutated.packages[key].version = version;
    assert.deepEqual(audit({ main: mutated, docs }), [`root ${key}@${version} below ${minimum}`]);
  });
}
