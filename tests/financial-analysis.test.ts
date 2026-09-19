import assert from "node:assert/strict";
import test from "node:test";
import { calculateFinancialAnalysis } from "../shared/financial-analysis.js";

const baseInputs = {
  farmSizeHa: 100,
  costPerHa: 5000,
  pricePerBag: 120,
  highYield: 75,
  mediumYield: 60,
  lowYield: 40,
};

test("calculates ROI from fractional zone shares", () => {
  const result = calculateFinancialAnalysis({
    ...baseInputs,
    zones: [
      { name: "Alta Produtividade", areaPercentage: 0.2 },
      { name: "Média Produtividade", areaPercentage: 0.5 },
      { name: "Baixa Produtividade", areaPercentage: 0.3 },
    ],
  });

  assert.equal(result.avgYield, 57);
  assert.equal(result.productionBags, 5700);
  assert.equal(result.totalCost, 500000);
  assert.equal(result.grossRevenue, 684000);
  assert.equal(result.netProfit, 184000);
  assert.equal(result.roi, 36.8);
});

test("normalizes percentage values and arbitrary zone names", () => {
  const result = calculateFinancialAnalysis({
    ...baseInputs,
    zones: [
      { name: "Talhão Norte", areaPercentage: 20, ndviAvg: 0.7 },
      { name: "Talhão Central", areaPercentage: 50, ndviAvg: 0.5 },
      { name: "Talhão Sul", areaPercentage: 30, ndviAvg: 0.2 },
    ],
  });

  assert.equal(result.avgYield, 57);
  assert.equal(result.roi, 36.8);
});

test("uses the configured average productivity when zones are unavailable", () => {
  const result = calculateFinancialAnalysis({ ...baseInputs, zones: [] });

  assert.equal(result.usedFallback, true);
  assert.equal(result.avgYield, 60);
  assert.equal(result.productionBags, 6000);
  assert.equal(result.roi, 44);
});

test("uses zone area in hectares when a percentage is unavailable", () => {
  const result = calculateFinancialAnalysis({
    ...baseInputs,
    zones: [
      { name: "Alta Produtividade", areaPercentage: 0, areaHa: 25 },
      { name: "Média Produtividade", areaPercentage: 0, areaHa: 75 },
    ],
  });

  assert.equal(result.usedFallback, false);
  assert.equal(result.avgYield, 63.75);
  assert.equal(result.roi, 53);
});
