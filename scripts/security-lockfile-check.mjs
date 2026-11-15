#!/usr/bin/env node
/** Selected advisory floors, not a full audit or a claim that Zod 3 is patched. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function atLeast({ version, minimum }) {
  // A prerelease is not evidence that the stable security patch is present.
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+[\w.-]+)?$/.exec(version ?? '');
  if (!match) return false;
  const actual = match.slice(1).map(Number);
  const floor = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] > floor[i]) return true;
    if (actual[i] < floor[i]) return false;
  }
  return true;
}

export function checkSecurityLockfiles({ main, docs, log = console.log }) {
  const errors = [];
  function check({ label, lock, suffix, byMajor }) {
    const packages = Object.entries(lock.packages || {}).filter(
      ([key]) => key === 'node_modules/' + suffix || key.endsWith('/node_modules/' + suffix),
    );
    if (!packages.length) errors.push(label + ': missing ' + suffix);
    for (const [key, item] of packages) {
      const major = Number(item.version?.split('.')[0]);
      const minimum = byMajor[major];
      if (!minimum) {
        log('REVIEW: ' + label + ' ' + key + '@' + item.version + ' major ' + major + ' not covered');
        continue;
      }
      const ok = atLeast({ version: item.version, minimum });
      log((ok ? 'OK: ' : 'FAIL: ') + label + ' ' + key + '@' + item.version + ' (minimum ' + minimum + ')');
      if (!ok) errors.push(label + ' ' + key + '@' + item.version + ' below ' + minimum);
    }
  }
  const rootCheck = ({ suffix, byMajor }) => check({ label: 'root', lock: main, suffix, byMajor });
  // Vendor advisory sources and compatibility-only family floors are recorded in
  // docs/security/2026-11-14-regression-repair.md; installed versions are not minima.
  rootCheck({ suffix: 'dompurify', byMajor: { 3: '3.4.17' } });
  rootCheck({ suffix: 'follow-redirects', byMajor: { 1: '1.16.2' } });
  rootCheck({ suffix: 'body-parser', byMajor: { 1: '1.20.9', 2: '2.4.0' } });
  rootCheck({ suffix: 'vue-i18n', byMajor: { 11: '11.4.14' } });
  for (const suffix of [
    '@intlify/core-base',
    '@intlify/shared',
    '@intlify/message-compiler',
    '@intlify/devtools-types',
  ]) {
    rootCheck({ suffix, byMajor: { 11: '11.4.14' } });
  }
  // GHSA-mqg3-3v4r-cm32 requires 7.30.2; 7.30.1 is affected.
  rootCheck({ suffix: 'undici', byMajor: { 6: '6.29.1', 7: '7.30.2', 8: '8.12.4' } });
  rootCheck({ suffix: 'zod', byMajor: { 4: '4.6.6' } });
  for (const [entry, item] of Object.entries(main.packages || {})) {
    if (entry.endsWith('/node_modules/zod') && item.version.startsWith('3.')) {
      log('UNRESOLVED: ' + entry + '@' + item.version + ' - Zod v3 alias requires separate migration review');
    }
  }
  check({ label: 'docs', lock: docs, suffix: 'undici', byMajor: { 8: '8.12.4' } });
  check({ label: 'docs', lock: docs, suffix: 'zod', byMajor: { 4: '4.6.6' } });
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const readLock = ({ file }) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  const errors = checkSecurityLockfiles({
    main: readLock({ file: 'package-lock.json' }),
    docs: readLock({ file: 'packages/docs/package-lock.json' }),
  });
  if (errors.length) {
    console.error('Outdated advisory-affected instances:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Selected advisory minima pass; other advisories still require a full npm audit.');
  }
}
