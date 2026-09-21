import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { registerVisitRoutes } from '../server/visit-routes.js';
import { MemStorage } from '../server/storage.js';

test('visit photos: private signing, actual file validation, failed storage preserves history', async () => {
  const storage = new MemStorage();
  let bytes = new Uint8Array([137,80,78,71,13,10,26,10]);
  let publicBucket = false;
  let missing = false;
  const signed: string[] = [];
  const supabase = { storage: {
    getBucket: async () => ({ data: { public: publicBucket } }),
    from: (bucket: string) => {
      assert.equal(bucket, 'farm-visit-photos');
      return {
        createSignedUploadUrl: async (path: string) => { signed.push(path); return { data: { path, signedUrl: 'https://storage.test/upload' } }; },
        download: async () => missing ? { error: new Error('missing') } : { data: new Blob([bytes]) },
        createSignedUrls: async (paths: string[], expires: number) => {
          assert.equal(expires, 600);
          return { data: paths.map(path => ({ signedUrl: `https://storage.test/signed/${path}` })) };
        },
      };
    },
  } };
  const app = express(); app.use(express.json());
  app.use((req: any, _res, next) => { req.user = { id: 2 }; next(); });
  registerVisitRoutes(app, storage, supabase as any, (_req, _res, next) => next(), (_req, _res, next) => next());
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/farms/1/visits`;
  const post = (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/upload-url', { contentType: 'text/html', size: 20 })).status, 400);
    assert.equal((await post('/upload-url', { contentType: 'image/png', size: 7 * 1024 * 1024 })).status, 400);
    publicBucket = true;
    assert.equal((await post('/upload-url', { contentType: 'image/png', size: 8 })).status, 502);
    assert.equal(signed.length, 0);
    publicBucket = false;
    const upload = await post('/upload-url', { contentType: 'image/png', size: 8 });
    assert.equal(upload.status, 200);
    const { path } = await upload.json();
    assert.match(path, /^1\/2\/.+\.png$/);
    const body = { observedOn: '2026-09-01', observations: 'Test photo', photoPaths: [path] };
    assert.equal((await post('', body)).status, 201);
    const list = await fetch(base);
    assert.equal(list.headers.get('cache-control'), 'private, no-store');
    assert.match((await list.json()).visits[0].photoUrls[0], /\/signed\//);
    bytes = new TextEncoder().encode('<script>bad</script>');
    assert.equal((await post('', body)).status, 400);
    missing = true;
    assert.equal((await post('', body)).status, 400);
    assert.equal((await storage.getVisits(1)).length, 1);
    assert.equal((await post('', { ...body, photoPaths: [path, path] })).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
