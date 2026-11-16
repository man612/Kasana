#!/usr/bin/env node
/**
 * Offline, read-only Option B public-hosting preflight.
 * It never starts containers, contacts providers or prints secret values.
 * Run against the operator's private self-hosting/.env, not the example.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

function validOrigin(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
        u.pathname !== '/' || u.port) return null;
    if (u.hostname === 'localhost' || !u.hostname.includes('.') ||
        /^[0-9.]+$/.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

function explicitCap(raw) {
  const value = (raw ?? '').trim();
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return false;
  return Number.isSafeInteger(Number(value));
}

export function checkPublicDeploymentEnv(env) {
  const errors = [];
  const problem = (name, why) => errors.push(name + ': ' + why);

  if (env.NODE_ENV !== 'production') problem('NODE_ENV', 'must be production');

  const auth = validOrigin(env.AUTH_ORIGIN);
  const better = validOrigin(env.BETTER_AUTH_URL);
  if (!auth) problem('AUTH_ORIGIN', 'must be the public HTTPS origin without path, query or nondefault port');
  if (!better) problem('BETTER_AUTH_URL', 'must be the public HTTPS origin without path, query or nondefault port');
  if (auth && better && auth.origin !== better.origin) {
    problem('AUTH_ORIGIN/BETTER_AUTH_URL', 'must match exactly');
  }

  if (!/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(env.HTTP_PORT ?? '') ||
      Number((env.HTTP_PORT ?? '').split(':')[1]) > 65535) {
    problem('HTTP_PORT', 'must bind frontend to 127.0.0.1:PORT for a host-level Tunnel; confirm origin firewall separately');
  }
  if ((env.API_HTTP ?? '').trim()) {
    problem('API_HTTP', 'must be empty for the selected same-origin frontend/API architecture');
  }

  if (!explicitCap(env.SYSTEM_MAX_SIGNUPS_ALLOWED)) {
    problem('SYSTEM_MAX_SIGNUPS_ALLOWED', 'explicit non-negative integer required; use 0 before opening registration');
  }

  const secretNames = [
    'APPLICATION_JWT_SECRET',
    'APP_SESSION_ID_SECRET',
    'BETTER_AUTH_SECRET',
    'APPLICATION_DB_PASSWORD',
  ];
  const usableSecrets = [];
  for (const key of secretNames) {
    const v = env[key] ?? '';
    const min = key === 'APPLICATION_DB_PASSWORD' ? 16 : 32;
    if (v.length < min || v.includes('__REPLACE_ME__') || v.includes('example') ||
        v.includes('changeme')) {
      problem(key, 'must be a separate non-placeholder secret of sufficient length');
    } else usableSecrets.push(v);
  }
  if (new Set(usableSecrets).size !== usableSecrets.length) {
    problem('APPLICATION_* / BETTER_AUTH_SECRET', 'must use distinct secrets');
  }

  const sender = (env.RESEND_FROM_EMAIL ?? '').trim();
  if (!env.RESEND_API_KEY?.startsWith('re_') || env.RESEND_API_KEY.length < 16) {
    problem('RESEND_API_KEY', 'required for verified public email/password signups');
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender) ||
      /@(?:resend\.dev|example\.(?:com|org|net)|.+\.invalid)$/i.test(sender)) {
    problem('RESEND_FROM_EMAIL', 'must use the operator-controlled verified sending domain');
  }

  const rp = (env.AUTH_RP_ID ?? '').trim().toLowerCase();
  if (!auth || !rp || rp === 'localhost' ||
      (auth.hostname !== rp && !auth.hostname.endsWith('.' + rp))) {
    problem('AUTH_RP_ID', 'must be a registrable suffix of the public HTTPS hostname for passkeys');
  }

  return errors;
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  const file = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(path.dirname(ownPath), '..', 'self-hosting', '.env');
  try {
    const env = parseEnv(readFileSync(file, 'utf8'));
    const errors = checkPublicDeploymentEnv(env);
    if (errors.length) {
      console.error('FAIL: Option B public configuration is not ready:');
      for (const error of errors) console.error('- ' + error);
      process.exitCode = 1;
    } else {
      console.log('PASS: offline public-environment shape checks.');
      console.log('NOT VERIFIED: DNS/TLS/Tunnel, sender domain, delivery, firewall, cache, backups, actual domain or legal readiness.');
    }
  } catch {
    console.error('FAIL: cannot read/parse the specified private self-hosting/.env file; check its path.');
    process.exitCode = 1;
  }
}
