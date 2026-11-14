/** Preserve customized widget sizes, except an empty saved two-row Latest
 * Transactions widget which would otherwise stretch a blank dashboard. */
export function getEffectiveDashboardRowSpan({
  widgetId,
  rowSpan,
  isEditMode,
  isDataEmpty,
}: {
  widgetId: string;
  rowSpan?: number;
  isEditMode: boolean;
  isDataEmpty: boolean;
}): number {
  if (widgetId === 'latest-records' && !isEditMode && isDataEmpty) return 1;
  return rowSpan ?? 1;
}
