#!/usr/bin/env node
/**
 * Confirm both Docker Compose modes are safe without touching a live daemon,
 * starting containers, or opening financial databases.
 * Uses the real 'docker compose config' model, not brittle YAML text parsing.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = 'self-hosting/docker-compose.yml';
const build = 'self-hosting/docker-compose.build.yml';
const kasana = 'self-hosting/docker-compose.private.yml';
const tls = 'self-hosting/docker-compose.traefik.yml';

function config(files, overrides = {}) {
  const args = ['compose', ...files.flatMap((file) => ['-f', file]), 'config', '--format', 'json'];
  const result = spawnSync('docker', args, {
    cwd: root,
    env: { ...process.env, ...overrides },
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `docker compose config failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const baseModel = config([base]);
assert.equal(baseModel.services.backend.image, 'kasana-build-required-backend:local');
assert.equal(baseModel.services.frontend.image, 'kasana-build-required-frontend:local');
assert.equal(baseModel.services.backend.pull_policy, 'never');
assert.equal(baseModel.services.frontend.pull_policy, 'never');
assert.equal(baseModel.services.backend.build, undefined);
assert.equal(baseModel.services.frontend.build, undefined);

const sourceModel = config([base, build, kasana]);
assert.equal(sourceModel.name, 'moneymatter-private', 'Historical volume/project namespace must remain unchanged');
assert.equal(sourceModel.services.backend.image, 'moneymatter-private-backend:local');
assert.equal(sourceModel.services.frontend.image, 'moneymatter-private-frontend:local');
assert.equal(sourceModel.services.backend.pull_policy, 'never');
assert.equal(sourceModel.services.frontend.pull_policy, 'never');
assert.ok(sourceModel.services.backend.build?.context);
assert.ok(sourceModel.services.frontend.build?.context);
assert.equal(sourceModel.networks['budget-tracker'].name, 'moneymatter-private-net');

const tlsModel = config([base, build, kasana, tls], {
  LETSENCRYPT_EMAIL: 'kasana-test@example.invalid',
  SELFHOST_FRONTEND_DOMAIN: 'kasana.example.invalid',
});
assert.equal(tlsModel.services.frontend.ports?.length || 0, 0, 'Public HTTP port must be reset in TLS mode');
assert.ok(
  tlsModel.services.traefik.command.some((value) => value.includes('providers.docker.network=moneymatter-private-net')),
  'Traefik provider must use the real Docker network from the private overlay',
);
assert.ok(
  tlsModel.services.frontend.labels['traefik.http.routers.frontend.rule']?.includes('kasana.example.invalid'),
  'Traefik must use the configured operator domain',
);

const noDomain = spawnSync('docker', [
  'compose', '-f', base, '-f', build, '-f', kasana, '-f', tls, 'config', '--quiet',
], {
  cwd: root,
  env: { ...process.env, LETSENCRYPT_EMAIL: 'kasana-test@example.invalid', SELFHOST_FRONTEND_DOMAIN: '' },
  encoding: 'utf8',
});
assert.notEqual(noDomain.status, 0, 'Traefik must reject an empty domain');
console.log('Kasana Compose base, build, private, and TLS boundary checks passed');
