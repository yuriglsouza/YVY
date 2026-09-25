import assert from "node:assert/strict";
import test from "node:test";
import type { Farm } from "../shared/schema.js";
import {
  filterAndSortFarms,
  syncLabel,
  syncTimestamp,
} from "../client/src/lib/farm-list.js";

const farms = [
  {
    id: 1,
    name: "Fazenda Café",
    clientId: 7,
    cropType: "Café",
    sizeHa: 12,
    lastSyncAt: new Date("2026-09-20T12:00:00Z"),
  },
  {
    id: 2,
    name: "Área Verde",
    clientId: null,
    cropType: "",
    sizeHa: 50,
    lastSyncAt: null,
  },
  {
    id: 3,
    name: "Fazenda Sol",
    clientId: 8,
    cropType: "Café",
    sizeHa: 3,
    lastSyncAt: new Date("2026-09-25T12:00:00Z"),
  },
] as Farm[];

test("farm filters combine name, client and crop without modifying source data", () => {
  assert.deepEqual(
    filterAndSortFarms(farms, " CAFE ", "7", "Café", "name").map((f) => f.id),
    [1],
  );
  assert.deepEqual(
    filterAndSortFarms(farms, "area", "none", "none", "name").map((f) => f.id),
    [2],
  );
  assert.deepEqual(filterAndSortFarms(farms, "cafe", "8", "all", "name"), []);
  assert.deepEqual(
    filterAndSortFarms(farms, "", "all", "all", "area").map((f) => f.id),
    [2, 1, 3],
  );
  assert.deepEqual(
    farms.map((f) => f.id),
    [1, 2, 3],
  );
});

test("sync ordering keeps missing history last for recent and first for oldest", () => {
  assert.deepEqual(
    filterAndSortFarms(farms, "", "all", "all", "recent").map((f) => f.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    filterAndSortFarms(farms, "", "all", "all", "oldest").map((f) => f.id),
    [2, 1, 3],
  );
  assert.equal(syncTimestamp("invalid"), null);
  assert.equal(syncLabel(null), "Sem sincronização registrada");
  assert.equal(
    syncLabel("2026-09-24T12:00:00Z", Date.parse("2026-09-25T13:00:00Z")),
    "Sincronizado há 1 dia",
  );
});
