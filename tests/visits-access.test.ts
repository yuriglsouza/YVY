import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { storage } from '../server/storage.js';
import { registerRoutes } from '../server/routes.js';
import { visitInputSchema, ownsVisitPhoto, visitReportContext } from '../shared/farm-visit.js';

test('visit validation rejects future dates, invalid dates, empty notes and spoofed ownership', () => {
  const valid = { observedOn: '2026-09-01', observations: 'Rebrota uniforme' };
  assert.equal(visitInputSchema.safeParse(valid).success, true);
  for (const input of [{ ...valid, observedOn: '2026-02-30' }, { ...valid, observedOn: '2999-01-01' },
    { ...valid, observations: '  ' }, { ...valid, authorId: 2 }, { ...valid, photoPaths: ['a','b','c','d','e'] }]) {
    assert.equal(visitInputSchema.safeParse(input).success, false);
  }
  const path = '1/2/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg';
  assert.equal(ownsVisitPhoto(path, 1, 2), true);
  assert.equal(ownsVisitPhoto(path, 2, 2), false);
  assert.equal(ownsVisitPhoto(path, 1, 3), false);
  assert.equal(ownsVisitPhoto('1/2/../secret.jpg', 1, 2), false);
  assert.equal(ownsVisitPhoto(path + '/extra', 1, 2), false);
  const report = visitReportContext([{ ...valid, stage: 'V4', management: 'Inspeção', photoPaths: ['secret'] } as any]);
  assert.equal(report.includes('secret'), false);
  assert.equal(JSON.parse(report)[0].observedOn, valid.observedOn);
});

test('farm access matrix: owner/admin allowed; other user/anonymous blocked; visits persist independently', async () => {
  const owner = await storage.createUser({ email: 'visit-owner@example.test', role: 'user' });
  const other = await storage.createUser({ email: 'visit-other@example.test', role: 'user' });
  const admin = await storage.createUser({ email: 'visit-admin@example.test', role: 'admin' });
  const farm = await storage.createFarm({ name: 'Visit tests', userId: owner.id, latitude: 0, longitude: 0, sizeHa: 1, cropType: 'Pasto' });
  const task = await storage.createTask({ farmId: farm.id, title: 'Existing action' });
  await storage.logAlert(farm.id, 'TEST', 'Test', owner.email);
  const alert = (await storage.getAlerts()).find(a => a.farmId === farm.id)!;
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = ({ owner, other, admin } as any)[req.headers['x-test-role'] as string];
    req.isAuthenticated = () => Boolean(req.user); next();
  });
  const server = createServer(app); await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as any;
  const request = (role: string, path: string, method = 'GET', body?: unknown) => fetch(`http://127.0.0.1:${address.port}/api${path}`, {
    method, headers: { 'x-test-role': role, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  try {
    for (const role of ['other', 'anonymous']) {
      const expected = role === 'other' ? 403 : 401;
      for (const [path, method, body] of [
        [`/farms/${farm.id}`, 'GET'], [`/farms/${farm.id}`, 'PUT', { name: 'Hacked' }], [`/farms/${farm.id}`, 'DELETE'],
        [`/farms/${farm.id}/visits`, 'GET'], [`/farms/${farm.id}/visits`, 'POST', { observedOn: '2026-09-01', observations: 'Hacked' }],
        [`/farms/${farm.id}/visits/upload-url`, 'POST', { contentType: 'image/png', size: 10 }],
        [`/farms/${farm.id}/tasks`, 'GET'], [`/farms/${farm.id}/tasks`, 'POST', { title: 'Hacked' }],
        [`/tasks/${task.id}`, 'PATCH', { title: 'Hacked' }], [`/tasks/${task.id}`, 'DELETE'], [`/alerts/${alert.id}/read`, 'POST'],
        [`/farms/${farm.id}/readings`, 'GET'], [`/farms/${farm.id}/reports`, 'GET'],
      ] as Array<[string, string, unknown?]>) {
        assert.equal((await request(role, path, method, body)).status, expected, `${role} ${method} ${path}`);
      }
    }
    assert.equal((await storage.getFarm(farm.id))!.name, 'Visit tests');
    assert.equal((await storage.getTask(task.id))!.title, 'Existing action');
    assert.equal((await storage.getAlert(alert.id))!.read, false);
    for (const role of ['owner', 'admin']) {
      assert.equal((await request(role, `/farms/${farm.id}/tasks`)).status, 200);
      assert.equal((await request(role, `/tasks/${task.id}`, 'PATCH', { title: 'Authorized' })).status, 200);
      assert.equal((await request(role, `/alerts/${alert.id}/read`, 'POST')).status, 200);
      assert.equal((await request(role, `/farms/${farm.id}/visits`)).status, 200);
    }
    assert.equal((await request('owner', `/tasks/${task.id}`, 'PATCH', { farmId: 999 })).status, 400);
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      assert.equal((await request('owner', method === 'PUT' || method === 'DELETE' ? '/clients/1' : '/clients', method, method === 'POST' || method === 'PUT' ? { name: 'No' } : undefined)).status, 403);
    }
    assert.equal((await request('admin', '/clients')).status, 200);
    const body = { observedOn: '2026-09-10', stage: 'Rebrota', observations: 'Visita mais recente', management: 'Inspeção visual' };
    const created = await request('owner', `/farms/${farm.id}/visits`, 'POST', body);
    assert.equal(created.status, 201);
    assert.equal((await created.json()).authorId, owner.id);
    assert.equal((await request('admin', `/farms/${farm.id}/visits`, 'POST', { ...body, observedOn: '2026-09-01' })).status, 201);
    const page = await (await request('owner', `/farms/${farm.id}/visits`)).json();
    assert.equal(page.visits.length, 2); assert.equal(page.hasMore, false);
    assert.equal(page.visits[0].observedOn, '2026-09-10');
    assert.equal((await storage.getFarm(farm.id))!.cropStage, null);
    assert.equal((await request('owner', `/farms/${farm.id}/visits`, 'POST', { ...body, authorId: admin.id })).status, 400);
    assert.equal((await request('owner', `/farms/${farm.id}/visits`, 'POST', { ...body, photoPaths: ['1/999/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg'] })).status, 403);
    assert.equal((await request('owner', `/farms/${farm.id}/visits?offset=-1`)).status, 400);
    for (let i = 0; i < 20; i++) await storage.createVisit({ farmId: farm.id, authorId: owner.id, ...body });
    const first = await (await request('owner', `/farms/${farm.id}/visits`)).json();
    const second = await (await request('owner', `/farms/${farm.id}/visits?offset=20`)).json();
    assert.equal(first.visits.length, 20); assert.equal(first.hasMore, true);
    assert.equal(second.visits.length, 2); assert.equal(second.hasMore, false);
    assert.equal((await request('owner', `/farms/${farm.id}`, 'DELETE')).status, 204);
    assert.deepEqual(await storage.getVisits(farm.id), []);
    assert.equal((await request('owner', `/farms/${farm.id}/visits`)).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
