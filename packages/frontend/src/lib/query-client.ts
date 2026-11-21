import { VUE_QUERY_CACHE_KEYS } from '@/common/const/vue-query';
import { ApiErrorResponseError, AuthError, UnexpectedError } from '@/js/errors';
import { API_ERROR_CODES } from '@bt/shared/types';
import { QueryClient, type QueryKey } from '@tanstack/vue-query';

import { persistedImmutableQueryFn, persistedQueryFn, removePersistedQuery } from './query-persister';

// Client-terminal codes: the caller cannot fix by retrying (auth/permission
// gaps, missing resources, malformed requests). Transient codes like
// tooManyRequests and badGateway are intentionally absent so they stay retryable.
const NON_RETRYABLE_API_CODES: ReadonlySet<API_ERROR_CODES> = new Set([
  API_ERROR_CODES.forbidden,
  API_ERROR_CODES.notFound,
  API_ERROR_CODES.notAllowed,
  API_ERROR_CODES.BadRequest,
  API_ERROR_CODES.validationError,
  API_ERROR_CODES.conflict,
  API_ERROR_CODES.invalidCredentials,
  API_ERROR_CODES.userExists,
  API_ERROR_CODES.categoryHasTransactions,
  API_ERROR_CODES.locked,
  API_ERROR_CODES.baseCurrencyChangeInProgress,
  API_ERROR_CODES.baseCurrencyChangeInProgressOtherUser,
  API_ERROR_CODES.payloadTooLarge,
  API_ERROR_CODES.currencyNotConnected,
]);

const DEFAULT_MAX_RETRIES = 3;

export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (error instanceof AuthError) return false;
  if (error instanceof UnexpectedError) return false;

  if (error instanceof ApiErrorResponseError) {
    return !NON_RETRYABLE_API_CODES.has(error.data.code) && failureCount < DEFAULT_MAX_RETRIES;
  }

  return failureCount < DEFAULT_MAX_RETRIES;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
    // Writes are sent immediately or fail. Replaying them after reconnect
    // requires an idempotent sync protocol.
    mutations: { networkMode: 'always' },
  },
});

// Data worth painting from disk before the network answers. Volatile data
// (transactions, balances history, cash-flow, stats, notifications, sync status)
// stays off this list – restoring it would flash figures wrong more often than right.
//
// Matched by PREFIX, so every variant of a key (a filtered subscriptions list, a
// payee search term) persists as its own entry, and each prefix must avoid
// overlapping a volatile sibling under the same global prefix.
//
// Financial snapshots are confirmed on idle. The small reference group below
// can reuse a recent response between app launches.
const PERSISTED_QUERY_KEY_PREFIXES: readonly QueryKey[] = [
  VUE_QUERY_CACHE_KEYS.userCurrencies,
  VUE_QUERY_CACHE_KEYS.baseCurrency,
  VUE_QUERY_CACHE_KEYS.categoriesList,
  VUE_QUERY_CACHE_KEYS.accountGroups,
  VUE_QUERY_CACHE_KEYS.exchangeRates,
  VUE_QUERY_CACHE_KEYS.earliestTransactionDate,
  // Slow-to-load list endpoints (list only, not per-item detail/summary)
  VUE_QUERY_CACHE_KEYS.allAccounts,
  VUE_QUERY_CACHE_KEYS.portfoliosList,
  VUE_QUERY_CACHE_KEYS.loansList,
  VUE_QUERY_CACHE_KEYS.subscriptionsList,
  // The full two-element key is deliberate: it excludes the volatile
  // bank-sync-status sibling living under the same prefix.
  VUE_QUERY_CACHE_KEYS.bankConnections,
  VUE_QUERY_CACHE_KEYS.payeesList,
  VUE_QUERY_CACHE_KEYS.payeesLookup,
];

// The ISO currency table can't change while a build is live – restore-and-trust,
// no confirming request (see `persistedImmutableQueryFn`).
const IMMUTABLE_PERSISTED_QUERY_KEY_PREFIXES: readonly QueryKey[] = [VUE_QUERY_CACHE_KEYS.allCurrencies];

const REFERENCE_FRESHNESS_MS = 5 * 60 * 1000;
const FRESH_REFERENCE_KEYS: readonly QueryKey[] = [
  VUE_QUERY_CACHE_KEYS.categoriesList,
  VUE_QUERY_CACHE_KEYS.userCurrencies,
  VUE_QUERY_CACHE_KEYS.accountGroups,
  VUE_QUERY_CACHE_KEYS.payeesLookup,
];
const referenceKeys = new Set(FRESH_REFERENCE_KEYS);

// Attach the persister centrally via query defaults so individual useQuery call
// sites stay untouched. Per-call options still win over these defaults, and no
// whitelisted call site sets its own `persister`.
for (const queryKey of PERSISTED_QUERY_KEY_PREFIXES) {
  const isReference = referenceKeys.has(queryKey);
  if (persistedQueryFn || isReference) {
    queryClient.setQueryDefaults(queryKey, {
      persister: persistedQueryFn,
      ...(isReference && {
        staleTime: REFERENCE_FRESHNESS_MS,
        meta: { persistedFreshForMs: REFERENCE_FRESHNESS_MS },
      }),
    });
  }
}

if (persistedImmutableQueryFn) {
  for (const queryKey of IMMUTABLE_PERSISTED_QUERY_KEY_PREFIXES) {
    queryClient.setQueryDefaults(queryKey, { persister: persistedImmutableQueryFn });
  }
}

/**
 * Use instead of `invalidateQueries` for any key listed above. Invalidating alone leaves
 * the disk snapshot behind, and once the in-memory entry is garbage-collected the next
 * fetch restores that pre-mutation snapshot instead of refetching.
 */
export const invalidatePersistedQuery = async ({ queryKey }: { queryKey: QueryKey }): Promise<void> => {
  await removePersistedQuery({ queryKey });
  await queryClient.invalidateQueries({ queryKey });
};
