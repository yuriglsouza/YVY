import assert from "node:assert/strict";
import test from "node:test";
import { calculateLivestockFinancial, isPasture } from "../shared/livestock-financial.js";

const inputs = { mode: "milk" as const, areaHa: 10, days: 30, animals: 20,
  productionPerAnimalDay: 15, unitPrice: 2, pastureCostPerHa: 100, dailyCostPerAnimal: 5, otherCosts: 500 };
test("milk revenue and costs use the same period and actual animal count", () => {
  const r = calculateLivestockFinancial(inputs)!;
  assert.equal(r.production, 9000);
  assert.equal(r.revenue, 18000);
  assert.equal(r.costs, 4500);
  assert.equal(r.result, 13500);
  assert.equal(r.roi, 300);
  assert.equal(r.animalsPerHa, 2);
  assert.equal(r.costPerAnimal, 225);
  assert.equal(r.breakEvenPrice, 0.5);
});
test("weight gain values only the additional live weight", () => {
  const r = calculateLivestockFinancial({ ...inputs, mode: "weight", productionPerAnimalDay: 0.5, unitPrice: 10 })!;
  assert.equal(r.production, 300);
  assert.equal(r.revenue, 3000);
  assert.equal(r.result, -1500);
  assert.ok(Math.abs(r.roi! + 100 / 3) < 1e-10);
});
test("invalid inputs and zero denominators never produce a misleading return", () => {
  for (const invalid of [{ days: 0 }, { animals: 1.5 }, { unitPrice: NaN }, { otherCosts: -1 }, { areaHa: 0 }]) {
    assert.equal(calculateLivestockFinancial({ ...inputs, ...invalid }), null);
  }
  assert.equal(calculateLivestockFinancial({ ...inputs, pastureCostPerHa: 0, dailyCostPerAnimal: 0, otherCosts: 0 })!.roi, null);
  assert.equal(calculateLivestockFinancial({ ...inputs, productionPerAnimalDay: 0 })!.breakEvenPrice, null);
  assert.equal(isPasture("Pasto / Pecuária"), true);
  assert.equal(isPasture("Soja"), false);
});
