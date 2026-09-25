import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeRegionalNdvi } from '../shared/benchmark.js';
import type { Reading } from '../shared/schema.js';

const reading = (changes: Partial<Reading> = {}): Reading => ({
  id: 1, farmId: 1, date: '2026-09-20', ndvi: 0.72, ndwi: 0.2, ndre: 0.3, rvi: 1,
  otci: null, temperature: null, cloudCover: null, satelliteImage: null,
  thermalImage: null, imageBounds: null, regionalNdvi: 0.61,
  carbonStock: null, co2Equivalent: null, isSimulated: false, createdAt: null,
  ...changes,
});

test('regional comparison uses only an actual regional measurement and never invents a rank', () => {
  assert.deepEqual(summarizeRegionalNdvi(reading()), {
    status: 'available', farmNdvi: 0.72, regionalNdvi: 0.61,
    difference: 0.10999999999999999, readingDate: '2026-09-20',
  });
  for (const regionalNdvi of [null, 0, Number.NaN, 1.3]) {
    assert.equal(summarizeRegionalNdvi(reading({ regionalNdvi })).status, 'unavailable');
  }
  assert.equal(summarizeRegionalNdvi(reading({ isSimulated: true })).status, 'unavailable');
  assert.equal(summarizeRegionalNdvi(undefined).status, 'unavailable');
});
