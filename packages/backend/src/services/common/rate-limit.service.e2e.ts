import { describe, expect, it } from '@jest/globals';
import { redisClient } from '@root/redis-client';
import { randomUUID } from 'node:crypto';

import { RateLimitService } from './rate-limit.service';

// Real Redis, isolated by unique keys + the test worker's ioredis keyPrefix.
// These are short-lived synthetic counters; no app account data is involved.
describe('Atomic Redis rate limiting', () => {
  it('never admits more than the cap under concurrent requests', async () => {
    const key = 'synthetic-atomic-concurrency:' + randomUUID();
    const redisKey = 'rate_limit:' + key;
    try {
      const results = await Promise.all(
        Array.from({ length: 40 }, () => RateLimitService.checkRateLimit(key, 60, 5)),
      );
      expect(results.filter((result) => result.allowed)).toHaveLength(5);
      expect(results.filter((result) => !result.allowed)).toHaveLength(35);
      expect(results.some((result) => result.serviceUnavailable)).toBe(false);
      expect(await redisClient.get(redisKey)).toBe('5');
      const ttl = await redisClient.ttl(redisKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    } finally {
      await redisClient.del(redisKey);
    }
  });

  it('repairs a saturated legacy counter with no TTL without admitting another request', async () => {
    const key = 'synthetic-no-expiry:' + randomUUID();
    const redisKey = 'rate_limit:' + key;
    try {
      await redisClient.set(redisKey, '2');
      expect(await redisClient.ttl(redisKey)).toBe(-1);
      const result = await RateLimitService.checkRateLimit(key, 45, 2);
      expect(result.allowed).toBe(false);
      expect(result.serviceUnavailable).toBeUndefined();
      expect(result.remainingSeconds).toBeGreaterThan(0);
      expect(await redisClient.get(redisKey)).toBe('2');
      expect(await redisClient.ttl(redisKey)).toBeGreaterThan(0);
    } finally {
      await redisClient.del(redisKey);
    }
  });

  it('does not charge blocked attempts, then permits a new window after expiry', async () => {
    const key = 'synthetic-window-expiry:' + randomUUID();
    const redisKey = 'rate_limit:' + key;
    try {
      expect((await RateLimitService.checkRateLimit(key, 60, 1)).allowed).toBe(true);
      expect((await RateLimitService.checkRateLimit(key, 60, 1)).allowed).toBe(false);
      expect(await redisClient.get(redisKey)).toBe('1');
      // Drive the clock via Redis expiry, not a fragile wall-clock sleep.
      await redisClient.expire(redisKey, 0);
      expect((await RateLimitService.checkRateLimit(key, 60, 1)).allowed).toBe(true);
      expect(await redisClient.get(redisKey)).toBe('1');
    } finally {
      await redisClient.del(redisKey);
    }
  });
});
