import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from './app.js';
import { listenerSettings } from './web.js';

test('production binds the hosting port while development stays local', () => {
  assert.deepEqual(listenerSettings({}), { port: 3001, host: '127.0.0.1' });
  assert.deepEqual(listenerSettings({ NODE_ENV: 'production', PORT: '12345' }), { port: 12345, host: '0.0.0.0' });
  for (const port of ['0', '65536', 'abc']) assert.throws(() => listenerSettings({ NODE_ENV: 'production', PORT: port }));
});

test('production serves React browser routes without swallowing API or missing assets', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'coachlab-web-'));
  writeFileSync(join(directory, 'index.html'), '<html>CoachLab test shell</html>');
  writeFileSync(join(directory, 'example.js'), '/* test asset */');
  const auth = { getUser: async () => ({ id: 'test-coach' }) };
  const app = createApp({ list: async () => [] }, { auth, production: true, frontendDirectory: directory });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/lesson/123', '/reset-password']) {
    const response = await fetch(base + path, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /CoachLab test shell/);
  }
  assert.deepEqual(await (await fetch(base + '/api/lessons')).json(), []);
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
  assert.match(await (await fetch(base + '/example.js')).text(), /test asset/);
  assert.throws(() => createApp({}, { auth, production: true, frontendDirectory: join(directory, 'absent') }), /Build the React/);
});
