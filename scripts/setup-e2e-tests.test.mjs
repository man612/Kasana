import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../packages/backend/src/tests/setup-e2e-tests.sh', import.meta.url));
function runHarness({ testExit = 0, startExit = 0 }) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lajur26-harness-'));
  const bin = path.join(root, 'bin');
  const cwd = path.join(root, 'packages/backend');
  mkdirSync(bin);
  mkdirSync(cwd, { recursive: true });
  writeFileSync(
    path.join(root, '.env.test'),
    'APPLICATION_DB_USERNAME=test\nAPPLICATION_DB_DATABASE=synthetic\nJEST_WORKERS_AMOUNT=1\n',
  );
  // Every Docker call is intercepted. No container, network, or database exists.
  writeFileSync(
    path.join(bin, 'docker'),
    `#!/bin/bash
case "$*" in
  *" up "*) exit "$MOCK_START_EXIT" ;;
  *" npx jest "*) exit "$MOCK_TEST_EXIT" ;;
  *"pg_stat_activity"*) echo 0 ;;
  *"ExchangeRates"*) echo 25281 ;;
esac
exit 0
`,
    { mode: 0o755 },
  );
  try {
    return spawnSync('bash', [script], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: bin + path.delimiter + process.env.PATH,
        CI: '1',
        TEST_RUNNER_IMAGE: 'synthetic',
        MOCK_TEST_EXIT: String(testExit),
        MOCK_START_EXIT: String(startExit),
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const testExit of [0, 1, 2, 134, 137]) {
  test(`the isolated harness reports and preserves runner exit ${testExit}`, () => {
    const result = runHarness({ testExit });
    assert.equal(result.error, undefined);
    assert.equal(result.status, testExit);
    if (testExit === 0) assert.match(result.stdout, /Tests passed successfully/);
    else {
      assert.match(result.stderr, new RegExp(`ERROR: Tests failed \\(exit ${testExit}\\)`));
      assert.doesNotMatch(result.stdout, /Tests passed successfully/);
    }
  });
}

test('a failed startup stops before health checks, migrations or tests', () => {
  const result = runHarness({ startExit: 17 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Cannot start isolated test services/);
  assert.doesNotMatch(result.stdout, /Waiting for Postgres|Running tests|migrations/);
});
