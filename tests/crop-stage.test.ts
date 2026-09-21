import assert from "node:assert/strict";
import test from "node:test";
import { cropStageSchema } from "../shared/crop-stage.js";
import { insertFarmSchema } from "../shared/schema.js";
import { MemStorage } from "../server/storage.js";

test("field stage requires an observation and a real date, while legacy farms remain valid", async () => {
  const farmData = { name: "Stage test", latitude: -23, longitude: -46, sizeHa: 10, cropType: "Soja" };
  assert.equal(insertFarmSchema.safeParse(farmData).success, true);
  for (const invalid of [{ stage: "", observedOn: "2026-09-01" }, { stage: "V4", observedOn: "2026-02-30" },
    { stage: "V4", observedOn: "2099-01-01" }, { stage: "V4" }]) {
    assert.equal(cropStageSchema.safeParse(invalid).success, false);
  }
  const storage = new MemStorage();
  const created = await storage.createFarm(farmData);
  assert.equal(created.cropStage, null);
  const observation = cropStageSchema.parse({ stage: " V4 ", observedOn: "2026-09-01" });
  await storage.updateFarm(created.id, { cropStage: observation });
  assert.deepEqual((await storage.getFarm(created.id))!.cropStage, { stage: "V4", observedOn: "2026-09-01" });
  await storage.updateFarm(created.id, { cropStage: null });
  assert.equal((await storage.getFarm(created.id))!.cropStage, null);
});
