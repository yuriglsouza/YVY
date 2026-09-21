import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { requestLogger } from '../server/request-logger.js';

test('request logs keep status and duration but never response data or credentials', async () => {
  const lines: string[] = [];
  const app = express(); app.use(express.json()); app.use(requestLogger(line => lines.push(line)));
  app.post('/api/check', (_req, res) => res.json({ secret: 'private-response', signedUrl: 'https://example.test/?token=private-token' }));
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/check?secret=private-query`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=private-cookie' }, body: JSON.stringify({ secret: 'private-body' }),
    });
    assert.equal((await response.json()).secret, 'private-response');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^POST \/api\/check 200 in \d+ms$/);
    assert.equal(lines.join('').includes('private'), false);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
