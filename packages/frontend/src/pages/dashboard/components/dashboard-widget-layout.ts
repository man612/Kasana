/** Let an empty or collapsed Latest Transactions card fit its contents outside edit mode. */
export function getEffectiveDashboardRowSpan({
  widgetId,
  rowSpan,
  isEditMode,
  isDataEmpty,
  isCompact = false,
}: {
  widgetId: string;
  rowSpan?: number;
  isEditMode: boolean;
  isDataEmpty: boolean;
  isCompact?: boolean;
}): number {
  if (widgetId === 'latest-records' && !isEditMode && (isDataEmpty || isCompact)) return 1;
  return rowSpan ?? 1;
}
