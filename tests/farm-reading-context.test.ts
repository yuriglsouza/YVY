import assert from "node:assert/strict";
import test from "node:test";
import type { Reading, Report } from "../shared/schema.js";
import {
  dailyReadings,
  readingDateLabel,
  reportSourceReading,
} from "../client/src/lib/farm-reading-context.js";

const old = { id: 1, farmId: 7, date: "2026-05-14", ndvi: 0.78 } as Reading;
const latest = { id: 2, farmId: 7, date: "2026-09-25", ndvi: 0.24 } as Reading;
test("historical reports keep their snapshot rather than the newest reading", () => {
  const report = {
    farmId: 7,
    sourceReadingId: 1,
    readingsSnapshot: { currentReading: old },
  } as Report;
  assert.equal(reportSourceReading(report, [latest]), old);
  assert.equal(
    reportSourceReading({ ...report, readingsSnapshot: null }, [latest, old]),
    old,
  );
  assert.equal(
    reportSourceReading({ ...report, readingsSnapshot: null }, [latest]),
    null,
  );
});
test("reports never fall back to readings from another farm", () => {
  const report = {
    farmId: 8,
    sourceReadingId: 1,
    readingsSnapshot: { currentReading: old },
  } as Report;
  assert.equal(reportSourceReading(report, [old, latest]), null);
});
test("daily history keeps latest record per day, sorts and preserves its input", () => {
  const duplicate = { ...old, id: 3, ndvi: 0.8 };
  const input = [latest, duplicate, old];
  assert.deepEqual(dailyReadings(input), [duplicate, latest]);
  assert.deepEqual(input, [latest, duplicate, old]);
  assert.deepEqual(dailyReadings([{ ...old, date: "invalid" }]), []);
});
test("date-only labels preserve the calendar day and handle absent values", () => {
  assert.equal(readingDateLabel("2026-05-14"), "14/05/2026");
  assert.equal(readingDateLabel(null), "Data não informada");
  assert.equal(readingDateLabel("bad"), "Data não informada");
});
