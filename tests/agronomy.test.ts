import assert from "node:assert/strict";
import test from "node:test";
import { assessApplicationWeather, getCropCycleSummary } from "../shared/agronomy.js";

test("summarizes the crop cycle without claiming a phenological stage", () => {
  const summary = getCropCycleSummary(
    "2026-09-01",
    "2026-12-10",
    new Date("2026-09-26T12:00:00Z"),
  );

  assert.equal(summary.status, "active");
  assert.equal(summary.phaseLabel, "Meio do ciclo");
  assert.equal(summary.progressPercent, 25);
  assert.equal(summary.daysElapsed, 25);
  assert.equal(summary.daysRemaining, 75);
});

test("flags missing and inconsistent crop dates", () => {
  assert.equal(getCropCycleSummary(null, null).status, "missing");
  assert.equal(
    getCropCycleSummary("2026-12-10", "2026-09-01", new Date("2026-09-26T12:00:00Z")).status,
    "invalid",
  );
});

test("uses conservative weather screening for application conditions", () => {
  assert.equal(assessApplicationWeather({ temperatureC: 28, humidityPercent: 70, windKmh: 5, rainMm: 0 }).status, "compatible");

  const attention = assessApplicationWeather({ temperatureC: 33, humidityPercent: 50, windKmh: 12, rainMm: 1 });
  assert.equal(attention.status, "attention");
  assert.deepEqual(attention.checks, {
    temperature: false,
    humidity: false,
    wind: false,
    rain: false,
  });
});
