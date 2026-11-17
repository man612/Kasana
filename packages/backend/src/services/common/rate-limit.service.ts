import { logger } from '@js/utils';
import { redisClient } from '@root/redis-client';

interface RateLimitResult {
  allowed: boolean;
  remainingSeconds?: number;
  resetTime?: Date;
  /**
   * True when the check itself couldn't run (Redis unreachable); `allowed:
   * true` is then a fallback, not a real count. Callers that need to fail
   * closed read this flag explicitly instead of defaulting to fail-open.
   */
  serviceUnavailable?: boolean;
}

/**
 * Fixed-window budget is checked and incremented in one Redis operation.
 * The previous GET -> INCR -> EXPIRE sequence could let multiple concurrent
 * requests all pass and leave a permanent key if the process died before
 * EXPIRE. The script repairs pre-existing counters with no TTL as well.
 *
 * One declared KEYS[1] lets ioredis apply its per-worker keyPrefix for tests.
 * Numbers and other inputs are passed in ARGV, not interpolated into Lua.
 */
const ATOMIC_RATE_LIMIT_SCRIPT = [
  "local limit = tonumber(ARGV[1])",
  "local window = tonumber(ARGV[2])",
  "local current = redis.call(\"GET\", KEYS[1])",
  "if current and tonumber(current) >= limit then",
  "  local ttl = redis.call(\"TTL\", KEYS[1])",
  "  if ttl == -1 then",
  "    redis.call(\"EXPIRE\", KEYS[1], window)",
  "    ttl = window",
  "  end",
  "  return {0, ttl}",
  "end",
  "local new_count = redis.call(\"INCR\", KEYS[1])",
  "local ttl = redis.call(\"TTL\", KEYS[1])",
  "if ttl == -1 then",
  "  redis.call(\"EXPIRE\", KEYS[1], window)",
  "  ttl = window",
  "end",
  "return {1, ttl}",
].join('\n');

// oxlint-disable-next-line typescript/no-extraneous-class -- static utility class used as a namespace
export class RateLimitService {
  /**
   * Atomically check and charge a fixed-window rate limit. Never rejects:
   * a Redis failure resolves as `{ allowed: true, serviceUnavailable: true }`,
   * so every caller keeps failing open by default.
   * @param key - Unique identifier for the rate limit (e.g., "user:123:price-sync")
   * @param windowSeconds - Time window in seconds for the rate limit
   * @param maxAttempts - Maximum number of attempts allowed in the window
   * @returns Promise<RateLimitResult>
   */
  static async checkRateLimit(key: string, windowSeconds: number, maxAttempts: number = 1): Promise<RateLimitResult> {
    const redisKey = `rate_limit:${key}`;

    try {
      const [allowed, ttl] = (await redisClient.eval(
        ATOMIC_RATE_LIMIT_SCRIPT,
        1,
        redisKey,
        String(maxAttempts),
        String(windowSeconds),
      )) as [number, number];

      if (allowed === 0) {
        const remainingSeconds = Math.max(0, ttl);
        return {
          allowed: false,
          remainingSeconds,
          resetTime: new Date(Date.now() + remainingSeconds * 1000),
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error({
        message: `Rate limit check failed for key ${redisKey}, allowing request by default`,
        error: error as Error,
      });

      // Redis is unreachable. Allow by default, but flag it so a caller that
      // opted into failing closed (e.g. the demo-start limiter) can still deny.
      return {
        allowed: true,
        serviceUnavailable: true,
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   * @param key - The rate limit key to reset
   */
  static async resetRateLimit(key: string): Promise<void> {
    const redisKey = `rate_limit:${key}`;

    try {
      await redisClient.del(redisKey);
      logger.info(`Rate limit reset for key: ${key}`);
    } catch (error) {
      logger.error({
        message: `Failed to reset rate limit for key ${redisKey}`,
        error: error as Error,
      });
    }
  }

  /**
   * Get current rate limit status for a key
   * @param key - The rate limit key to check
   * @returns Promise<{ count: number; ttl: number }>
   */
  static async getRateLimitStatus(key: string): Promise<{ count: number; ttl: number }> {
    const redisKey = `rate_limit:${key}`;

    try {
      const [count, ttl] = await Promise.all([redisClient.get(redisKey), redisClient.ttl(redisKey)]);

      return {
        count: count ? parseInt(count, 10) : 0,
        ttl: ttl > 0 ? ttl : 0,
      };
    } catch (error) {
      logger.error({
        message: `Failed to get rate limit status for key ${redisKey}`,
        error: error as Error,
      });

      return { count: 0, ttl: 0 };
    }
  }
}
