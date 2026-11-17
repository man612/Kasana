# Lajur. — PostgreSQL atomic signup capacity (issue #51)

**Status:** draft, not authorized for public signups. Scope is code and GitHub
CI on disposable migrated PostgreSQL. No changes to main, real data, VPS,
Cloudflare, or local Podman.

## Race closed

Better Auth's user.create.before hook used a count of ba_user (self-host) or
SignupLedger (hosted), then returned to Better Auth for the actual INSERT. Two
workers can see the same remaining slot. Better Auth's create.after runs
post-transaction; a lock held from before to after would be fragile if signup
fails before after is invoked.

A PostgreSQL AFTER INSERT FOR EACH STATEMENT trigger now obtains a row lock on
the singleton SignupCapacity policy **inside the actual ba_user transaction**.
After waiting for an earlier signup to commit, it checks the resulting row
count using a VOLATILE SQL function under READ COMMITTED. Exceeding the cap
raises SQLSTATE 23514, rolling back the insertion without a leaked
reservation. This applies to both email and OAuth paths because they write to
the same auth table. A transition relation skips empty INSERT statements,
including no-op ON CONFLICT statements. Non-READ COMMITTED transactions
fail closed *when a cap is active*, rather than trusting a potentially stale
snapshot. Unlimited self-host mode retains legacy isolation flexibility. A database-
side rejection may currently appear as a generic error, not a polished 403.

On self-host, current live ba_user rows count. Deleting a user releases a
slot. On hosted instances, the union of persistent SignupLedger normalized
email hashes and live ba_user normalized email hashes counts both historic
trial identities and auth users whose after-hook has not yet recorded them in
the ledger. Extra live accounts sharing a normalized identity (e.g. Gmail dot
or plus aliases) also consume individual slots, preventing physical-account
cap bypass. Removing a user does not remove its historical ledger identity.
The SQL normalization mirrors the existing ledger backfill.

## Operational policy

The migration creates a singleton row with a null/unlimited cap for backwards
compatibility. The registration precheck synchronizes the requested
SYSTEM_MAX_SIGNUPS_ALLOWED and IS_SELF_HOST mode to PostgreSQL. Malformed
values and zero fail closed. Once a database cap is set, automatically
widening/removing it is forbidden: a stale worker cannot reopen enrollment.
Changing the scope or raising the cap requires explicit operator review and
database adjustment, with consistent values on every running backend.

### Explicit capacity increase (self-host operator runbook)

A worker changing `SYSTEM_MAX_SIGNUPS_ALLOWED=1` to `2` must **not**
automatically reopen enrollment. Its precheck stays closed until the shared
database policy is explicitly changed. This prevents a stale or rogue worker
from silently expanding the quota.

1. Keep public registration closed at the ingress or in maintenance mode
   during the policy change. Confirm that every backend instance will use the
   same intended `IS_SELF_HOST` and `SYSTEM_MAX_SIGNUPS_ALLOWED` values.
   Stop/drain workers with old values; an old worker is intentionally able to
   tighten the policy again.
2. On the **intended** database, inspect the existing policy and actual
   enrollment count *read-only*. For a self-host cap change, use
   `SELECT id, "scope", "maxSignups" FROM "SignupCapacity";` and
   `SELECT COUNT(*) FROM ba_user;`. Do not assume the database is disposable.
3. Only after operator approval, use a conditional, single-statement policy
   update with the precise expected prior value. Example for an **approved**
   self-host increase from **1** to **2**:

   ```sql
   BEGIN;
   SET LOCAL lock_timeout = '5s';
   UPDATE "SignupCapacity"
   SET "maxSignups" = 2
   WHERE id = 1 AND "scope" = 'self-host' AND "maxSignups" = 1
   RETURNING id, "scope", "maxSignups";
   -- Exactly one returned row is required; otherwise ROLLBACK and investigate.
   COMMIT;
   ```

   This is a *runbook example*, not authorization to modify any production DB.
   For hosted mode, first inspect both trial-ledger history and live auth
   accounts: deletion does not free a historic trial identity. Never change
   `scope` as an incidental side effect of a cap increase.
4. Verify the policy and `/auth/signups-open` from every backend process,
   then test one controlled registration at the remaining capacity and
   confirm the next attempt is refused. Only reopen ingress after acceptance.
   Any mismatch, unavailable database, or unexpected result means keep signup
   closed and investigate. Do not clear the policy to `NULL` as a shortcut.

The integration test explicitly covers both halves: a worker-only cap increase
remains closed; a conditional operator policy increase reopens signup and the
next completed registration consumes the last slot.

The trigger is a final admission gate, not a full invitation system. A process
crash after ba_user commits and before app-user creation may leave an orphan
auth record occupying a slot; its deletion requires private operator review,
not automatic deletion. Keep account registration blocked pending a recovery
plan. Do not add untrusted application roles that can mutate the policy table.

## Acceptance checks

- [ ] Exact-head full CI (migrations, backend E2E, lint, TypeScript, images)
- [ ] Two independent PostgreSQL pools, 40 simultaneous self-host inserts with
  5 remaining slots: exactly 5 admitted, 35 rejected
- [ ] Hosted 24 simultaneous inserts with 3 remaining ledger/union slots
- [ ] Reject cap=0, verify aborted transactions leave no reservations
- [ ] Test account deletion, Gmail alias cap bypass, and hosted historical ledger persistence
- [ ] Staging email registration and trusted OAuth callbacks on two running
  backend instances, not merely a mocked endpoint
- [ ] Define an operator-safe review/recovery procedure for orphan auth rows
  and acceptable public 403/signup feedback
- [ ] Verify PostgreSQL READ COMMITTED and rejection under other isolation levels on the actual staging DB setup
- [ ] Operator approval before public self-registration

Primary sources:
- https://www.postgresql.org/docs/current/trigger-datachanges.html
- https://better-auth.com/docs/concepts/database
- https://better-auth.com/blog/1-5

Issue: https://github.com/man612/Kasana/issues/51
