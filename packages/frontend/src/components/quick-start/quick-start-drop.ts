import type { QuickStartPosition } from '@/stores/onboarding';

type DropResolution =
  | { kind: 'none' }
  | { kind: 'persist'; position: QuickStartPosition }
  | { kind: 'restore'; position: QuickStartPosition | null };

/** A cancelled long-press drag must never persist an unfinished position. */
export function resolveQuickStartDrop({
  canceled,
  dragging,
  previous,
  current,
}: {
  canceled: boolean;
  dragging: boolean;
  previous: QuickStartPosition | null;
  current: QuickStartPosition | null;
}): DropResolution {
  if (!dragging) return { kind: 'none' };
  if (canceled) return { kind: 'restore', position: previous };
  if (current) return { kind: 'persist', position: current };
  return { kind: 'none' };
}
