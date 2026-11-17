// Compare two synthetic old/new finance fixture snapshots using exact cents.
// No database access, no network and no mutation of actual financial data.
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_CENTS = (1n << 63n) - 1n;
const KINDS = new Set(['transaction', 'account', 'balance', 'loan', 'investment']);

function check(value, message) {
  if (!value) throw new Error(message);
}
function toCents(value, label) {
  check(typeof value === 'string' && /^-?(0|[1-9][0-9]*)$/.test(value), label + ': expected integer cents string');
  const amount = BigInt(value);
  check(amount >= -(1n << 63n) && amount <= MAX_CENTS, label + ': cents overflow bigint');
  return amount;
}
function indexSnapshot(data, name) {
  check(data && typeof data === 'object' && data.schemaVersion === 1, name + ': invalid version');
  check(typeof data.fixtureId === 'string' && /^synthetic-[a-z0-9-]{1,70}$/.test(data.fixtureId), name + ': synthetic fixture required');
  check(typeof data.revision === 'string' && data.revision.length >= 3, name + ': missing revision');
  check(Array.isArray(data.rows) && data.rows.length > 0 && data.rows.length <= MAX_ROWS, name + ': invalid row count');
  const byKey = new Map();
  for (const row of data.rows) {
    check(row && typeof row.key === 'string' && /^[a-z][a-z0-9:._-]{1,140}$/.test(row.key), name + ': invalid stable key');
    check(KINDS.has(row.kind), name + ': invalid row type');
    check(!byKey.has(row.key), name + ': duplicate row ' + row.key);
    toCents(row.nativeCents, row.key + '/native');
    toCents(row.refCents, row.key + '/ref');
    byKey.set(row.key, row);
  }
  return byKey;
}
export function compareSyntheticFxSnapshots(before, after, expected) {
  const oldRows = indexSnapshot(before, 'before');
  const newRows = indexSnapshot(after, 'after');
  check(before.fixtureId === after.fixtureId, 'fixture mismatch');
  check(before.revision !== after.revision, 'revision mismatch');
  check(oldRows.size === newRows.size, 'ledger row count changed');
  check(expected && expected.fixtureId === before.fixtureId && Array.isArray(expected.refChanges), 'invalid expected diff manifest');
  check(expected.refChanges.length <= MAX_ROWS, 'too many expected changes');
  const allowed = new Map();
  for (const change of expected.refChanges) {
    check(change && typeof change.key === 'string' && oldRows.has(change.key), 'unknown expected row');
    check(!allowed.has(change.key), 'duplicate expected diff ' + change.key);
    check(typeof change.reason === 'string' && change.reason.length >= 12, 'missing reason for ' + change.key);
    toCents(change.beforeRefCents, 'expected-before');
    toCents(change.afterRefCents, 'expected-after');
    check(change.beforeRefCents !== change.afterRefCents, 'expected diff is a no-op');
    allowed.set(change.key, change);
  }
  const changes = [];
  let unchangedRows = 0;
  for (const key of [...oldRows.keys()].sort()) {
    const oldRow = oldRows.get(key), newRow = newRows.get(key);
    check(!!newRow, 'missing ledger row ' + key);
    check(oldRow.kind === newRow.kind, 'row kind changed: ' + key);
    check(toCents(oldRow.nativeCents, 'old-native') === toCents(newRow.nativeCents, 'new-native'), 'native ledger cents changed: ' + key);
    const oldRef = toCents(oldRow.refCents, 'old-ref'), newRef = toCents(newRow.refCents, 'new-ref');
    if (oldRef === newRef) {
      check(!allowed.has(key), 'expected FX change did not occur: ' + key);
      unchangedRows++;
      continue;
    }
    const approved = allowed.get(key);
    check(!!approved, 'unexplained reference-cent change: ' + key);
    check(toCents(approved.beforeRefCents, 'approved-old') === oldRef, 'old approved cents mismatch: ' + key);
    check(toCents(approved.afterRefCents, 'approved-new') === newRef, 'new approved cents mismatch: ' + key);
    changes.push({
      key, kind: oldRow.kind, beforeRefCents: oldRow.refCents, afterRefCents: newRow.refCents,
      deltaRefCents: String(newRef - oldRef), reason: approved.reason,
    });
  }
  check(changes.length === allowed.size, 'not all approved changes observed');
  return {
    fixtureId: before.fixtureId, beforeRevision: before.revision, afterRevision: after.revision,
    totalRows: oldRows.size, unchangedRows, explainedChanges: changes,
  };
}
async function readBounded(path) {
  const fullPath = resolve(path), info = await stat(fullPath);
  check(info.isFile() && info.size > 0 && info.size <= MAX_FILE_BYTES, 'input file must be <= 2 MiB');
  return JSON.parse(await readFile(fullPath, 'utf8'));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    process.stderr.write('Usage: node scripts/finance-fx-snapshot-diff.mjs old.json new.json expected.json\n');
    process.exitCode = 2;
  } else {
    try {
      const [before, after, manifest] = await Promise.all(args.map(readBounded));
      process.stdout.write('FX_SYNTHETIC_DIFF ' + JSON.stringify(compareSyntheticFxSnapshots(before, after, manifest)) + '\n');
    } catch (error) {
      process.stderr.write('FX_SYNTHETIC_DIFF FAILED: ' + String(error.message ?? error) + '\n');
      process.exitCode = 1;
    }
  }
}
