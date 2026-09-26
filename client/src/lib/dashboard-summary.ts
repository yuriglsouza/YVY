import type { Farm, Reading } from "@shared/schema";
export type DashboardFarm = Farm & {
  latestReading?: Reading | null;
  ownerEmail?: string | null;
};
export type ReadingKind =
  "missing" | "simulated" | "invalid" | "cloudy" | "low" | "medium" | "high";
export function dashboardReading(reading?: Reading | null) {
  const value =
    typeof reading?.ndvi === "number" &&
    Number.isFinite(reading.ndvi) &&
    Math.abs(reading.ndvi) <= 1
      ? reading.ndvi
      : null;
  const kind: ReadingKind = !reading
    ? "missing"
    : reading.isSimulated
      ? "simulated"
      : value === null
        ? "invalid"
        : (reading.cloudCover ?? 0) > 0.6
          ? "cloudy"
          : value <= 0.3
            ? "low"
            : value <= 0.6
              ? "medium"
              : "high";
  const labels: Record<ReadingKind, string> = {
    missing: "Sem leitura",
    simulated: "Dado simulado",
    invalid: "NDVI indisponível",
    cloudy: "Limitado por nuvens",
    low: "NDVI baixo",
    medium: "NDVI intermediário",
    high: "NDVI elevado",
  };
  const reasons: Record<ReadingKind, string> = {
    missing: "Abra a fazenda para sincronizar o satélite.",
    simulated: "Não representa uma medição real.",
    invalid: "O índice não está disponível na faixa válida.",
    cloudy: "Confira a imagem e as observações de campo.",
    low: "Compare com a cultura, a época e a vistoria.",
    medium: "Acompanhe a evolução no histórico.",
    high: "Interprete junto da data e da cultura.",
  };
  const priorities: Record<ReadingKind, number> = {
    low: 0,
    cloudy: 1,
    invalid: 2,
    missing: 3,
    simulated: 4,
    medium: 5,
    high: 6,
  };
  return {
    kind,
    label: labels[kind],
    reason: reasons[kind],
    value,
    priority: priorities[kind],
    measured: !!reading && !reading.isSimulated && value !== null,
  };
}
export function summarizeDashboard(farms: DashboardFarm[]) {
  const rows = farms.map((farm) => ({
    farm,
    ...dashboardReading(farm.latestReading),
  }));
  return {
    rows,
    total: farms.length,
    area: farms.reduce(
      (sum, farm) =>
        sum +
        (Number.isFinite(farm.sizeHa) && farm.sizeHa > 0 ? farm.sizeHa : 0),
      0,
    ),
    measured: rows.filter((row) => row.measured).length,
    review: rows
      .filter((row) => row.kind !== "high")
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          a.farm.name.localeCompare(b.farm.name, "pt-BR"),
      ),
  };
}
