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
fail closed rather than trusting a potentially stale snapshot. A database-
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
