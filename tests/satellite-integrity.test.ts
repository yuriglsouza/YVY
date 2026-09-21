import assert from "node:assert/strict";
import test from "node:test";
import { syncFarmSatelliteData } from "../server/routes.js";
import { storage } from "../server/storage.js";

test("satellite failure preserves history even when legacy simulation is enabled", async (t) => {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_STORAGE_BUCKET", "PYTHON_SERVICE_URL", "ALLOW_SIMULATED_SATELLITE_DATA"];
  const previous = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = key.endsWith("URL") ? "https://satellite.test" : "test"; });
  process.env.ALLOW_SIMULATED_SATELLITE_DATA = "true";
  t.after(() => keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key];
    else process.env[key] = previous[i];
  }));
  const farm = await storage.createFarm({ name: "Integrity test", latitude: -23, longitude: -46, sizeHa: 100, cropType: "Soja" });
  const reading = await storage.createReading({ farmId: farm.id, date: "2026-09-01", ndvi: 0.6, ndwi: 0.2, ndre: 0.4, rvi: 1, isSimulated: false });
  const before = await storage.getReadings(farm.id);
  let payload: Record<string, unknown> = { error: "Satellite unavailable" };
  let ready = false;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    return Response.json(String(url).endsWith("/warmup") ? { earthEngineReady: ready } : payload);
  });
  const unavailable = await syncFarmSatelliteData(farm.id);
  assert.equal(unavailable.success, false);
  assert.equal(unavailable.simulationUsed, false);
  assert.deepEqual(await storage.getReadings(farm.id), before);

  ready = true;
  payload = { isSimulated: true, date: "2026-09-21" };
  const simulated = await syncFarmSatelliteData(farm.id);
  assert.equal(simulated.success, false);
  assert.deepEqual(await storage.getReadings(farm.id), before);
  assert.deepEqual(await storage.getTasks(farm.id), []);

  payload = { date: reading.date, ndvi: 0.7, ndwi: 0.2, ndre: 0.4, rvi: 1 };
  const real = await syncFarmSatelliteData(farm.id);
  assert.equal(real.readingId, reading.id);
  const after = await storage.getReadings(farm.id);
  assert.equal(after.length, 1);
  assert.equal(after[0].ndvi, 0.7);
  assert.equal(after[0].isSimulated, false);
});
