# Lajur. — atomic request-rate limits for the fresh public beta

Review date: 17 November 2026. **Scope:** `RateLimitService.checkRateLimit` only; no data model, production Redis instance, user, domain, configuration or deployment was changed.

## Reproduced source-level race

The old service read Redis GET, then sent INCR, then (on a newly created key) EXPIRE separately. Many concurrent requests on the same key could all read the same old count and be admitted before increments arrived. The INCR-to-EXPIRE gap could also create an unexpiring counter if the client died between commands. These behaviors matter for endpoints that use this shared limiter: file import/export/backup, attachment upload, invitation sending and cost-bearing AI/demo routes.

The fix uses one short `EVAL` script: compare current integer count with the cap, admit and increment **in one atomic Redis operation**, establish a TTL for the first attempt, and repair an already existing counter with no TTL. It preserves the old fixed-window semantics, key names, error response shape, and the existing explicit `failClosed` decisions of each middleware. A Redis failure remains tagged `serviceUnavailable: true`; the middleware continues to decide whether that route fails open or closed. Redis key prefixes used by Jest workers remain supported via the declared single KEYS argument.

## Evidence and limits

- New **real Redis E2E** tests: 40 concurrent requests with budget 5 must yield exactly 5 admitted, 35 denied; a saturated old key with no TTL is repaired; a rejected call does not consume an extra budget and a newly expired window can admit again.
- Pending: exact-head full CI/backend four shards and production monitoring. No manual staging or live-origin request volume has been measured.
- **Not a signup-account cap fix.** The `SYSTEM_MAX_SIGNUPS_ALLOWED` path checks a SQL user/ledger count in Better Auth's before hook, which remains non-atomic across simultaneously created accounts. Before opening public self-registration, stage and independently address the signup-count race or use a controlled admission/invitation flow. Blocking all new signups (`SYSTEM_MAX_SIGNUPS_ALLOWED=0`) is unaffected.
- Neither fixed-window limiting nor a signup cap replaces upstream WAF/Cloudflare controls. Avoid treating fail-open Redis routes as protected when Redis is unreachable.

Primary sources: [Redis `EVAL`](https://redis.io/docs/latest/commands/eval/), [Redis Lua scripting is atomic](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/), and [ioredis key-prefix documentation](https://github.com/redis/ioredis#transparent-key-prefixing).
