export function dedupById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
}
