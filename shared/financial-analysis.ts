export interface FinancialZone {
  name?: string | null;
  areaPercentage?: number | null;
  areaHa?: number | null;
  ndviAvg?: number | null;
}

export interface FinancialInputs {
  farmSizeHa: number;
  costPerHa: number;
  pricePerBag: number;
  highYield: number;
  mediumYield: number;
  lowYield: number;
  zones: FinancialZone[];
}

export interface FinancialResults {
  totalCost: number;
  grossRevenue: number;
  netProfit: number;
  roi: number;
  avgYield: number;
  productionBags: number;
  usedFallback: boolean;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getRawZoneShare(zone: FinancialZone, farmSizeHa: number): number | null {
  if (Number.isFinite(zone.areaPercentage) && zone.areaPercentage! > 0) {
    return zone.areaPercentage! > 1 ? zone.areaPercentage! / 100 : zone.areaPercentage!;
  }

  if (Number.isFinite(zone.areaHa) && zone.areaHa! > 0 && farmSizeHa > 0) {
    return zone.areaHa! / farmSizeHa;
  }

  return null;
}

function getZoneYield(zone: FinancialZone, inputs: FinancialInputs): number {
  const normalizedName = (zone.name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizedName.includes("alta")) return safeNonNegative(inputs.highYield);
  if (normalizedName.includes("media")) return safeNonNegative(inputs.mediumYield);
  if (normalizedName.includes("baixa")) return safeNonNegative(inputs.lowYield);

  const ndvi = zone.ndviAvg;
  if (Number.isFinite(ndvi)) {
    if (ndvi! >= 0.6) return safeNonNegative(inputs.highYield);
    if (ndvi! >= 0.35) return safeNonNegative(inputs.mediumYield);
    return safeNonNegative(inputs.lowYield);
  }

  return safeNonNegative(inputs.mediumYield);
}

export function calculateFinancialAnalysis(inputs: FinancialInputs): FinancialResults {
  const farmSizeHa = safeNonNegative(inputs.farmSizeHa);
  const totalCost = farmSizeHa * safeNonNegative(inputs.costPerHa);
  const validZones = inputs.zones
    .map(zone => ({ zone, share: getRawZoneShare(zone, farmSizeHa) }))
    .filter((entry): entry is { zone: FinancialZone; share: number } => entry.share !== null && entry.share > 0);

  const totalShare = validZones.reduce((sum, entry) => sum + entry.share, 0);
  const usedFallback = totalShare <= 0;
  const avgYield = usedFallback
    ? safeNonNegative(inputs.mediumYield)
    : validZones.reduce((sum, entry) => {
        const normalizedShare = entry.share / totalShare;
        return sum + normalizedShare * getZoneYield(entry.zone, inputs);
      }, 0);

  const productionBags = farmSizeHa * avgYield;
  const grossRevenue = productionBags * safeNonNegative(inputs.pricePerBag);
  const netProfit = grossRevenue - totalCost;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    totalCost,
    grossRevenue,
    netProfit,
    roi,
    avgYield,
    productionBags,
    usedFallback,
  };
}
