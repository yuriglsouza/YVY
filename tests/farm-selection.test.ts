import assert from "node:assert/strict";
import test from "node:test";
import { availableFarmId } from "../client/src/lib/farm-selection.js";
test("prediction selection keeps a valid farm and immediately replaces a filtered farm", () => {
  const farms = [{ id: 4 }, { id: 7 }];
  assert.equal(availableFarmId(farms, "7"), "7");
  assert.equal(availableFarmId(farms, "2"), "4");
  assert.equal(availableFarmId(farms, undefined), "4");
  assert.equal(availableFarmId([], "7"), undefined);
  assert.deepEqual(farms, [{ id: 4 }, { id: 7 }]);
});
