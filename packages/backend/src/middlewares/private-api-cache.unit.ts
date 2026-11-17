import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { privateApiCacheMiddleware } from './private-api-cache';

const app = express();
app.use(privateApiCacheMiddleware);
app.get('/api/v1/auth/get-session', (_req, res) => res.status(401).json({ error: 'synthetic-only' }));
app.get('/api/v1/transactions', (_req, res) => res.json({ amount: 125000.5 }));
app.get('/api/v1/attachments/example/file', (_req, res) =>
  res.type('application/pdf').send(Buffer.from('synthetic-only')),
);
app.get('/api/v1', (_req, res) => res.json({ ok: true }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/.well-known/oauth-authorization-server', (_req, res) => res.json({ issuer: 'synthetic-only' }));
app.get('/api/v10/not-financial', (_req, res) => res.json({ ok: true }));

describe('privateApiCacheMiddleware', () => {
  it.each([
    ['/api/v1/auth/get-session', 401],
    ['/api/v1/transactions', 200],
    ['/api/v1/attachments/example/file', 200],
    ['/api/v1', 200],
  ])('prevents HTTP and edge caching of %s', async (path, status) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(status);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['cdn-cache-control']).toBe('no-store');
    expect(res.headers['cloudflare-cdn-cache-control']).toBe('no-store');
  });

  it.each(['/health', '/.well-known/oauth-authorization-server', '/api/v10/not-financial'])(
    'does not alter caching for routes outside the finance API prefix: %s',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBeUndefined();
      expect(res.headers['cdn-cache-control']).toBeUndefined();
      expect(res.headers['cloudflare-cdn-cache-control']).toBeUndefined();
    },
  );
});
