import type { Reading, Report } from "@shared/schema";

export function readingDateLabel(
  value: string | Date | null | undefined,
): string {
  if (!value) return "Data não informada";
  const date =
    value instanceof Date
      ? value
      : new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("pt-BR")
    : "Data não informada";
}

export function reportSourceReading(
  report: Report,
  readings: Reading[],
): Reading | null {
  const snapshot = report.readingsSnapshot as {
    currentReading?: Reading;
  } | null;
  if (snapshot?.currentReading?.farmId === report.farmId)
    return snapshot.currentReading;
  return (
    readings.find(
      (reading) =>
        reading.id === report.sourceReadingId &&
        reading.farmId === report.farmId,
    ) || null
  );
}

export function dailyReadings(readings: Reading[]): Reading[] {
  const byDay = new Map<string, Reading>();
  [...readings]
    .sort((a, b) => a.id - b.id)
    .forEach((reading) => {
      if (Number.isFinite(new Date(reading.date).getTime()))
        byDay.set(reading.date.slice(0, 10), reading);
    });
  return Array.from(byDay.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
