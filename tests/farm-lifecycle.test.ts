import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { registerRoutes } from "../server/routes.js";
import { MemStorage, storage as appStorage } from "../server/storage.js";

test("creates and deletes a farm with all dependent records", async () => {
  const storage = new MemStorage();
  const user = await storage.createUser({
    email: "producer@example.com",
    name: "Producer",
    receiveAlerts: true,
  });
  const farm = await storage.createFarm({
    userId: user.id,
    name: "Test Farm",
    latitude: -23.55,
    longitude: -46.63,
    sizeHa: 100,
    cropType: "Soja",
  });
  const reading = await storage.createReading({
    farmId: farm.id,
    date: "2026-09-18",
    ndvi: 0.7,
    ndwi: 0.2,
    ndre: 0.4,
    rvi: 1.1,
    isSimulated: false,
  });
  await storage.createReport({
    farmId: farm.id,
    content: "Test report",
    sourceReadingId: reading.id,
  });
  await storage.createTask({
    farmId: farm.id,
    title: "Inspect field",
  });
  await storage.logAlert(farm.id, "TEST", "Test alert", user.email);

  await storage.deleteFarm(farm.id);

  assert.equal(await storage.getFarm(farm.id), undefined);
  assert.deepEqual(await storage.getReadings(farm.id), []);
  assert.deepEqual(await storage.getReports(farm.id), []);
  assert.deepEqual(await storage.getTasks(farm.id), []);
  assert.equal((await storage.getAlerts()).some(alert => alert.farmId === farm.id), false);
});

test("farm API creates, enforces the free limit, deletes, and allows creation again", async () => {
  const user = await appStorage.createUser({
    email: "api-producer@example.com",
    name: "API Producer",
    role: "user",
    receiveAlerts: true,
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const authenticatedRequest = req as typeof req & {
      isAuthenticated: () => boolean;
      user: typeof user;
    };
    authenticatedRequest.isAuthenticated = () => true;
    authenticatedRequest.user = user;
    next();
  });

  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const createResponse = await fetch(`${baseUrl}/api/farms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "API Test Farm",
        cropType: "Soja",
        sizeHa: 25,
        latitude: -23.55,
        longitude: -46.63,
      }),
    });

    assert.equal(createResponse.status, 201);
    const farm = await createResponse.json() as { id: number; userId: number };
    assert.equal(farm.userId, user.id);

    const limitedResponse = await fetch(`${baseUrl}/api/farms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Blocked Second Farm",
        cropType: "Milho",
        sizeHa: 30,
        latitude: -22.9,
        longitude: -47.1,
      }),
    });
    assert.equal(limitedResponse.status, 403);
    assert.match((await limitedResponse.json() as { message: string }).message, /Plano Gratuito/);

    const deleteResponse = await fetch(`${baseUrl}/api/farms/${farm.id}`, {
      method: "DELETE",
    });
    assert.equal(deleteResponse.status, 204);
    assert.equal(await appStorage.getFarm(farm.id), undefined);

    const createAgainResponse = await fetch(`${baseUrl}/api/farms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Replacement Farm",
        cropType: "Café",
        sizeHa: 15,
        latitude: -21.2,
        longitude: -45.1,
      }),
    });
    assert.equal(createAgainResponse.status, 201);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
