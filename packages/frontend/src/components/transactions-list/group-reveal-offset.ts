interface VerticalBounds {
  top: number;
  bottom: number;
}

export function groupRevealOffset({
  viewport,
  group,
  stickyHeight = 0,
}: {
  viewport: VerticalBounds;
  group: VerticalBounds;
  stickyHeight?: number;
}): number {
  const remainingBelow = group.bottom - viewport.bottom;
  const roomAboveHeader = group.top - viewport.top - stickyHeight;
  return Math.max(0, Math.min(remainingBelow, roomAboveHeader));
}
