export interface LivestockInputs {
  mode: "milk" | "weight";
  areaHa: number;
  days: number;
  animals: number;
  productionPerAnimalDay: number;
  unitPrice: number;
  pastureCostPerHa: number;
  dailyCostPerAnimal: number;
  otherCosts: number;
}

export function isPasture(cropType: string): boolean {
  return /pasto|pastagem|pecuaria|pecuária/i.test(cropType);
}

export function calculateLivestockFinancial(inputs: LivestockInputs) {
  const values = Object.entries(inputs).filter(([key]) => key !== "mode");
  const valid = values.every(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)
    && inputs.areaHa > 0 && inputs.days > 0 && Number.isInteger(inputs.days)
    && inputs.animals > 0 && Number.isInteger(inputs.animals);
  if (!valid) return null;
  const production = inputs.animals * inputs.days * inputs.productionPerAnimalDay;
  const revenue = production * inputs.unitPrice;
  const costs = inputs.areaHa * inputs.pastureCostPerHa
    + inputs.animals * inputs.days * inputs.dailyCostPerAnimal + inputs.otherCosts;
  const result = revenue - costs;
  const roi = costs > 0 ? result / costs * 100 : null;
  if (![production, revenue, costs, result].every(Number.isFinite) || (roi !== null && !Number.isFinite(roi))) return null;
  return {
    production, revenue, costs, result, roi,
    animalsPerHa: inputs.animals / inputs.areaHa,
    costPerAnimal: costs / inputs.animals,
    breakEvenPrice: production > 0 ? costs / production : null,
  };
}
