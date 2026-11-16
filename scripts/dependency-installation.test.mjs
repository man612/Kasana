import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture({ backend = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lajur-install-test-'));
  for (const name of ['patches', 'scripts', 'node_modules/.bin', 'node_modules/fixture-ui']) {
    fs.mkdirSync(path.join(dir, name), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"synthetic-install","private":true}');
  fs.copyFileSync(path.join(root, 'post-install.sh'), path.join(dir, 'post-install.sh'));
  const guard = 'scripts/check-provider-runtime.cjs';
  if (fs.existsSync(path.join(root, guard))) fs.copyFileSync(path.join(root, guard), path.join(dir, guard));
  fs.symlinkSync(
    path.join(root, 'node_modules/patch-package/index.js'),
    path.join(dir, 'node_modules/.bin/patch-package'),
  );
  fs.writeFileSync(path.join(dir, 'node_modules/fixture-ui/package.json'), '{"name":"fixture-ui","version":"1.0.0"}');
  fs.writeFileSync(path.join(dir, 'node_modules/fixture-ui/index.js'), 'module.exports = "original";\n');
  fs.writeFileSync(
    path.join(dir, 'patches/fixture-ui+1.0.0.patch'),
    [
      'diff --git a/node_modules/fixture-ui/index.js b/node_modules/fixture-ui/index.js',
      '--- a/node_modules/fixture-ui/index.js',
      '+++ b/node_modules/fixture-ui/index.js',
      '@@ -1 +1 @@',
      '-module.exports = "original";',
      '+module.exports = "patched";',
      '',
    ].join('\n'),
  );
  fs.copyFileSync(
    path.join(root, 'patches/query-string+7.1.3.patch'),
    path.join(dir, 'patches/query-string+7.1.3.patch'),
  );
  if (backend) {
    fs.cpSync(path.join(root, 'node_modules/query-string'), path.join(dir, 'node_modules/query-string'), {
      recursive: true,
    });
    const file = path.join(dir, 'node_modules/query-string/index.js');
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace("require('decode-uri-component').default", "require('decode-uri-component')"),
    );
    for (const name of ['strict-uri-encode', 'decode-uri-component', 'split-on-first', 'filter-obj']) {
      fs.symlinkSync(path.join(root, 'node_modules', name), path.join(dir, 'node_modules', name));
    }
    fs.mkdirSync(path.join(dir, 'node_modules/@polygon.io/client-js'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'node_modules/@polygon.io/client-js/package.json'),
      '{"name":"@polygon.io/client-js","main":"index.js"}',
    );
    fs.writeFileSync(path.join(dir, 'node_modules/@polygon.io/client-js/index.js'), 'module.exports = {};');
  }
  return dir;
}
function run({ dir, args = ['post-install.sh'], command = 'sh' }) {
  return spawnSync(command, args, {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, CI: '', NODE_ENV: 'development' },
  });
}
function inFixture(options, check) {
  const dir = fixture(options);
  try {
    check(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('frontend-only install applies UI patches without attempting the absent backend patch', () => {
  inFixture({}, (dir) => {
    const result = run({ dir });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /ERROR|Failed to apply/);
    assert.match(fs.readFileSync(path.join(dir, 'node_modules/fixture-ui/index.js'), 'utf8'), /"patched"/);
  });
});

test('a genuine UI patch conflict fails even outside CI', () => {
  inFixture({}, (dir) => {
    fs.writeFileSync(path.join(dir, 'node_modules/fixture-ui/index.js'), 'incompatible upstream content\n');
    const result = run({ dir });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
  });
});

test('a clean backend patch is functional and safe to reapply', () => {
  inFixture({ backend: true }, (dir) => {
    for (let i = 0; i < 2; i++) {
      const result = run({ dir });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
    const result = run({
      dir,
      command: process.execPath,
      args: ['-e', "const q = require('query-string'); if(q.parse('name=Rp%20IDR').name !== 'Rp IDR') process.exit(1)"],
    });
    assert.equal(result.status, 0, result.stderr);
  });
});

test('a genuine backend patch conflict fails even outside CI', () => {
  inFixture({ backend: true }, (dir) => {
    fs.writeFileSync(path.join(dir, 'node_modules/query-string/index.js'), 'incompatible upstream content\n');
    const result = run({ dir });
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
  });
});

test('scripts-disabled or stale-cache backend dependencies fail the explicit runtime gate', () => {
  inFixture({ backend: true }, (dir) => {
    const result = run({ dir, command: process.execPath, args: ['scripts/check-provider-runtime.cjs'] });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /scripts-disabled runtime installs are unsupported/);
    assert.equal(run({ dir }).status, 0);
    assert.equal(run({ dir, command: process.execPath, args: ['scripts/check-provider-runtime.cjs'] }).status, 0);
  });
});

test('missing backend dependencies cannot pass a required runtime check', () => {
  inFixture({}, (dir) => {
    assert.notEqual(run({ dir, command: process.execPath, args: ['scripts/check-provider-runtime.cjs'] }).status, 0);
  });
});
