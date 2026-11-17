/** Missing comparison data is distinct from zero.
 * If the preceding period is zero, the absolute change is defined but its
 * percentage is not meaningful and must not be invented as +100%.
 */
export const compareBalancePeriods = ({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}): { absolute: number | null; percent: number | null } => {
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) {
    return { absolute: null, percent: null };
  }

  const absolute = current - previous;
  const percent = previous === 0 ? null : Number(((absolute / Math.abs(previous)) * 100).toFixed(2));
  return { absolute, percent };
};
