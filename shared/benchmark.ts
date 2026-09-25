import type { Reading } from './schema.js';

export type BenchmarkResult =
  | { status: 'unavailable'; reason: string; farmNdvi: number | null; readingDate: string | null }
  | { status: 'available'; farmNdvi: number; regionalNdvi: number; difference: number; readingDate: string };

export function summarizeRegionalNdvi(reading: Reading | undefined): BenchmarkResult {
  if (!reading) {
    return { status: 'unavailable', reason: 'Ainda não há uma leitura de satélite para esta fazenda.', farmNdvi: null, readingDate: null };
  }

  const farmNdvi = Number.isFinite(reading.ndvi) && reading.ndvi >= -1 && reading.ndvi <= 1 ? reading.ndvi : null;
  const readingDate = reading.date;
  if (reading.isSimulated || farmNdvi === null) {
    return { status: 'unavailable', reason: 'A leitura atual não pode ser usada em uma comparação regional.', farmNdvi, readingDate };
  }

  // Older failed regional calculations were stored as zero. Do not turn them into a baseline.
  const regionalNdvi = reading.regionalNdvi;
  if (regionalNdvi === null || regionalNdvi === undefined || !Number.isFinite(regionalNdvi) || regionalNdvi === 0 || regionalNdvi < -1 || regionalNdvi > 1) {
    return { status: 'unavailable', reason: 'Não há uma média regional válida para esta leitura.', farmNdvi, readingDate };
  }

  return { status: 'available', farmNdvi, regionalNdvi, difference: farmNdvi - regionalNdvi, readingDate };
}
