import { test } from "node:test";
import assert from "node:assert/strict";
import { runSatelliteBatch, FARM_INTERVAL_MS } from "../scripts/satellite-batch.mjs";
import { isAuthorizedSatelliteWorkflow, verifySatelliteWorkflowAuthorization } from "../server/github-actions-auth.js";

const claims = {
  repository: "yuriglsouza/YVY",
  repository_id: "1151505523",
  ref: "refs/heads/main",
  sub: "repo:yuriglsouza/YVY:ref:refs/heads/main",
  workflow_ref: "yuriglsouza/YVY/.github/workflows/satellite-sync.yml@refs/heads/main",
  event_name: "schedule",
};

test("satellite workflow claims accept only the intended production workflow", () => {
  assert.equal(isAuthorizedSatelliteWorkflow(claims), true);
  assert.equal(isAuthorizedSatelliteWorkflow({ ...claims, event_name: "workflow_dispatch" }), true);
  for (const [key, value] of Object.entries(claims)) {
    assert.equal(isAuthorizedSatelliteWorkflow({ ...claims, [key]: `${value}-other` }), false, key);
  }
});

test("satellite workflow authorization rejects absent and malformed tokens", async () => {
  assert.equal(await verifySatelliteWorkflowAuthorization(undefined), false);
  assert.equal(await verifySatelliteWorkflowAuthorization("Bearer garbage"), false);
});

test("batch sync is sequential, ordered, waits five minutes and continues after a farm fails", async () => {
  const calls: string[] = [];
  await assert.rejects(runSatelliteBatch({
    apiRequest: async (method, path) => {
      calls.push(`${method} ${path}`);
      if (method === "GET") return { farmIds: [3, 1, 2, 2] };
      if (path.includes("/2/")) throw new Error("temporary failure");
      return { success: true, farmId: Number(path.split("/")[4]) };
    },
    sleep: async ms => { calls.push(`sleep ${ms}`); },
    log: () => {},
  }), /Falhas nas fazendas: 2/);
  assert.deepEqual(calls, [
    "GET /api/cron/farms",
    "POST /api/cron/farms/1/sync",
    `sleep ${FARM_INTERVAL_MS}`,
    "POST /api/cron/farms/2/sync",
    `sleep ${FARM_INTERVAL_MS}`,
    "POST /api/cron/farms/3/sync",
  ]);
});

test("dry run lists farms without synchronizing", async () => {
  const calls: string[] = [];
  await runSatelliteBatch({
    apiRequest: async (_method, path) => { calls.push(path); return { farmIds: [1, 2] }; },
    sleep: async () => { throw new Error("should not sleep"); },
    dryRun: true,
    log: () => {},
  });
  assert.deepEqual(calls, ["/api/cron/farms"]);
});
