import test from "node:test";
import assert from "node:assert/strict";
import type { Reading } from "../shared/schema.js";
import {
  dashboardReading,
  summarizeDashboard,
  type DashboardFarm,
} from "../client/src/lib/dashboard-summary.js";
const reading = (values: Partial<Reading>) =>
  ({ ndvi: 0.7, cloudCover: 0.1, isSimulated: false, ...values }) as Reading;
test("dashboard distinguishes missing, simulated, invalid and cloud-limited readings", () => {
  assert.equal(dashboardReading().kind, "missing");
  assert.equal(
    dashboardReading(reading({ isSimulated: true })).measured,
    false,
  );
  assert.equal(dashboardReading(reading({ ndvi: NaN })).kind, "invalid");
  assert.equal(dashboardReading(reading({ ndvi: 1.2 })).measured, false);
  assert.equal(
    dashboardReading(reading({ ndvi: 0.1, cloudCover: 0.8 })).kind,
    "cloudy",
  );
});
test("dashboard preserves zero and negative NDVI rather than missing-data zeros", () => {
  assert.equal(dashboardReading(reading({ ndvi: 0 })).value, 0);
  assert.equal(dashboardReading(reading({ ndvi: -0.4 })).kind, "low");
  assert.equal(dashboardReading().value, null);
  assert.equal(dashboardReading(reading({ ndvi: 0.3 })).kind, "low");
  assert.equal(dashboardReading(reading({ ndvi: 0.6 })).kind, "medium");
});
test("dashboard totals and review list reflect only supplied scope without mutations", () => {
  const farms = [
    { id: 1, name: "A", sizeHa: 10.12, latestReading: reading({}) },
    { id: 2, name: "B", sizeHa: 2.34, latestReading: reading({ ndvi: 0.2 }) },
    { id: 3, name: "C", sizeHa: 0, latestReading: null },
  ] as DashboardFarm[];
  const result = summarizeDashboard(farms);
  assert.equal(result.total, 3);
  assert.ok(Math.abs(result.area - 12.46) < 0.00001);
  assert.equal(result.measured, 2);
  assert.deepEqual(
    result.review.map((row) => row.farm.id),
    [2, 3],
  );
  assert.equal(summarizeDashboard(farms.slice(0, 1)).review.length, 0);
  assert.deepEqual(
    farms.map((farm) => farm.id),
    [1, 2, 3],
  );
  assert.equal(summarizeDashboard([]).measured, 0);
});
