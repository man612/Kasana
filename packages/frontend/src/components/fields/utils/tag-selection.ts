export function sameTagSelection({ initial, draft }: { initial: string[]; draft: string[] }): boolean {
  const starting = new Set(initial);
  const current = new Set(draft);
  return starting.size === current.size && [...current].every((id) => starting.has(id));
}
