// Use the SDK's actual dependency edges, including nested installations.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const path = require('node:path');

try {
  const appRequire = createRequire(path.resolve('package.json'));
  let polygonPath;
  try {
    polygonPath = appRequire.resolve('@polygon.io/client-js');
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND' || !process.argv.includes('--if-present')) throw error;
    console.log('Provider dependencies absent: frontend-only installation.');
    process.exit(0);
  }
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Use the pinned Node 24 runtime');
  const polygonRequire = createRequire(polygonPath);
  const queryString = polygonRequire('query-string');
  const queryRequire = createRequire(polygonRequire.resolve('query-string'));
  const decoderFile = queryRequire.resolve('decode-uri-component');
  assert.equal(JSON.parse(readFileSync(path.join(path.dirname(decoderFile), 'package.json'))).version, '0.5.1');
  assert.equal(queryString.parse('name=Rp%20%E2%82%AC').name, 'Rp €');
  assert.equal(queryString.parse('name=%C3%A5%zz').name, 'å%zz');
  assert.equal(queryString.stringify({ amount: '20000.5', currency: 'IDR' }), 'amount=20000.5&currency=IDR');
  console.log('PASS: installed Polygon decoder 0.5.1 and CommonJS/ESM bridge are functional.');
} catch (error) {
  console.error('Provider runtime verification failed:', error.message);
  console.error(
    'Use Node 24 and run npm ci with lifecycle scripts enabled; scripts-disabled runtime installs are unsupported.',
  );
  process.exitCode = 1;
}
