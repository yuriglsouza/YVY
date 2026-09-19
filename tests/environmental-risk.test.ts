import assert from "node:assert/strict";
import test from "node:test";
import { getEnvironmentalRiskStatus } from "../shared/environmental-risk.js";

test("does not claim environmental compliance without a verified assessment", () => {
  assert.equal(getEnvironmentalRiskStatus(false), "not_assessed");
  assert.equal(getEnvironmentalRiskStatus(null), "not_assessed");
  assert.equal(getEnvironmentalRiskStatus(undefined), "not_assessed");
});

test("keeps legacy environmental flags visible for manual review", () => {
  assert.equal(getEnvironmentalRiskStatus(true), "review_required");
});
