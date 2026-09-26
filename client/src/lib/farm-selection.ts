/** Derive the effective selection before rendering queries, not in a later effect. */
export function availableFarmId(
  farms: readonly { id: number }[],
  selectedId: string | undefined,
): string | undefined {
  return farms.some((farm) => String(farm.id) === selectedId)
    ? selectedId
    : farms[0]?.id.toString();
}
