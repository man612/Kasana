#!/usr/bin/env node
/**
 * Guard specific published November 2026 advisory fixes in npm lockfiles.
 * This is NOT a substitute for npm audit or an assertion that Zod 3 is patched.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const main = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const docs = JSON.parse(readFileSync(path.join(root, 'packages/docs/package-lock.json'), 'utf8'));
const errors = [];
function atLeast(version, minimum) {
  const a = version.split('-')[0].split('.').map(Number);
  const b = minimum.split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return true;
}
function check(label, lock, suffix, byMajor) {
  const packages = Object.entries(lock.packages || {})
    .filter(([key]) => key === 'node_modules/' + suffix || key.endsWith('/node_modules/' + suffix));
  if (!packages.length) errors.push(label + ': missing ' + suffix);
  for (const [key, item] of packages) {
    const major = Number(item.version.split('.')[0]);
    const minimum = byMajor[major];
    if (!minimum) {
      console.log('REVIEW: ' + label + ' ' + key + '@' + item.version + ' major ' + major + ' not covered');
      continue;
    }
    const ok = atLeast(item.version, minimum);
    console.log((ok ? 'OK: ' : 'FAIL: ') + label + ' ' + key + '@' + item.version + ' (minimum ' + minimum + ')');
    if (!ok) errors.push(label + ' ' + key + '@' + item.version + ' below ' + minimum);
  }
}
check('root', main, 'dompurify', { 3: '3.4.17' });
check('root', main, 'follow-redirects', { 1: '1.16.2' });
check('root', main, 'body-parser', { 1: '1.20.9', 2: '2.4.0' });
check('root', main, 'vue-i18n', { 11: '11.4.14' });
for (const name of ['@intlify/core-base', '@intlify/shared', '@intlify/message-compiler', '@intlify/devtools-types']) {
  check('root', main, name, { 11: '11.4.14' });
}
check('root', main, 'undici', { 6: '6.29.1', 7: '7.30.1', 8: '8.12.4' });
check('root', main, 'zod', { 4: '4.6.6' });
for (const [entry, item] of Object.entries(main.packages || {})) {
  if (entry.endsWith('/node_modules/zod') && item.version.startsWith('3.')) {
    console.log('UNRESOLVED: ' + entry + '@' + item.version + ' - Zod v3 alias requires separate migration review');
  }
}
check('docs', docs, 'undici', { 8: '8.12.4' });
check('docs', docs, 'zod', { 4: '4.6.6' });
if (errors.length) {
  console.error('Outdated advisory-affected instances:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Selected advisory minima pass; other advisories still require a full npm audit.');
}
