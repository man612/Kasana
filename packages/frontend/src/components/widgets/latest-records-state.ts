/** Decides the initial loading and empty UI for the Latest Transactions widget.
 * Scheduled payments are content even without a recorded transaction. */
export function getLatestRecordsState({
  isFetching,
  transactionCount,
  scheduledCount,
}: {
  isFetching: boolean;
  transactionCount: number;
  scheduledCount: number;
}): { isInitialLoading: boolean; isDataEmpty: boolean } {
  const hasContent = transactionCount > 0 || scheduledCount > 0;
  return {
    isInitialLoading: isFetching && !hasContent,
    isDataEmpty: !isFetching && !hasContent,
  };
}
